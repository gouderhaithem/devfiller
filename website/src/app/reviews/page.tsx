import type { Metadata } from "next";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewsSection } from "@/components/ReviewsSection";
import { listApprovedReviews } from "@/lib/reviews-db";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What developers and testers say about DevFiller, and a form to write your own review.",
};

// Approved reviews are read again at most every five minutes.
export const revalidate = 300;

export default async function ReviewsPage() {
  const reviews = await listApprovedReviews();
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Reviews</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">What people say</h1>
        <p className="mt-4 text-lg text-ink-soft">Reviews from the people who use DevFiller to test their forms.</p>
      </div>

      <ReviewsSection reviews={reviews} writeHref="#write" />

      <section id="write" className="mt-16 scroll-mt-24 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Write a review</h2>
        <p className="mt-2 text-ink-soft">Tell other developers and testers how DevFiller works for you. Reviews are checked before they appear.</p>
        <div className="mt-6">
          <ReviewForm />
        </div>
      </section>
    </main>
  );
}
