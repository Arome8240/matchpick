"use client";

import { useAppDispatch, useAppState } from "@/store/AppContext";
import { HOUR_MS } from "@/sim/engine";
import { formatSimTimestamp } from "@/lib/format";

export default function SimPanel({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { matchday, clock, settings } = state;

  const nextKickoff = Math.min(...matchday.fixtures.filter((f) => f.kickoff > clock).map((f) => f.kickoff));
  const canAdvanceToKickoff = Number.isFinite(nextKickoff);
  const hoursToKickoff = canAdvanceToKickoff ? Math.max(1, Math.ceil((nextKickoff - clock) / HOUR_MS)) : 0;

  function resetSeason() {
    if (window.confirm("Reset the current season? Lifetime points and wallet history stay intact.")) {
      dispatch({ type: "RESET_SEASON" });
    }
  }

  function resetAll() {
    if (window.confirm("Reset everything? This wipes lifetime stats, wallet, badges and leagues back to first run.")) {
      dispatch({ type: "RESET_ALL" });
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">Simulation controls</h2>
            <p className="text-[11px] text-ink-soft">
              {formatSimTimestamp(clock)} · Matchday {matchday.number + 1} · {matchday.status}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-paper-dim px-3 py-1 text-xs font-semibold text-ink-soft">
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canAdvanceToKickoff}
            onClick={() => dispatch({ type: "ADVANCE_TIME", hours: hoursToKickoff })}
            className="rounded-xl border border-pitch-700/30 py-2.5 text-xs font-bold text-pitch-800 disabled:opacity-40"
          >
            Advance to kickoff
          </button>
          <button
            type="button"
            disabled={matchday.status === "settled"}
            onClick={() => dispatch({ type: "SETTLE_MATCHDAY" })}
            className="rounded-xl bg-pitch-800 py-2.5 text-xs font-bold text-white disabled:opacity-40"
          >
            Settle matchday
          </button>
          <button
            type="button"
            disabled={matchday.status !== "settled"}
            onClick={() => dispatch({ type: "NEXT_MATCHDAY" })}
            className="rounded-xl border border-pitch-700/30 py-2.5 text-xs font-bold text-pitch-800 disabled:opacity-40"
          >
            Next matchday
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "SIMULATE_SEASON" })}
            className="rounded-xl border border-gold-500/50 bg-gold-400/10 py-2.5 text-xs font-bold text-gold-600"
          >
            Simulate full season
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-ink">
              <span>User luck bias</span>
              <span className="text-ink-soft">{settings.luckBias.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={settings.luckBias}
              onChange={(e) => dispatch({ type: "SET_LUCK_BIAS", value: Number(e.target.value) })}
              className="mt-1 w-full accent-pitch-700"
            />
            <p className="text-[10px] text-ink-soft">Nudges simulated results toward (or away from) your picks.</p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-ink">
              <span>Active simulated players</span>
              <span className="text-ink-soft">{settings.activePlayerCount}</span>
            </div>
            <input
              type="range"
              min={5}
              max={state.players.length}
              step={1}
              value={settings.activePlayerCount}
              onChange={(e) => dispatch({ type: "SET_ACTIVE_PLAYERS", value: Number(e.target.value) })}
              className="mt-1 w-full accent-pitch-700"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={resetSeason} className="rounded-xl border border-ink/10 py-2.5 text-xs font-bold text-ink-soft">
            Reset season
          </button>
          <button type="button" onClick={resetAll} className="rounded-xl border border-red-300 py-2.5 text-xs font-bold text-red-600">
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}
