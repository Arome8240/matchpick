"use client";

import { useState } from "react";
import { useAppDispatch, useAppState } from "@/store/AppContext";
import { nextRankInfo } from "@/sim/engine";
import { generateReferralLink } from "@/store/AppContext";
import { ALL_BADGES, BADGE_CATALOG } from "@/sim/selectors";
import BadgeChip from "@/components/ui/BadgeChip";
import StreakFlame from "@/components/ui/StreakFlame";

export default function ProfileScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { user } = state;
  const { rank, next, pointsToNext } = nextRankInfo(user.lifetimePoints);
  const [copied, setCopied] = useState(false);
  const referralLink = generateReferralLink(state);

  function copyReferral() {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h1 className="mb-3 text-lg font-bold text-ink">Profile</h1>

      <div className="rounded-2xl bg-pitch-900 p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-lg font-extrabold text-gold-300">
            YOU
          </span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold">{rank}</p>
            <p className="truncate font-mono text-[11px] text-white/50">{user.address}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-white/70">Lifetime points</span>
          <span className="font-bold text-gold-300">{user.lifetimePoints}</span>
        </div>
        {next ? (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gold-400"
                style={{ width: `${Math.min(100, 100 - ((pointsToNext ?? 0) / RANK_SPAN[rank]) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/50">{pointsToNext} pts to {next}</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-gold-300">Max rank reached 🏆</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-ink/5 bg-white p-3.5 text-center">
          <p className="text-[11px] font-medium text-ink-soft">Streak</p>
          <div className="mt-1 flex items-center justify-center gap-1 text-xl font-extrabold text-ink">
            <StreakFlame streak={user.streak} />
            {user.streak === 0 && <span className="text-ink-soft text-sm">None yet</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-ink/5 bg-white p-3.5 text-center">
          <p className="text-[11px] font-medium text-ink-soft">Streak shields</p>
          <p className="mt-1 text-xl font-extrabold text-ink">{user.streakShields}</p>
        </div>
      </div>

      <h2 className="mb-2 mt-5 text-sm font-bold text-ink">Badge cabinet</h2>
      <div className="grid grid-cols-4 gap-2">
        {ALL_BADGES.map((badge) => (
          <BadgeChip key={badge} badge={badge} locked={!user.badges.includes(badge)} />
        ))}
      </div>

      <h2 className="mb-2 mt-5 text-sm font-bold text-ink">Season history</h2>
      {user.seasonHistory.length === 0 ? (
        <p className="text-xs text-ink-soft">Finish your first 4-matchday season to see history here.</p>
      ) : (
        <div className="space-y-1.5">
          {user.seasonHistory.map((entry) => (
            <div key={entry.season} className="flex items-center justify-between rounded-xl border border-ink/5 bg-white px-3 py-2.5 text-xs">
              <span className="font-semibold text-ink">Season {entry.season}</span>
              <span className="text-ink-soft">Rank #{entry.finalRankPosition}</span>
              <span className="font-bold text-pitch-700">{entry.finalSeasonPoints} pts</span>
              <span className="flex gap-0.5">
                {entry.badgesEarned.map((b) => (
                  <span key={b} title={BADGE_CATALOG[b].label}>
                    {BADGE_CATALOG[b].icon}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-5 text-sm font-bold text-ink">Invite friends</h2>
      <div className="rounded-2xl border border-ink/5 bg-white p-3.5">
        <p className="text-xs text-ink-soft">
          Earn a streak shield and a referral bonus when a friend joins with your link. Shields protect one missed matchday.
        </p>
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-paper px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-soft">{referralLink}</span>
          <button type="button" onClick={copyReferral} className="shrink-0 text-[11px] font-bold text-pitch-700">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "SIMULATE_REFERRAL" })}
          className="mt-2.5 w-full rounded-full bg-pitch-800 py-2.5 text-xs font-bold text-white active:scale-[0.98]"
        >
          Simulate a friend joining
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-soft">{user.referralsCompleted} friend(s) joined so far</p>
      </div>
    </div>
  );
}

const RANK_SPAN: Record<string, number> = {
  Amateur: 500,
  "Semi-Pro": 1000,
  Pro: 2500,
  Legend: 1,
};
