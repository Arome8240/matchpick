"use client";

import { useState } from "react";
import type { Fixture, FixtureResult, FixtureScoreBreakdown, Outcome, Pick, PickDistribution, Score } from "@/sim/types";
import { formatDuration } from "@/lib/format";

interface Props {
  fixture: Fixture;
  clock: number;
  pick?: Pick;
  interactive: boolean;
  distribution?: PickDistribution;
  result?: FixtureResult;
  breakdown?: FixtureScoreBreakdown;
  onSetOutcome: (outcome: Outcome) => void;
  onSetExactScore: (score: Score | undefined) => void;
}

const OUTCOME_LABELS: Record<Outcome, string> = { HOME: "Home", DRAW: "Draw", AWAY: "Away" };

export default function FixtureCard({
  fixture,
  clock,
  pick,
  interactive,
  distribution,
  result,
  breakdown,
  onSetOutcome,
  onSetExactScore,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const locked = clock >= fixture.kickoff;
  const showDistribution = !!distribution && distribution.totalPicks > 0 && !result;
  const settled = !!result;

  const pct = (n: number) => (distribution && distribution.totalPicks > 0 ? Math.round((n / distribution.totalPicks) * 100) : 0);

  return (
    <div
      className={`rounded-2xl border bg-white p-3.5 shadow-sm ${
        breakdown?.upset ? "animate-shake border-gold-400" : "border-ink/5"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-ink-soft">
        <span>{fixture.competition}</span>
        {settled ? (
          <span className="font-semibold text-pitch-700">Full time</span>
        ) : (
          <span className={locked ? "font-semibold text-gold-600" : ""}>
            {locked ? "Locked" : `Locks in ${formatDuration(fixture.kickoff - clock)}`}
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <TeamLabel initials={fixture.homeInitials} name={fixture.home} align="left" />
        <div className="flex flex-col items-center px-1">
          {settled ? (
            <span className="text-lg font-bold text-ink">
              {result!.score.home} – {result!.score.away}
            </span>
          ) : (
            <span className="text-xs font-medium text-ink-soft">vs</span>
          )}
          {breakdown?.upset && (
            <span className="mt-0.5 rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-600">
              Upset!
            </span>
          )}
        </div>
        <TeamLabel initials={fixture.awayInitials} name={fixture.away} align="right" />
      </div>

      {!settled && (
        <div className="grid grid-cols-3 gap-1.5">
          {(["HOME", "DRAW", "AWAY"] as Outcome[]).map((outcome) => {
            const isSelected = pick?.outcome === outcome;
            return (
              <button
                key={outcome}
                type="button"
                disabled={!interactive || locked}
                onClick={() => onSetOutcome(outcome)}
                className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  isSelected
                    ? "border-pitch-700 bg-pitch-700 text-white"
                    : "border-ink/10 bg-paper text-ink-soft"
                } ${!interactive || locked ? "opacity-60" : "active:scale-[0.97]"}`}
              >
                {OUTCOME_LABELS[outcome]}
              </button>
            );
          })}
        </div>
      )}

      {settled && breakdown && (
        <div className="mt-1 flex items-center justify-between rounded-lg bg-paper-dim px-2.5 py-1.5 text-xs">
          <span className="text-ink-soft">
            {pick ? `Your pick: ${OUTCOME_LABELS[pick.outcome]}${pick.exactScore ? ` ${pick.exactScore.home}-${pick.exactScore.away}` : ""}` : "No pick"}
          </span>
          <span className={`font-bold ${breakdown.points > 0 ? "text-pitch-700" : "text-ink-soft"}`}>
            +{breakdown.points} pts
          </span>
        </div>
      )}

      {!settled && interactive && !locked && pick && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-pitch-700 underline decoration-dotted underline-offset-2"
          >
            {pick.exactScore ? `Exact score: ${pick.exactScore.home}-${pick.exactScore.away} · edit` : "Set exact score +15"}
          </button>
          {expanded && (
            <ScoreStepper
              score={pick.exactScore ?? { home: 0, away: 0 }}
              onChange={(score) => {
                onSetExactScore(score);
                const derivedOutcome: Outcome = score.home > score.away ? "HOME" : score.home < score.away ? "AWAY" : "DRAW";
                if (derivedOutcome !== pick.outcome) onSetOutcome(derivedOutcome);
              }}
              onClear={() => {
                onSetExactScore(undefined);
                setExpanded(false);
              }}
            />
          )}
        </div>
      )}

      {showDistribution && (
        <div className="mt-2.5 space-y-1">
          <DistBar label="Home" value={pct(distribution!.home)} />
          <DistBar label="Draw" value={pct(distribution!.draw)} />
          <DistBar label="Away" value={pct(distribution!.away)} />
        </div>
      )}
    </div>
  );
}

function TeamLabel({ initials, name, align }: { initials: string; name: string; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-800 text-[10px] font-bold text-white">
        {initials}
      </span>
      <span className="text-[13px] font-semibold leading-tight text-ink">{name}</span>
    </div>
  );
}

function DistBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-ink-soft">
      <span className="w-8 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-dim">
        <div className="h-full rounded-full bg-pitch-500" style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-medium">{value}%</span>
    </div>
  );
}

function ScoreStepper({
  score,
  onChange,
  onClear,
}: {
  score: Score;
  onChange: (score: Score) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-center gap-3 rounded-lg bg-paper-dim px-3 py-2">
      <Stepper value={score.home} onChange={(home) => onChange({ ...score, home })} />
      <span className="text-sm font-bold text-ink-soft">:</span>
      <Stepper value={score.away} onChange={(away) => onChange({ ...score, away })} />
      <button type="button" onClick={onClear} className="ml-2 text-[11px] font-medium text-ink-soft underline">
        Clear
      </button>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-ink shadow-sm active:scale-95"
      >
        –
      </button>
      <span className="w-4 text-center text-sm font-bold text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(9, value + 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-ink shadow-sm active:scale-95"
      >
        +
      </button>
    </div>
  );
}
