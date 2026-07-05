import type { Fixture, Outcome, OutcomeProbs, Score } from "./types";
import { clamp, weightedSample } from "./rand";

interface Club {
  name: string;
  initials: string;
  competition: string;
  power: number; // 1-100 relative strength
}

const CLUBS: Club[] = [
  // EPL
  { name: "Arsenal", initials: "ARS", competition: "EPL", power: 88 },
  { name: "Manchester City", initials: "MCI", competition: "EPL", power: 93 },
  { name: "Liverpool", initials: "LIV", competition: "EPL", power: 90 },
  { name: "Chelsea", initials: "CHE", competition: "EPL", power: 82 },
  { name: "Tottenham", initials: "TOT", competition: "EPL", power: 80 },
  { name: "Manchester United", initials: "MUN", competition: "EPL", power: 78 },
  { name: "Newcastle United", initials: "NEW", competition: "EPL", power: 76 },
  { name: "Aston Villa", initials: "AVL", competition: "EPL", power: 74 },
  // La Liga
  { name: "Real Madrid", initials: "RMA", competition: "La Liga", power: 94 },
  { name: "Barcelona", initials: "BAR", competition: "La Liga", power: 91 },
  { name: "Atletico Madrid", initials: "ATM", competition: "La Liga", power: 85 },
  { name: "Real Sociedad", initials: "RSO", competition: "La Liga", power: 76 },
  { name: "Sevilla", initials: "SEV", competition: "La Liga", power: 73 },
  { name: "Villarreal", initials: "VIL", competition: "La Liga", power: 75 },
  { name: "Real Betis", initials: "BET", competition: "La Liga", power: 72 },
  { name: "Athletic Bilbao", initials: "ATH", competition: "La Liga", power: 74 },
  // African clubs
  { name: "Enyimba", initials: "ENY", competition: "NPFL", power: 68 },
  { name: "Al Ahly", initials: "AHL", competition: "CAF", power: 84 },
  { name: "Zamalek", initials: "ZAM", competition: "CAF", power: 79 },
  { name: "Kaizer Chiefs", initials: "KAC", competition: "PSL", power: 71 },
  { name: "Mamelodi Sundowns", initials: "SUN", competition: "PSL", power: 80 },
  { name: "TP Mazembe", initials: "TPM", competition: "CAF", power: 77 },
  { name: "Rivers United", initials: "RIV", competition: "NPFL", power: 65 },
  { name: "Simba SC", initials: "SIM", competition: "CAF", power: 70 },
  { name: "Asante Kotoko", initials: "ASK", competition: "GPL", power: 69 },
  { name: "Wydad AC", initials: "WYD", competition: "CAF", power: 78 },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeTrueProbs(homePower: number, awayPower: number): OutcomeProbs {
  const HOME_ADVANTAGE = 6;
  const diff = homePower + HOME_ADVANTAGE - awayPower;
  // logistic-ish mapping of strength diff to a home-win edge
  const homeEdge = 1 / (1 + Math.exp(-diff / 12));
  const home = clamp(0.28 + homeEdge * 0.45, 0.1, 0.82);
  const away = clamp(0.28 + (1 - homeEdge) * 0.45, 0.08, 0.7);
  const draw = clamp(1 - home - away, 0.12, 0.4);
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

const HOUR_MS = 60 * 60 * 1000;

export function matchdayBaseKickoff(matchday: number): number {
  return (matchday * 168 + 24) * HOUR_MS;
}

export function generateMatchdaySlate(matchday: number): Fixture[] {
  const pool = shuffle(CLUBS);
  const fixtures: Fixture[] = [];
  const baseHour = matchdayBaseKickoff(matchday);
  for (let i = 0; i < 8; i++) {
    const home = pool[i * 2];
    const away = pool[i * 2 + 1];
    fixtures.push({
      id: `md${matchday}-f${i}`,
      matchday,
      home: home.name,
      away: away.name,
      homeInitials: home.initials || initials(home.name),
      awayInitials: away.initials || initials(away.name),
      competition: home.competition === away.competition ? home.competition : `${home.competition} · ${away.competition}`,
      kickoff: baseHour + i * 2 * HOUR_MS,
      trueProbs: computeTrueProbs(home.power, away.power),
    });
  }
  return fixtures;
}

const HOME_WIN_SCORES: Array<{ value: Score; weight: number }> = [
  { value: { home: 1, away: 0 }, weight: 5 },
  { value: { home: 2, away: 0 }, weight: 3 },
  { value: { home: 2, away: 1 }, weight: 4 },
  { value: { home: 3, away: 1 }, weight: 2 },
  { value: { home: 3, away: 0 }, weight: 1 },
  { value: { home: 4, away: 1 }, weight: 1 },
];

const DRAW_SCORES: Array<{ value: Score; weight: number }> = [
  { value: { home: 0, away: 0 }, weight: 3 },
  { value: { home: 1, away: 1 }, weight: 5 },
  { value: { home: 2, away: 2 }, weight: 2 },
];

function awayWinScores(): Array<{ value: Score; weight: number }> {
  return HOME_WIN_SCORES.map((e) => ({ value: { home: e.value.away, away: e.value.home }, weight: e.weight }));
}

export function sampleScoreline(outcome: Outcome): Score {
  if (outcome === "HOME") return weightedSample(HOME_WIN_SCORES);
  if (outcome === "AWAY") return weightedSample(awayWinScores());
  return weightedSample(DRAW_SCORES);
}

export function pickFeaturedFixture(day: number): Fixture {
  const pool = shuffle(CLUBS);
  const home = pool[0];
  const away = pool[1];
  return {
    id: `daily-${day}`,
    matchday: -1,
    home: home.name,
    away: away.name,
    homeInitials: home.initials,
    awayInitials: away.initials,
    competition: home.competition === away.competition ? home.competition : `${home.competition} · ${away.competition}`,
    kickoff: day * 24 * HOUR_MS + 20 * HOUR_MS,
    trueProbs: computeTrueProbs(home.power, away.power),
  };
}
