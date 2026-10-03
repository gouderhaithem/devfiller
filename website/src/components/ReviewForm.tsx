"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { REVIEW_LIMITS, validateReview, type ReviewErrors, type ReviewField } from "@/lib/reviews";

type Status = { kind: "idle" | "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const EMPTY = { name: "", role: "", rating: 0, comment: "" };
const STAR_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

const inputClass = (invalid: boolean) =>
  `mt-1.5 block w-full rounded-lg border bg-paper px-3 py-2.5 text-ink shadow-sm outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brand focus:ring-2 focus:ring-brand/25 ${
    invalid ? "border-red-400" : "border-mist"
  }`;

export function ReviewForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const shownAt = useRef(0);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // When the form was shown: the server ignores reviews sent faster than a person can type.
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const update = (field: ReviewField, value: string | number) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const honeypot = new FormData(event.currentTarget).get("leave_empty");
    const checked = validateReview(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      document.getElementById(`review-${Object.keys(checked.errors)[0]}`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/reviews/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...checked.value, leave_empty: honeypot ?? "", elapsedMs: Math.round(performance.now() - shownAt.current) }),
      });
      const result = (await response.json().catch(() => null)) as { success?: boolean; error?: string; errors?: ReviewErrors } | null;
      if (response.ok && result?.success) {
        setStatus({ kind: "sent" });
        setValues(EMPTY);
      } else {
        if (result?.errors) setErrors(result.errors);
        setStatus({ kind: "error", message: result?.error || "Your review couldn’t be sent. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "You seem to be offline. Please check your connection and try again." });
    }
    statusRef.current?.focus();
  }

  if (status.kind === "sent")
    return (
      <div className="rounded-2xl border border-mist bg-mint-pale/60 p-8" role="status">
        <p className="text-xl font-semibold">Thank you for your review.</p>
        <p className="mt-2 text-ink-soft">It will appear here once it has been checked, usually within a day or two.</p>
        <button type="button" onClick={() => setStatus({ kind: "idle" })} className="mt-6 rounded-lg px-4 py-2 font-medium text-brand ring-1 ring-mist hover:ring-brand">
          Write another review
        </button>
      </div>
    );

  const error = (name: ReviewField) =>
    errors[name] ? (
      <span id={`review-${name}-error`} className="mt-1.5 block text-sm text-red-600">
        {errors[name]}
      </span>
    ) : null;
  const described = (name: ReviewField) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `review-${name}-error` : undefined });

  return (
    <form noValidate onSubmit={submit} className="rounded-2xl border border-mist bg-paper p-5 shadow-[0_12px_40px_-20px_rgba(20,30,90,0.35)] sm:p-8">
      <fieldset id="review-rating" tabIndex={-1} className="outline-none" {...described("rating")}>
        <legend className="text-[0.95rem] font-medium">Your rating</legend>
        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="cursor-pointer">
              <input type="radio" name="rating" value={star} checked={values.rating === star} onChange={() => update("rating", star)} className="peer sr-only" />
              <span
                aria-hidden="true"
                className={`block text-3xl leading-none transition-colors peer-focus-visible:rounded peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 ${star <= values.rating ? "text-amber-500" : "text-mist hover:text-amber-300"}`}
              >
                ★
              </span>
              <span className="sr-only">
                {star} star{star === 1 ? "" : "s"}, {STAR_WORDS[star]}
              </span>
            </label>
          ))}
          <span className="ml-3 text-sm text-ink-soft">{STAR_WORDS[values.rating] || "Choose from 1 to 5 stars"}</span>
        </div>
        {error("rating")}
      </fieldset>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block text-[0.95rem] font-medium">
          Your name
          <input id="review-name" name="name" value={values.name} autoComplete="name" maxLength={REVIEW_LIMITS.name} onChange={(e) => update("name", e.target.value)} className={inputClass(!!errors.name)} {...described("name")} />
          {error("name")}
        </label>
        <label className="block text-[0.95rem] font-medium">
          Your role <span className="font-normal text-ink-soft">(optional)</span>
          <input
            id="review-role"
            name="role"
            value={values.role}
            placeholder="QA engineer, front-end developer…"
            maxLength={REVIEW_LIMITS.role}
            onChange={(e) => update("role", e.target.value)}
            className={inputClass(!!errors.role)}
            {...described("role")}
          />
          {error("role")}
        </label>
        <label className="block text-[0.95rem] font-medium sm:col-span-2">
          Your review
          <textarea
            id="review-comment"
            name="comment"
            value={values.comment}
            rows={5}
            maxLength={REVIEW_LIMITS.comment}
            placeholder="What do you use DevFiller for, and how has it worked for you?"
            onChange={(e) => update("comment", e.target.value)}
            className={`${inputClass(!!errors.comment)} resize-y`}
            {...described("comment")}
          />
          <span className="mt-1 flex justify-between gap-3 text-sm text-ink-soft">
            {error("comment") ?? <span>Your name, role and review are shown publicly once approved.</span>}
            <span className="shrink-0 tabular-nums">
              {values.comment.length.toLocaleString("en")} / {REVIEW_LIMITS.comment.toLocaleString("en")}
            </span>
          </span>
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
          {status.kind === "sending" ? "Sending…" : "Send review"}
        </button>
        <p ref={statusRef} tabIndex={-1} aria-live="polite" className={`text-sm outline-none ${status.kind === "error" ? "text-red-600" : "text-ink-soft"}`}>
          {status.kind === "error" ? status.message : "Reviews are checked before they appear, to keep spam out."}
        </p>
      </div>
    </form>
  );
}
