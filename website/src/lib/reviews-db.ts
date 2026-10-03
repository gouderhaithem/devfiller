import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Review, ReviewInput } from "./reviews";

// Reviews live in Neon Postgres, named by DATABASE_URL in Vercel's environment (and in
// website/.env.local for local work), never in this repository. Queries are tagged templates,
// so every value is sent as a parameter.

const client = () => {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : undefined;
};

// The approved reviews, newest first. Without a database, or when it can't be reached, the site
// shows its empty state rather than failing.
export async function listApprovedReviews(limit = 50): Promise<Review[]> {
  const sql = client();
  if (!sql) return [];
  try {
    const rows = await sql`SELECT id, name, role, rating, comment, created_at FROM reviews WHERE approved ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((row) => ({ id: Number(row.id), name: row.name, role: row.role ?? undefined, rating: Number(row.rating), comment: row.comment, createdAt: new Date(row.created_at).toISOString() }));
  } catch (error) {
    console.error("Reviews could not be read", error);
    return [];
  }
}

// Stores a review unapproved: it appears once the maintainer approves it.
export async function insertReview(review: ReviewInput): Promise<void> {
  const sql = client();
  if (!sql) throw new Error("DATABASE_URL is not set");
  await sql`INSERT INTO reviews (name, role, rating, comment) VALUES (${review.name}, ${review.role ?? null}, ${review.rating}, ${review.comment})`;
}
