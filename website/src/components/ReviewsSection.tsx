import Link from "next/link";
import { ReviewStars } from "@/components/ReviewStars";
import { summarize, type Review } from "@/lib/reviews";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The reviews people approved for the site: their average, then the reviews themselves, or an
// invitation to write the first one.
export function ReviewsSection({ reviews, limit, writeHref = "/reviews/#write" }: { reviews: readonly Review[]; limit?: number; writeHref?: string }) {
  const { count, average } = summarize(reviews);
  const shown = limit ? reviews.slice(0, limit) : reviews;

  if (!count)
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-mist px-6 py-12 text-center">
        <ReviewStars rating={0} size="text-3xl" />
        <p className="mt-4 text-xl font-semibold">No reviews yet</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">DevFiller is new on the Chrome Web Store. If it saved you some typing, be the first to say so.</p>
        <Link href={writeHref} className="mt-6 inline-block rounded-lg bg-linear-to-b from-tile-light to-tile-deep px-5 py-3 font-medium text-paper shadow-[0_2px_10px_-3px_rgb(60_96_220/0.6)] transition-[filter] hover:brightness-110">
          Write the first review
        </Link>
      </div>
    );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <ReviewStars rating={average ?? 0} size="text-2xl" />
        <p className="text-ink-soft">
          <span className="font-semibold text-ink">{average?.toFixed(1)}</span> out of 5, from {count} review{count === 1 ? "" : "s"}
        </p>
        <Link href={writeHref} className="ml-auto font-medium text-brand underline underline-offset-4">
          Write a review
        </Link>
      </div>
      <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((review) => (
          <li key={review.id} className="rounded-2xl border border-mist p-6">
            <ReviewStars rating={review.rating} />
            <p className="mt-3 whitespace-pre-line text-ink">{review.comment}</p>
            <p className="mt-4 text-sm text-ink-soft">
              <span className="font-medium text-ink">{review.name}</span>
              {review.role ? `, ${review.role}` : ""} · {date(review.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
