import type { Badge } from "@/sim/types";
import { BADGE_CATALOG } from "@/sim/selectors";

export default function BadgeChip({ badge, locked = false }: { badge: Badge; locked?: boolean }) {
  const info = BADGE_CATALOG[badge];
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-3 text-center ${
        locked ? "border-ink/10 bg-paper-dim opacity-50" : "border-gold-400/40 bg-white shadow-sm"
      }`}
    >
      <span className={`text-2xl ${locked ? "grayscale" : ""}`} aria-hidden>
        {info.icon}
      </span>
      <span className="w-full break-words text-[11px] font-semibold leading-tight text-ink">{info.label}</span>
      {locked && <span className="w-full break-words text-[10px] leading-tight text-ink-soft">{info.hint}</span>}
    </div>
  );
}
