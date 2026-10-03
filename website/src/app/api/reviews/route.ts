import { revalidatePath } from "next/cache";
import { createRateLimiter } from "@/lib/rate-limit";
import { createReviewHandler } from "@/lib/review-handler";
import { insertReview } from "@/lib/reviews-db";

// The review form's endpoint: validates the review, stores it in Neon Postgres and refreshes the
// homepage and /reviews/ so it shows at once. DATABASE_URL comes from Vercel's environment, never
// from this repository.
export const runtime = "nodejs";

const handler = createReviewHandler({
  insert: insertReview,
  published: () => {
    revalidatePath("/");
    revalidatePath("/reviews");
  },
  allow: createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 }),
  now: Date.now,
  log: (message, detail) => console.error(message, detail ?? ""),
});

export async function POST(request: Request) {
  return handler(request);
}
