"use client";

import { useEffect, useRef, useState } from "react";
import { generateValues, type FieldKey, type Locale } from "@ext/data";

// Mixed-language labels on purpose: the extension recognizes English, French and Arabic labels.
const FIELDS: { key: FieldKey; label: string; dir?: "rtl"; wide?: boolean; multiline?: boolean }[] = [
  { key: "firstName", label: "Prénom" },
  { key: "lastName", label: "اللقب", dir: "rtl" },
  { key: "email", label: "Adresse électronique", wide: true },
  { key: "phone", label: "Phone number" },
  { key: "company", label: "Company" },
  { key: "city", label: "Ville" },
  { key: "country", label: "Country" },
  { key: "message", label: "Message", wide: true, multiline: true },
];

const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية" },
];

type Values = Partial<Record<FieldKey, string>>;
const STEP_MS = 70;

export function FillDemo() {
  const [locale, setLocale] = useState<Locale>("en");
  const [values, setValues] = useState<Values>({});
  const [filled, setFilled] = useState<Set<FieldKey>>(new Set());
  const [round, setRound] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function fill() {
    timers.current.forEach(clearTimeout);
    const generated = generateValues(locale);
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRound((r) => r + 1);
    setFilled(new Set());
    FIELDS.forEach((field, index) => {
      const apply = () => {
        setValues((current) => ({ ...current, [field.key]: generated[field.key] }));
        setFilled((current) => new Set(current).add(field.key));
      };
      if (instant) apply();
      else timers.current.push(window.setTimeout(apply, index * STEP_MS));
    });
  }

  const done = filled.size === FIELDS.length;
  const inputClass = (key: FieldKey) =>
    `mt-1.5 block w-full rounded-md border border-mist bg-paper px-3 py-2 text-[0.95rem] text-ink placeholder:text-ink-soft/50 focus:border-brand focus:outline-none ${filled.has(key) ? "field-filled" : ""}`;

  return (
    <div className="rounded-2xl bg-ivory p-5 text-ink shadow-[0_24px_60px_-20px_rgba(20,30,90,0.55)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.95rem] font-semibold">Create your account</p>
        <div role="radiogroup" aria-label="Language for generated data" className="flex rounded-lg bg-mist p-0.5 text-sm">
          {LOCALES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={locale === option.id}
              onClick={() => setLocale(option.id)}
              className={`rounded-md px-2.5 py-1 ${locale === option.id ? "bg-paper font-medium text-ink shadow-sm" : "text-ink-soft"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <form className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3.5" onSubmit={(event) => event.preventDefault()}>
        {FIELDS.map((field) => (
          <label key={`${field.key}-${round}`} className={`block text-sm text-ink-soft ${field.wide ? "col-span-2" : ""}`} dir={field.dir}>
            {field.label}
            {field.multiline ? (
              <textarea
                rows={2}
                dir="auto"
                value={values[field.key] ?? ""}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                className={`${inputClass(field.key)} resize-none`}
              />
            ) : (
              <input
                dir="auto"
                value={values[field.key] ?? ""}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                className={inputClass(field.key)}
              />
            )}
          </label>
        ))}
        <label className="block text-sm text-ink-soft">
          Password
          <input type="password" disabled placeholder="Left empty" className={inputClass("password")} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink-soft">
          <input type="checkbox" disabled className="size-4 accent-brand" />
          I accept the terms
        </label>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={fill}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-paper hover:bg-tile-deep"
        >
          {round ? "Fill again" : "Fill this form"}
        </button>
        <p className="text-sm text-ink-soft" aria-live="polite">
          {done
            ? `${FIELDS.length} fields filled. The password and terms box were left alone on purpose.`
            : "Runs the same generator as the extension, right here in your browser."}
        </p>
      </div>
    </div>
  );
}
