import { validateReview, type ReviewErrors, type ReviewInput } from "./reviews";
import { clientKey, readJson, sameOrigin } from "./support-handler";

// The /api/reviews endpoint, written against plain Request and Response so it can be tested
// without a server or a database. route.ts wires it to Neon. A review is published as soon as it is
// stored; the maintainer can hide one by setting approved = false.

export interface ReviewDeps {
  insert: (review: ReviewInput) => Promise<void>;
  // Refreshes the pages that list reviews, once one is stored.
  published: () => void;
  allow: (key: string, now: number) => boolean;
  now: () => number;
  log: (message: string, detail?: unknown) => void;
}

// A person needs longer than this to write a review; scripts usually don't wait.
const MIN_FILL_MS = 2500;
const RETRY_AFTER_SECONDS = 15 * 60;

interface Envelope {
  success: boolean;
  data: { received: true } | null;
  error: string | null;
  errors?: ReviewErrors;
}

const reply = (status: number, body: Envelope, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const failure = (status: number, error: string, extra: Partial<Envelope> = {}, headers?: Record<string, string>) =>
  reply(status, { success: false, data: null, error, ...extra }, headers);
const received = () => reply(200, { success: true, data: { received: true }, error: null });

export function createReviewHandler(deps: ReviewDeps) {
  return async function handleReview(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return failure(403, "Reviews can only be sent from the DevFiller website.");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure(415, "Please send the form as JSON.");

    const { body, status } = await readJson(request);
    if (status === 413) return failure(413, "This review is too long. Please shorten it.");
    if (status || !body || typeof body !== "object") return failure(400, "The form couldn't be read. Please try again.");

    // Bots fill the hidden field or post instantly: they're told it worked, and nothing is stored.
    const { leave_empty: honeypot, elapsedMs } = body as { leave_empty?: unknown; elapsedMs?: unknown };
    if ((typeof honeypot === "string" && honeypot.trim()) || (typeof elapsedMs === "number" && elapsedMs >= 0 && elapsedMs < MIN_FILL_MS)) return received();

    const checked = validateReview(body);
    if (!checked.ok) return failure(400, "Please check the highlighted fields.", { errors: checked.errors });

    if (!deps.allow(clientKey(request), deps.now()))
      return failure(429, "You've sent several reviews in a short time. Please try again later.", {}, { "retry-after": String(RETRY_AFTER_SECONDS) });

    try {
      await deps.insert(checked.value);
    } catch (error) {
      deps.log("Review could not be stored", error);
      return failure(503, "Reviews can't be saved right now. Please try again later.");
    }
    deps.published();
    return received();
  };
}
