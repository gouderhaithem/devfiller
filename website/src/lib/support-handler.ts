import { buildSupportEmail, validateSupport, type SupportEmail, type SupportErrors } from "./support";

// The /api/support endpoint, written against plain Request and Response so it can be tested
// without a server. route.ts wires it to Resend and the environment.

export type SendResult = { ok: true; id: string } | { ok: false; status: number; detail: string };

export interface SupportDeps {
  apiKey: string | undefined;
  to: string | undefined;
  from: string;
  send: (email: SupportEmail, apiKey: string) => Promise<SendResult>;
  allow: (key: string, now: number) => boolean;
  now: () => number;
  log: (message: string, detail?: unknown) => void;
}

// Larger than any valid message (5,000 characters, up to 3 bytes each in Arabic), far smaller than
// abuse. Vercel already caps request bodies at 4.5 MB before this code reads them.
const MAX_BODY_BYTES = 32_000;
// A person needs longer than this to fill the form; scripts usually don't wait.
const MIN_FILL_MS = 2500;
const RETRY_AFTER_SECONDS = 15 * 60;

interface Envelope {
  success: boolean;
  data: { sent: true } | null;
  error: string | null;
  errors?: SupportErrors;
}

const reply = (status: number, body: Envelope, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const failure = (status: number, error: string, extra: Partial<Envelope> = {}, headers?: Record<string, string>) =>
  reply(status, { success: false, data: null, error, ...extra }, headers);
const accepted = () => reply(200, { success: true, data: { sent: true }, error: null });

// Same-origin only: the form on this site may post, other sites may not. The host is the one the
// browser reached (Vercel's proxy passes it as x-forwarded-host); request.url can be internal.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const reached = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === reached;
  } catch {
    return false;
  }
}

// The rate-limit key: the address Vercel sets for the client, with IPv6 grouped by its /64 network,
// since one household or server usually holds a whole /64.
export function clientKey(request: Request): string {
  const address = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!address.includes(":")) return address;
  const [head, tail = ""] = address.toLowerCase().split("::");
  const groups = head.split(":").filter(Boolean);
  const full = tail || groups.length >= 4 ? [...groups, ...Array(8).fill("0")].slice(0, 4) : groups;
  return `${full.join(":")}::/64`;
}

export async function readJson(request: Request): Promise<{ body?: unknown; status?: number }> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return { status: 413 };
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { status: 413 };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { status: 400 };
  }
}

export function createSupportHandler(deps: SupportDeps) {
  return async function handleSupport(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return failure(403, "Messages can only be sent from the DevFiller website.");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure(415, "Please send the form as JSON.");

    const { body, status } = await readJson(request);
    if (status === 413) return failure(413, "This message is too long. Please shorten it.");
    if (status) return failure(400, "The form could not be read. Please try again.");

    // Bots fill the hidden field or submit instantly. They get a normal answer so they don't retry.
    // The form measures its own elapsed time, so clocks never disagree; odd values never drop a message.
    const fields = (body ?? {}) as Record<string, unknown>;
    const elapsed = typeof fields.elapsedMs === "number" ? fields.elapsedMs : NaN;
    if (fields.leave_empty || (elapsed >= 0 && elapsed < MIN_FILL_MS)) return accepted();

    const result = validateSupport(body);
    if (!result.ok) return failure(400, "Please check the highlighted fields.", { errors: result.errors });

    if (!deps.allow(clientKey(request), deps.now()))
      return failure(429, "You’ve sent several messages in a short time. Please try again in 15 minutes.", {}, { "retry-after": String(RETRY_AFTER_SECONDS) });

    if (!deps.apiKey || !deps.to) {
      deps.log(`support: ${deps.apiKey ? "SUPPORT_EMAIL_TO" : "RESEND_API_KEY"} is not set`);
      return failure(503, "Support messages are unavailable right now. Please open a GitHub issue instead.");
    }

    try {
      const sent = await deps.send(buildSupportEmail(result.value, { to: deps.to, from: deps.from }), deps.apiKey);
      if (sent.ok) return accepted();
      deps.log(`support: Resend refused the message (${sent.status})`, sent.detail);
    } catch (error) {
      deps.log("support: could not reach Resend", error);
    }
    return failure(502, "Your message couldn’t be sent. Please try again, or open a GitHub issue.");
  };
}

// Sends one email through Resend's REST API.
export async function sendWithResend(email: SupportEmail, apiKey: string): Promise<SendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  }
  return { ok: false, status: response.status, detail: (await response.text().catch(() => "")).slice(0, 500) };
}
