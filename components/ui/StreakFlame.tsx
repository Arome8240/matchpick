import { Flame } from "lucide-react";

export default function StreakFlame({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  const size = streak >= 5 ? 16 : streak >= 3 ? 14 : 12;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gold-600">
      <Flame size={size} className="fill-gold-500 text-gold-600" />
      {streak}
    </span>
  );
}
