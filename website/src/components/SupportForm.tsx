"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LIMITS, TOPICS, validateSupport, type SupportErrors, type SupportField } from "@/lib/support";

type Status = { kind: "idle" | "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const EMPTY = { name: "", email: "", topic: "", message: "", page: "" };

const inputClass = (invalid: boolean) =>
  `mt-1.5 block w-full rounded-lg border bg-paper px-3 py-2.5 text-ink shadow-sm outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brand focus:ring-2 focus:ring-brand/25 ${
    invalid ? "border-red-400" : "border-mist"
  }`;

export function SupportForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<SupportErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const shownAt = useRef(0);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // When the form was shown: the server ignores messages sent faster than a person can type.
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const update = (field: SupportField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const honeypot = new FormData(event.currentTarget).get("leave_empty");
    const checked = validateSupport(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = Object.keys(checked.errors)[0];
      document.getElementById(`support-${first}`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/support/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...checked.value, leave_empty: honeypot ?? "", elapsedMs: Math.round(performance.now() - shownAt.current) }),
      });
      const result = (await response.json().catch(() => null)) as { success?: boolean; error?: string; errors?: SupportErrors } | null;
      if (response.ok && result?.success) {
        setStatus({ kind: "sent" });
        setValues(EMPTY);
      } else {
        if (result?.errors) setErrors(result.errors);
        setStatus({ kind: "error", message: result?.error || "Your message couldn’t be sent. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "You seem to be offline. Please check your connection and try again." });
    }
    statusRef.current?.focus();
  }

  if (status.kind === "sent")
    return (
      <div className="rounded-2xl border border-mist bg-mint-pale/60 p-8" role="status">
        <p className="text-xl font-semibold">Thanks, your message is on its way.</p>
        <p className="mt-2 text-ink-soft">You’ll get a reply at the email address you gave, usually within two working days.</p>
        <button type="button" onClick={() => setStatus({ kind: "idle" })} className="mt-6 rounded-lg px-4 py-2 font-medium text-brand ring-1 ring-mist hover:ring-brand">
          Send another message
        </button>
      </div>
    );

  const field = (name: SupportField) => ({
    id: `support-${name}`,
    name,
    value: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `support-${name}-error` : undefined,
  });
  const error = (name: SupportField) =>
    errors[name] ? (
      <span id={`support-${name}-error`} className="mt-1.5 block text-sm text-red-600">
        {errors[name]}
      </span>
    ) : null;

  return (
    <form noValidate onSubmit={submit} className="rounded-2xl border border-mist bg-paper p-5 shadow-[0_12px_40px_-20px_rgba(20,30,90,0.35)] sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-[0.95rem] font-medium">
          Your name
          <input {...field("name")} autoComplete="name" maxLength={LIMITS.name} onChange={(e) => update("name", e.target.value)} className={inputClass(!!errors.name)} />
          {error("name")}
        </label>
        <label className="block text-[0.95rem] font-medium">
          Email for the reply
          <input {...field("email")} type="email" autoComplete="email" maxLength={LIMITS.email} onChange={(e) => update("email", e.target.value)} className={inputClass(!!errors.email)} />
          {error("email")}
        </label>
        <label className="block text-[0.95rem] font-medium sm:col-span-2">
          What is it about?
          <select {...field("topic")} onChange={(e) => update("topic", e.target.value)} className={inputClass(!!errors.topic)}>
            <option value="" disabled>
              Choose a topic
            </option>
            {TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
          {error("topic")}
        </label>
        <label className="block text-[0.95rem] font-medium sm:col-span-2">
          Message
          <textarea
            {...field("message")}
            rows={7}
            maxLength={LIMITS.message}
            placeholder="What happened, what you expected, and the steps to see it again."
            onChange={(e) => update("message", e.target.value)}
            className={`${inputClass(!!errors.message)} resize-y`}
          />
          <span className="mt-1 flex justify-between gap-3 text-sm text-ink-soft">
            {error("message") ?? <span>Please don’t include passwords or real personal data from your forms.</span>}
            <span className="shrink-0 tabular-nums">
              {values.message.length.toLocaleString("en")} / {LIMITS.message.toLocaleString("en")}
            </span>
          </span>
        </label>
        <label className="block text-[0.95rem] font-medium sm:col-span-2">
          Page where it happened <span className="font-normal text-ink-soft">(optional)</span>
          <input {...field("page")} type="url" inputMode="url" placeholder="https://" maxLength={LIMITS.page} onChange={(e) => update("page", e.target.value)} className={inputClass(!!errors.page)} />
          {error("page")}
        </label>
        {/* Left empty by people; bots that fill every field give themselves away. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this empty
            <input name="leave_empty" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="rounded-lg bg-linear-to-b from-tile-light to-tile-deep px-5 py-2.5 font-medium text-paper shadow-[0_2px_10px_-3px_rgb(60_96_220/0.6)] transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {status.kind === "sending" ? "Sending…" : "Send message"}
        </button>
        <p ref={statusRef} tabIndex={-1} aria-live="polite" className={`text-sm outline-none ${status.kind === "error" ? "text-red-600" : "text-ink-soft"}`}>
          {status.kind === "error" ? status.message : "Your message goes by email to the maintainer. It isn’t stored on the website."}
        </p>
      </div>
    </form>
  );
}
