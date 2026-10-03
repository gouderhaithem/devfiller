import Link from "next/link";
import { ReviewStars } from "@/components/ReviewStars";
import { avatarTone, displayName, distribution, initials, summarize, type Review } from "@/lib/reviews";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const primaryButton =
  "inline-block rounded-lg bg-linear-to-b from-tile-light to-tile-deep px-5 py-3 text-center font-medium text-paper shadow-[0_2px_10px_-3px_rgb(60_96_220/0.6)] transition-[filter] hover:brightness-110";

// The published reviews: their score and how the stars spread, then the reviews themselves; or,
// with none yet, an invitation to write the first one.
export function ReviewsSection({ reviews, limit, writeHref = "/reviews/#write" }: { reviews: readonly Review[]; limit?: number; writeHref?: string }) {
  const { count, average } = summarize(reviews);
  const shown = limit ? reviews.slice(0, limit) : reviews;

  if (!count)
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-mist px-6 py-12 text-center">
        <ReviewStars rating={0} size="text-3xl" />
        <p className="mt-4 text-xl font-semibold">No reviews yet</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">DevFiller is new on the Chrome Web Store. If it saved you some typing, be the first to say so.</p>
        <Link href={writeHref} className={`mt-6 ${primaryButton}`}>
          Write the first review
        </Link>
      </div>
    );

  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-mist bg-ivory p-6 lg:sticky lg:top-24">
        <p className="flex items-baseline gap-2">
          <span className="text-5xl font-semibold tracking-tight">{average?.toFixed(1)}</span>
          <span className="text-ink-soft">out of 5</span>
        </p>
        <div className="mt-2">
          <ReviewStars rating={average ?? 0} size="text-2xl" />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Based on {count} review{count === 1 ? "" : "s"}
        </p>
        <ul className="mt-5 space-y-1.5" aria-label="Reviews by rating">
          {distribution(reviews).map(({ stars, count: n }) => (
            <li key={stars} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="w-8 shrink-0 tabular-nums">
                {stars} <span aria-hidden="true" className="text-amber-500">★</span>
                <span className="sr-only">stars</span>
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(100 * n) / count}%` }} />
              </span>
              <span className="w-5 shrink-0 text-right tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
        <Link href={writeHref} className={`mt-6 w-full ${primaryButton}`}>
          Write a review
        </Link>
      </aside>

      <div>
        <ul className={`grid gap-5 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}>
          {shown.map((review) => (
            <li key={review.id} className="flex flex-col rounded-2xl border border-mist bg-paper p-6 shadow-[0_14px_40px_-28px_rgba(20,30,90,0.45)]">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br ${avatarTone(review.name)} text-sm font-semibold text-white shadow-sm ring-2 ring-paper`}
                >
                  {initials(review.name)}
                </span>
                <div className="min-w-0">
                  <p dir="auto" className="truncate font-semibold text-ink">
                    {displayName(review.name)}
                  </p>
                  {review.role ? (
                    <p dir="auto" className="truncate text-sm text-ink-soft">
                      {review.role}
                    </p>
                  ) : null}
                </div>
                <time dateTime={review.createdAt} className="ml-auto shrink-0 text-sm text-ink-soft">
                  {date(review.createdAt)}
                </time>
              </div>
              <div className="mt-4">
                <ReviewStars rating={review.rating} size="text-base" />
              </div>
              <blockquote dir="auto" className="mt-3 whitespace-pre-line leading-relaxed text-ink">
                “{review.comment}”
              </blockquote>
            </li>
          ))}
        </ul>
        {limit && count > limit ? (
          <Link href="/reviews/" className="mt-5 inline-block font-medium text-brand underline underline-offset-4">
            Read all {count} reviews
          </Link>
        ) : null}
      </div>
    </div>
  );
}
