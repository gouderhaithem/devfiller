// The support form: its topics, limits, validation and the email it becomes. Shared by the form in
// the browser and the /api/support route, so both apply the same rules.

export const TOPICS = [
  { value: "bug", label: "Something doesn’t work" },
  { value: "wrong-field", label: "A field was filled wrong" },
  { value: "feature", label: "Feature idea" },
  { value: "install", label: "Installing or the Chrome Web Store" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "other", label: "Something else" },
] as const;

export type Topic = (typeof TOPICS)[number]["value"];

export const LIMITS = { name: 100, email: 254, message: 5000, minMessage: 10, page: 500 } as const;

export interface SupportMessage {
  name: string;
  email: string;
  topic: Topic;
  message: string;
  page?: string;
}

export type SupportField = keyof SupportMessage;
export type SupportErrors = Partial<Record<SupportField, string>>;
export type Validation = { ok: true; value: SupportMessage } | { ok: false; errors: SupportErrors };

// Deliberately simple: one @, dot-separated domain labels, no spaces or brackets. The reply is
// the real check. Domain labels exclude the dot, so the match stays linear on long input.
const EMAIL = /^[^\s@<>",]+@[^\s@<>",.]+(?:\.[^\s@<>",.]+)+$/;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
// A single line: names end up in the subject, so line breaks become spaces, and invisible
// control or text-direction characters (which can disguise a name) are removed.
const line = (value: unknown) =>
  text(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

function webAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateSupport(input: unknown): Validation {
  if (!input || typeof input !== "object") return { ok: false, errors: { message: "Please fill in the form." } };
  const body = input as Record<string, unknown>;
  const value = {
    name: line(body.name),
    email: line(body.email),
    topic: text(body.topic) as Topic,
    message: text(body.message),
    page: line(body.page) || undefined,
  };
  const errors: SupportErrors = {};
  if (!value.name) errors.name = "Please enter your name.";
  else if (value.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (value.email.length > LIMITS.email || !EMAIL.test(value.email)) errors.email = "Please enter an email address we can reply to.";
  if (!TOPICS.some((topic) => topic.value === value.topic)) errors.topic = "Please choose what this is about.";
  if (value.message.length < LIMITS.minMessage) errors.message = "Please tell us a little more (at least 10 characters).";
  else if (value.message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message.toLocaleString("en")} characters.`;
  if (value.page && (value.page.length > LIMITS.page || !webAddress(value.page))) errors.page = "Please paste a web address starting with https://, or leave it empty.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface SupportEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

// The email sent to the maintainer. Replying goes straight to the person who wrote in.
export function buildSupportEmail(message: SupportMessage, route: { to: string; from: string }): SupportEmail {
  const topic = TOPICS.find((entry) => entry.value === message.topic)?.label ?? message.topic;
  const rows: [string, string][] = [
    ["From", `${message.name} <${message.email}>`],
    ["Topic", topic],
    ...(message.page ? ([["Page", message.page]] as [string, string][]) : []),
  ];
  const text = `${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${message.message}\n`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#1f2a5c">
<table style="border-collapse:collapse;margin-bottom:16px">${rows
    .map(([label, value]) => `<tr><td style="padding:2px 12px 2px 0;color:#4d5781">${label}</td><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`)
    .join("")}</table>
<div style="white-space:pre-wrap;border-left:3px solid #5370ce;padding-left:12px">${escapeHtml(message.message)}</div>
<p style="color:#4d5781;font-size:13px;margin-top:20px">Sent from the DevFiller support form. Reply to answer ${escapeHtml(message.name)} directly.</p>
</div>`;
  return { from: route.from, to: [route.to], reply_to: message.email, subject: `[DevFiller support] ${topic}: ${message.name}`, text, html };
}
