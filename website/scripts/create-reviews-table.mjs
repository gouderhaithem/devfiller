// Creates the reviews table in the Neon database named by DATABASE_URL (from the environment or
// website/.env.local, never from this file). Safe to run again.
//
//   cd website && node scripts/create-reviews-table.mjs
import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const local = resolve(import.meta.dirname, "../.env.local");
const fromFile = existsSync(local) ? readFileSync(local, "utf8").match(/^DATABASE_URL=['"]?([^'"\n]+)/m)?.[1] : undefined;
const url = process.env.DATABASE_URL || fromFile;
if (!url) {
  console.error("Set DATABASE_URL, or put it in website/.env.local.");
  process.exit(1);
}

const sql = neon(url);
await sql`
  CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    role TEXT CHECK (role IS NULL OR char_length(role) <= 80),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 1000),
    approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS reviews_approved_created ON reviews (approved, created_at DESC)`;
// Reviews are published at once (approved = false hides one); tables made before that kept false.
await sql`ALTER TABLE reviews ALTER COLUMN approved SET DEFAULT TRUE`;
const [{ total, shown }] = await sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE approved)::int AS shown FROM reviews`;
console.log(`reviews table ready: ${total} reviews, ${shown} approved`);
