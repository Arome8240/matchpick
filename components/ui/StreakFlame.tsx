export default function StreakFlame({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  const size = streak >= 5 ? "text-base" : streak >= 3 ? "text-sm" : "text-xs";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold text-gold-600 ${size}`}>
      <span aria-hidden>🔥</span>
      {streak}
    </span>
  );
}
