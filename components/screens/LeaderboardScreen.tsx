"use client";

import { useState } from "react";
import { BarChart3, Goal, Globe, Medal } from "lucide-react";
import { useAppState } from "@/store/AppContext";
import { getLeaderboardRows, getNearMissMessage, type LeaderboardScope } from "@/sim/selectors";
import { BADGE_CATALOG } from "@/sim/selectors";
import { BADGE_ICONS } from "@/components/ui/badgeIcons";
import StreakFlame from "@/components/ui/StreakFlame";

const SCOPES: Array<{ key: LeaderboardScope; label: string }> = [
  { key: "matchday", label: "Matchday" },
  { key: "season", label: "Season" },
  { key: "alltime", label: "All-time" },
];

const MEDAL_COLORS = ["text-gold-500", "text-slate-400", "text-amber-700"];

export default function LeaderboardScreen() {
  const state = useAppState();
  const [scope, setScope] = useState<LeaderboardScope>("matchday");
  const rows = getLeaderboardRows(state, scope);
  const nearMiss = getNearMissMessage(rows);
  const userRow = rows.find((r) => r.isUser);
  const userIndex = rows.findIndex((r) => r.isUser);
  const topRows = rows.slice(0, 15);
  const userIsOutsideTop = userIndex >= 15;

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h1 className="mb-3 text-lg font-bold text-ink">Leaderboard</h1>

      <div className="mb-4 flex gap-1 rounded-full bg-paper-dim p-1">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScope(s.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${
              scope === s.key ? "bg-pitch-800 text-white shadow-sm" : "text-ink-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {nearMiss && (
        <div className="mb-3 rounded-xl border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs font-medium text-gold-600">
          {nearMiss}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState scope={scope} />
      ) : (
        <div className="space-y-1.5">
          {topRows.map((row, i) => (
            <LeaderRow key={row.id} position={i + 1} row={row} />
          ))}
          {userIsOutsideTop && userRow && (
            <>
              <div className="py-1 text-center text-xs text-ink-soft">···</div>
              <LeaderRow position={userIndex + 1} row={userRow} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderRow({ position, row }: { position: number; row: ReturnType<typeof getLeaderboardRows>[number] }) {
  const notableBadge = row.badges[row.badges.length - 1];
  const NotableBadgeIcon = notableBadge ? BADGE_ICONS[BADGE_CATALOG[notableBadge].icon] : null;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
        row.isUser ? "border-pitch-700 bg-pitch-700/5" : "border-ink/5 bg-white"
      }`}
    >
      <span className="flex w-6 shrink-0 items-center justify-center text-sm font-bold text-ink-soft">
        {position <= 3 ? <Medal size={18} className={MEDAL_COLORS[position - 1]} /> : position}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-800 text-[10px] font-bold text-white">
        {row.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
        {row.country && <p className="truncate text-[10px] text-ink-soft">{row.country}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {NotableBadgeIcon && (
          <span title={notableBadge ? BADGE_CATALOG[notableBadge].label : undefined}>
            <NotableBadgeIcon size={15} className="text-gold-600" />
          </span>
        )}
        <StreakFlame streak={row.streak} />
        <span className="w-12 text-right text-sm font-bold text-ink">{row.points}</span>
      </div>
    </div>
  );
}

function EmptyState({ scope }: { scope: LeaderboardScope }) {
  const copy =
    scope === "matchday"
      ? { Icon: Goal, title: "The pitch is quiet", body: "Submit your picks and settle this matchday to see where you land." }
      : scope === "season"
        ? { Icon: BarChart3, title: "Season just kicked off", body: "Points from settled matchdays will stack up here." }
        : { Icon: Globe, title: "No lifetime points yet", body: "Play a few matchdays to start climbing the all-time table." };
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/10 py-10 text-center">
      <copy.Icon size={30} className="text-ink-soft/60" />
      <p className="text-sm font-semibold text-ink">{copy.title}</p>
      <p className="max-w-[220px] text-xs text-ink-soft">{copy.body}</p>
    </div>
  );
}
