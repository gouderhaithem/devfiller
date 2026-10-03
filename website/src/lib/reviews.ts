// Reviews: their limits, validation and summary. Shared by the form in the browser and the
// /api/reviews route, so both apply the same rules.

export const REVIEW_LIMITS = { name: 80, role: 80, comment: 1000, minComment: 10 } as const;

export interface ReviewInput {
  name: string;
  role?: string;
  rating: number;
  comment: string;
}

export interface Review extends ReviewInput {
  id: number;
  createdAt: string;
}

export type ReviewField = keyof ReviewInput;
export type ReviewErrors = Partial<Record<ReviewField, string>>;
export type ReviewValidation = { ok: true; value: ReviewInput } | { ok: false; errors: ReviewErrors };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
// A single line: line breaks become spaces, and invisible control or text-direction characters
// (which can disguise a name) are removed.
const line = (value: unknown) =>
  text(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

export function validateReview(input: unknown): ReviewValidation {
  if (!input || typeof input !== "object") return { ok: false, errors: { comment: "Please fill in the form." } };
  const body = input as Record<string, unknown>;
  const value: ReviewInput = { name: line(body.name), role: line(body.role) || undefined, rating: body.rating as number, comment: text(body.comment) };
  const errors: ReviewErrors = {};
  if (!value.name) errors.name = "Please tell us your name.";
  else if (value.name.length > REVIEW_LIMITS.name) errors.name = `Please keep your name under ${REVIEW_LIMITS.name} characters.`;
  if (value.role && value.role.length > REVIEW_LIMITS.role) errors.role = `Please keep your role under ${REVIEW_LIMITS.role} characters.`;
  if (typeof value.rating !== "number" || !Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5) errors.rating = "Please choose from 1 to 5 stars.";
  if (value.comment.length < REVIEW_LIMITS.minComment) errors.comment = `Please write at least ${REVIEW_LIMITS.minComment} characters.`;
  else if (value.comment.length > REVIEW_LIMITS.comment) errors.comment = `Please keep your review under ${REVIEW_LIMITS.comment} characters.`;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

// How many reviews, and their average to one decimal (none without reviews).
export function summarize(reviews: readonly Pick<Review, "rating">[]): { count: number; average: number | null } {
  if (!reviews.length) return { count: 0, average: null };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { count: reviews.length, average: Math.round((total / reviews.length) * 10) / 10 };
}

// Presentation: a name with capitals ("islam mohamed" → "Islam Mohamed"), leaving the rest of each
// word as typed; scripts without case (Arabic) are unchanged.
export function displayName(name: string): string {
  return name.replace(/(^|\s)(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase());
}

// The avatar's letters: the first letters of the first and last words.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase();
}

// The avatar's colour, always the same for a name: one of the site's tones.
export const AVATAR_TONES = ["from-tile-light to-tile-deep", "from-emerald-400 to-teal-600", "from-amber-400 to-orange-500", "from-violet-400 to-indigo-600", "from-rose-400 to-pink-600", "from-sky-400 to-blue-600"] as const;
export function avatarTone(name: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// How many reviews gave each number of stars, five first.
export function distribution(reviews: readonly Pick<Review, "rating">[]): { stars: number; count: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((review) => review.rating === stars).length }));
}
