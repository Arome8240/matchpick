"use client";

import { useState } from "react";
import { Check, Share2, Users } from "lucide-react";
import { useAppDispatch, useAppState } from "@/store/AppContext";
import { findLeagueByCode } from "@/sim/engine";
import { getLeaderboardRows } from "@/sim/selectors";
import StreakFlame from "@/components/ui/StreakFlame";

export default function LeaguesScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const myLeagues = state.leagues.filter((l) => l.isUserMember);
  const discoverLeagues = state.leagues.filter((l) => !l.isUserMember && l.isDemo);

  function handleCreate() {
    if (!name.trim()) return;
    dispatch({ type: "CREATE_LEAGUE", name });
    setName("");
  }

  function handleJoin(code: string) {
    const league = findLeagueByCode(state, code);
    if (!league) {
      setJoinError("No league found with that code.");
      return;
    }
    if (league.isUserMember) {
      setJoinError("You're already in that league.");
      return;
    }
    setJoinError(null);
    dispatch({ type: "JOIN_LEAGUE", code });
    setJoinCode("");
  }

  function shareLeague(leagueId: string) {
    const league = state.leagues.find((l) => l.id === leagueId);
    if (!league) return;
    const rows = getLeaderboardRows(state, "season", leagueId).slice(0, 5);
    const lines = [
      `MatchPick — ${league.name}`,
      `Season ${state.season} standings:`,
      ...rows.map((r, i) => `${i + 1}. ${r.name} — ${r.points} pts`),
      `Join with code ${league.code} in the MatchPick mini app.`,
    ];
    const text = lines.join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(leagueId);
    setTimeout(() => setCopiedId((id) => (id === leagueId ? null : id)), 1800);
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h1 className="mb-3 text-lg font-bold text-ink">Leagues</h1>

      <div className="mb-4 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-ink/5 bg-white p-3.5">
          <p className="mb-2 text-xs font-bold text-ink">Create a private league</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Warriors"
              className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-paper px-3 py-2 text-sm outline-none focus:border-pitch-600"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="shrink-0 rounded-lg bg-pitch-800 px-3.5 py-2 text-xs font-bold text-white active:scale-95"
            >
              Create
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-ink/5 bg-white p-3.5">
          <p className="mb-2 text-xs font-bold text-ink">Join with a code</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              placeholder="ABC123"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-paper px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-pitch-600"
            />
            <button
              type="button"
              onClick={() => handleJoin(joinCode)}
              disabled={joinCode.trim().length < 4}
              className="shrink-0 rounded-lg border border-pitch-700 px-3.5 py-2 text-xs font-bold text-pitch-800 disabled:opacity-40"
            >
              Join
            </button>
          </div>
          {joinError && <p className="mt-1.5 text-[11px] font-medium text-red-600">{joinError}</p>}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-bold text-ink">Your leagues</h2>
      {myLeagues.length === 0 ? (
        <div className="mb-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/10 py-8 text-center">
          <Users size={26} className="text-ink-soft/60" />
          <p className="text-sm font-semibold text-ink">No leagues yet</p>
          <p className="max-w-[220px] text-xs text-ink-soft">Create one or join a demo league below to compare picks with friends.</p>
        </div>
      ) : (
        <div className="mb-5 space-y-2.5">
          {myLeagues.map((league) => {
            const rows = getLeaderboardRows(state, "season", league.id);
            const expanded = expandedId === league.id;
            return (
              <div key={league.id} className="rounded-2xl border border-ink/5 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink">{league.name}</p>
                    <p className="text-[11px] text-ink-soft">
                      Code <span className="font-mono font-semibold text-pitch-700">{league.code}</span> ·{" "}
                      {league.memberIds.length + 1} members
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : league.id)}
                    className="text-xs font-semibold text-pitch-700"
                  >
                    {expanded ? "Hide" : "View"}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 space-y-1">
                    {rows.slice(0, 8).map((row, i) => (
                      <div key={row.id} className="flex items-center gap-2 rounded-lg bg-paper px-2 py-1.5 text-xs">
                        <span className="w-4 text-center font-bold text-ink-soft">{i + 1}</span>
                        <span className={`flex-1 truncate font-medium ${row.isUser ? "text-pitch-800" : "text-ink"}`}>
                          {row.name}
                        </span>
                        <StreakFlame streak={row.streak} />
                        <span className="font-bold text-ink">{row.points}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => shareLeague(league.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-pitch-700/40 py-2 text-xs font-bold text-pitch-800 active:scale-[0.98]"
                >
                  {copiedId === league.id ? (
                    <>
                      <Check size={14} /> Copied to clipboard
                    </>
                  ) : (
                    <>
                      <Share2 size={14} /> Share to WhatsApp
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {discoverLeagues.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-bold text-ink">Discover demo leagues</h2>
          <div className="space-y-2">
            {discoverLeagues.map((league) => (
              <div key={league.id} className="flex items-center justify-between rounded-2xl border border-ink/5 bg-white p-3.5">
                <div>
                  <p className="text-sm font-bold text-ink">{league.name}</p>
                  <p className="text-[11px] text-ink-soft">{league.memberIds.length} members · code {league.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleJoin(league.code)}
                  className="shrink-0 rounded-full bg-pitch-800 px-3.5 py-1.5 text-xs font-bold text-white active:scale-95"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
