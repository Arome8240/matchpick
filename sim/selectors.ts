import type { AppState, Badge } from "./types";
import { getActivePlayers } from "./engine";

export interface LeaderboardRow {
  id: string;
  name: string;
  initials: string;
  points: number;
  isUser: boolean;
  streak: number;
  badges: Badge[];
  country?: string;
}

export type LeaderboardScope = "matchday" | "season" | "alltime";

export function getLeaderboardRows(state: AppState, scope: LeaderboardScope, leagueId?: string): LeaderboardRow[] {
  let rows: LeaderboardRow[];

  if (scope === "matchday") {
    if (state.matchday.status !== "settled" || !state.matchday.scores) return [];
    rows = state.matchday.scores.map((s) => {
      if (s.playerId === "user") {
        return {
          id: "user",
          name: "You",
          initials: "YOU",
          points: s.totalPoints,
          isUser: true,
          streak: state.user.streak,
          badges: state.user.badges,
        };
      }
      const player = state.players.find((p) => p.id === s.playerId);
      return {
        id: s.playerId,
        name: player?.username ?? s.playerId,
        initials: player?.initials ?? "??",
        points: s.totalPoints,
        isUser: false,
        streak: player?.streak ?? 0,
        badges: player?.badges ?? [],
        country: player?.country,
      };
    });
  } else if (scope === "season") {
    const active = getActivePlayers(state);
    rows = [
      { id: "user", name: "You", initials: "YOU", points: state.user.seasonPoints, isUser: true, streak: state.user.streak, badges: state.user.badges },
      ...active.map((p) => ({
        id: p.id,
        name: p.username,
        initials: p.initials,
        points: p.seasonPoints,
        isUser: false,
        streak: p.streak,
        badges: p.badges,
        country: p.country,
      })),
    ];
  } else {
    rows = [
      { id: "user", name: "You", initials: "YOU", points: state.user.lifetimePoints, isUser: true, streak: state.user.streak, badges: state.user.badges },
      ...state.players.map((p) => ({
        id: p.id,
        name: p.username,
        initials: p.initials,
        points: p.lifetimePoints,
        isUser: false,
        streak: p.streak,
        badges: p.badges,
        country: p.country,
      })),
    ];
  }

  if (leagueId) {
    const league = state.leagues.find((l) => l.id === leagueId);
    if (!league) return [];
    const memberSet = new Set(league.memberIds);
    rows = rows.filter((r) => r.isUser || memberSet.has(r.id));
  }

  return rows.sort((a, b) => b.points - a.points);
}

export function getUserPosition(rows: LeaderboardRow[]): number {
  return rows.findIndex((r) => r.isUser) + 1;
}

export function getNearMissMessage(rows: LeaderboardRow[]): string | null {
  const position = getUserPosition(rows);
  if (position < 11 || position > 15) return null;
  const userPoints = rows.find((r) => r.isUser)?.points ?? 0;
  const cutoffPoints = rows[9]?.points ?? 0;
  const gap = Math.max(1, Math.ceil((cutoffPoints - userPoints) / 10));
  return `So close! You finished ${position}${ordinalSuffix(position)} — ${gap} correct pick${gap > 1 ? "s" : ""} from a prize.`;
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export type BadgeIconKey = "check" | "target" | "flame" | "medal" | "trophy" | "zap" | "coins" | "handshake";

export const BADGE_CATALOG: Record<Badge, { label: string; icon: BadgeIconKey; hint: string }> = {
  FIRST_SLATE: { label: "First Slate", icon: "check", hint: "Submit your first full matchday slate." },
  PERFECT_MATCHDAY: { label: "Perfect Matchday", icon: "target", hint: "Get all 8 outcomes correct in one matchday." },
  STREAK_5: { label: "On Fire", icon: "flame", hint: "Reach a 5 matchday submission streak." },
  SEASON_TOP10: { label: "Top 10 Finish", icon: "medal", hint: "Finish a season ranked in the top 10." },
  SEASON_CHAMPION: { label: "Season Champion", icon: "trophy", hint: "Finish a season ranked #1." },
  UPSET_HUNTER: { label: "Upset Hunter", icon: "zap", hint: "Correctly call an outcome fewer than 25% of the pool picked." },
  PRIZE_WINNER: { label: "Prize Winner", icon: "coins", hint: "Win any share of a weekly prize pool." },
  REFERRER: { label: "Squad Builder", icon: "handshake", hint: "Get a friend to join with your referral link." },
};

export const ALL_BADGES: Badge[] = [
  "FIRST_SLATE",
  "PERFECT_MATCHDAY",
  "STREAK_5",
  "SEASON_TOP10",
  "SEASON_CHAMPION",
  "UPSET_HUNTER",
  "PRIZE_WINNER",
  "REFERRER",
];
