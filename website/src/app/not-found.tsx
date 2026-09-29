import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-4 text-ink-soft">The link may be old. Start from the documentation or the home page.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/docs/" className="rounded-lg bg-brand px-5 py-2.5 font-medium text-paper hover:bg-tile-deep">
          Open the docs
        </Link>
        <Link href="/" className="rounded-lg px-5 py-2.5 font-medium text-ink ring-1 ring-mist hover:ring-brand">
          Go home
        </Link>
      </div>
    </main>
  );
}
