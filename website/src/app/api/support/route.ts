import { createRateLimiter } from "@/lib/rate-limit";
import { createSupportHandler, sendWithResend } from "@/lib/support-handler";

// The support form's endpoint: validates the message and emails it through Resend. Everything comes
// from Vercel's environment: RESEND_API_KEY and SUPPORT_EMAIL_TO (required, so the address never
// appears in this public repository) and SUPPORT_EMAIL_FROM (optional; a domain verified in Resend).
export const runtime = "nodejs";

const handler = createSupportHandler({
  apiKey: process.env.RESEND_API_KEY,
  to: process.env.SUPPORT_EMAIL_TO,
  from: process.env.SUPPORT_EMAIL_FROM || "DevFiller Support <onboarding@resend.dev>",
  send: sendWithResend,
  allow: createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }),
  now: Date.now,
  log: (message, detail) => console.error(message, detail ?? ""),
});

export async function POST(request: Request) {
  return handler(request);
}
