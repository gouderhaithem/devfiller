// A rating shown as five stars, with the number for screen readers.
export function ReviewStars({ rating, size = "text-lg" }: { rating: number; size?: string }) {
  const full = Math.round(rating);
  return (
    <span className={`inline-flex ${size} leading-none`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true" className={star <= full ? "text-amber-500" : "text-mist"}>
          ★
        </span>
      ))}
    </span>
  );
}
