"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "@/store/AppContext";
import { getUserPicks, hasUserSubmitted } from "@/sim/engine";
import FixtureCard from "@/components/FixtureCard";
import PointsTicker from "@/components/ui/PointsTicker";
import Confetti from "@/components/ui/Confetti";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Outcome, Score } from "@/sim/types";

export default function PlayScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { matchday, clock } = state;
  const picks = getUserPicks(state);
  const submitted = hasUserSubmitted(state);
  const settled = matchday.status === "settled";
  const [showConfetti, setShowConfetti] = useState(false);
  const prevStatus = useRef(matchday.status);

  useEffect(() => {
    if (prevStatus.current !== "settled" && matchday.status === "settled") {
      const wonPrize = matchday.prizes?.some((p) => p.playerId === "user");
      if (wonPrize) setShowConfetti(true);
    }
    prevStatus.current = matchday.status;
  }, [matchday.status, matchday.prizes]);

  const earliestKickoff = Math.min(...matchday.fixtures.map((f) => f.kickoff));
  const allLocked = matchday.fixtures.every((f) => clock >= f.kickoff);
  const userScore = matchday.scores?.find((s) => s.playerId === "user");
  const userPrize = matchday.prizes
    ?.filter((p) => p.playerId === "user")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <Confetti active={showConfetti} />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">Matchday {state.currentMatchdayIndex + 1} of 4</h1>
          <p className="text-xs text-ink-soft">Season {state.season}</p>
        </div>
        {!settled && (
          <div className="text-right">
            <p className="text-[11px] text-ink-soft">{allLocked ? "Slate locked" : "First kickoff in"}</p>
            {!allLocked && <p className="text-sm font-bold text-pitch-800">{formatDuration(earliestKickoff - clock)}</p>}
          </div>
        )}
      </div>

      {settled && userScore && (
        <div className="mb-4 rounded-2xl bg-pitch-900 p-4 text-white animate-pop-in">
          <p className="text-xs font-medium text-white/60">Matchday result</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gold-300">
              <PointsTicker value={userScore.totalPoints} />
            </span>
            <span className="text-sm text-white/70">points</span>
            {userScore.multiplier > 1 && (
              <span className="ml-1 rounded-full bg-gold-400/20 px-2 py-0.5 text-[11px] font-semibold text-gold-300">
                ×{userScore.multiplier.toFixed(2)} streak
              </span>
            )}
          </div>
          {userScore.perfectBonus > 0 && (
            <p className="mt-1 text-xs font-semibold text-gold-300">🎯 Perfect matchday bonus +{userScore.perfectBonus}!</p>
          )}
          {!!userPrize && userPrize > 0 && (
            <p className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-bold text-gold-300">
              🎉 You won {formatMoney(userPrize)} from the prize pool!
            </p>
          )}
        </div>
      )}

      {!submitted && !settled && (
        <p className="mb-3 text-xs leading-relaxed text-ink-soft">
          Pick a result for each fixture. Submit before kickoff — pick % breakdowns unlock right after you submit.
        </p>
      )}

      <div className="space-y-3">
        {matchday.fixtures.map((fixture) => {
          const pick = picks.find((p) => p.fixtureId === fixture.id);
          const result = matchday.results?.find((r) => r.fixtureId === fixture.id);
          const breakdown = userScore?.breakdown.find((b) => b.fixtureId === fixture.id);
          const distribution = matchday.pickDistribution?.find((d) => d.fixtureId === fixture.id);
          return (
            <FixtureCard
              key={fixture.id}
              fixture={fixture}
              clock={clock}
              pick={pick}
              interactive={!submitted && !settled}
              distribution={distribution}
              result={result}
              breakdown={breakdown}
              onSetOutcome={(outcome: Outcome) => dispatch({ type: "SET_PICK", fixtureId: fixture.id, outcome })}
              onSetExactScore={(score: Score | undefined) =>
                dispatch({ type: "SET_EXACT_SCORE", fixtureId: fixture.id, score })
              }
            />
          );
        })}
      </div>

      {!submitted && !settled && (
        <div className="sticky bottom-16 mt-4">
          <button
            type="button"
            disabled={picks.length === 0}
            onClick={() => dispatch({ type: "SUBMIT_PICKS" })}
            className="w-full rounded-full bg-pitch-800 py-3.5 text-sm font-bold text-white shadow-lg shadow-pitch-900/20 disabled:opacity-40"
          >
            {picks.length === 0
              ? "Make at least one pick"
              : `Submit slate · ${picks.length}/8 picks · Free entry`}
          </button>
        </div>
      )}

      {submitted && !settled && (
        <div className="mt-4 rounded-2xl border border-dashed border-pitch-700/30 bg-pitch-700/5 p-4 text-center">
          <p className="text-sm font-semibold text-pitch-800">Slate locked in ✅</p>
          <p className="mt-1 text-xs text-ink-soft">
            Results land once this matchday settles. Use the sim panel to advance time and settle.
          </p>
        </div>
      )}
    </div>
  );
}
