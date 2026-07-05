import type {
  AppState,
  DailyFreePick,
  Fixture,
  FixtureResult,
  FixtureScoreBreakdown,
  League,
  Matchday,
  MatchdayScoreResult,
  Outcome,
  OutcomeProbs,
  Pick,
  PickDistribution,
  PrizeAward,
  Rank,
  SimPlayer,
  UserState,
} from "./types";
import { generateMatchdaySlate, pickFeaturedFixture, sampleScoreline } from "./fixtures";
import { generateBotPicks, generateSimPlayers } from "./players";
import { credit, createStartingWallet } from "./wallet";
import { clamp, randCode, randId, sampleOutcome, shuffleInPlace } from "./rand";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const MATCHDAYS_PER_SEASON = 4;
export const PRIZE_POOL_TOTAL = 25;
export const FIXTURES_PER_MATCHDAY = 8;

const DEMO_LEAGUE_NAMES = ["Lagos Ballers", "Office Legends", "Uni Squad"];

const RANKS: Array<{ name: Rank; min: number }> = [
  { name: "Amateur", min: 0 },
  { name: "Semi-Pro", min: 500 },
  { name: "Pro", min: 1500 },
  { name: "Legend", min: 4000 },
];

export function rankForPoints(lifetimePoints: number): Rank {
  let current: Rank = "Amateur";
  for (const r of RANKS) {
    if (lifetimePoints >= r.min) current = r.name;
  }
  return current;
}

export function nextRankInfo(lifetimePoints: number): { rank: Rank; next: Rank | null; pointsToNext: number | null } {
  const idx = RANKS.findIndex((r) => r.name === rankForPoints(lifetimePoints));
  const next = RANKS[idx + 1];
  return {
    rank: RANKS[idx].name,
    next: next ? next.name : null,
    pointsToNext: next ? next.min - lifetimePoints : null,
  };
}

export function streakMultiplier(streak: number): number {
  return 1 + 0.05 * Math.min(streak, 5);
}

function globalMatchdayNumber(season: number, indexInSeason: number): number {
  return (season - 1) * MATCHDAYS_PER_SEASON + indexInSeason;
}

function createMatchday(season: number, indexInSeason: number): Matchday {
  const number = globalMatchdayNumber(season, indexInSeason);
  return {
    number,
    fixtures: generateMatchdaySlate(number),
    status: "upcoming",
  };
}

function createDailyFree(day: number): DailyFreePick {
  return {
    day,
    fixture: pickFeaturedFixture(day),
    resolved: false,
  };
}

function seedDemoLeagues(players: SimPlayer[]): League[] {
  const shuffled = shuffleInPlace([...players]);
  let cursor = 0;
  return DEMO_LEAGUE_NAMES.map((name) => {
    const size = 8 + Math.floor(Math.random() * 6);
    const members = shuffled.slice(cursor, cursor + size).map((p) => p.id);
    cursor += size;
    return {
      id: randId("league"),
      code: randCode(),
      name,
      memberIds: members,
      isUserMember: false,
      isDemo: true,
    };
  });
}

export function initAppState(): AppState {
  const players = generateSimPlayers(60);
  const user: UserState = {
    address: "0xDEMO...1234",
    picksByMatchday: {},
    submittedByMatchday: {},
    lifetimePoints: 0,
    seasonPoints: 0,
    streak: 0,
    streakShields: 0,
    badges: [],
    leagueIds: [],
    referralCode: randCode(8),
    referralsCompleted: 0,
    seasonHistory: [],
  };
  return {
    clock: 0,
    season: 1,
    currentMatchdayIndex: 0,
    matchday: createMatchday(1, 0),
    dailyFree: createDailyFree(0),
    user,
    players,
    wallet: createStartingWallet(0),
    leagues: seedDemoLeagues(players),
    settings: { luckBias: 0, activePlayerCount: 40 },
  };
}

export function isFixtureLocked(fixture: Fixture, clock: number): boolean {
  return clock >= fixture.kickoff;
}

export function isMatchdayLocked(matchday: Matchday, clock: number): boolean {
  return matchday.status !== "upcoming" || matchday.fixtures.every((f) => isFixtureLocked(f, clock));
}

export function getUserPicks(state: AppState): Pick[] {
  return state.user.picksByMatchday[state.matchday.number] ?? [];
}

export function hasUserSubmitted(state: AppState): boolean {
  return !!state.user.submittedByMatchday[state.matchday.number];
}

export function setUserPick(state: AppState, fixtureId: string, outcome: Outcome): AppState {
  if (hasUserSubmitted(state)) return state;
  const fixture = state.matchday.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || isFixtureLocked(fixture, state.clock)) return state;
  const current = getUserPicks(state);
  const existing = current.find((p) => p.fixtureId === fixtureId);
  const next: Pick[] = existing
    ? current.map((p) => (p.fixtureId === fixtureId ? { ...p, outcome, exactScore: undefined } : p))
    : [...current, { fixtureId, outcome }];
  return {
    ...state,
    user: {
      ...state.user,
      picksByMatchday: { ...state.user.picksByMatchday, [state.matchday.number]: next },
    },
  };
}

export function setUserExactScore(
  state: AppState,
  fixtureId: string,
  score: { home: number; away: number } | undefined
): AppState {
  if (hasUserSubmitted(state)) return state;
  const current = getUserPicks(state);
  const existing = current.find((p) => p.fixtureId === fixtureId);
  if (!existing) return state;
  const next = current.map((p) => (p.fixtureId === fixtureId ? { ...p, exactScore: score } : p));
  return {
    ...state,
    user: {
      ...state.user,
      picksByMatchday: { ...state.user.picksByMatchday, [state.matchday.number]: next },
    },
  };
}

export function submitUserPicks(state: AppState): AppState {
  if (hasUserSubmitted(state) || getUserPicks(state).length === 0) return state;
  const isFirstEver = Object.keys(state.user.submittedByMatchday).length === 0;
  const badges = isFirstEver && !state.user.badges.includes("FIRST_SLATE")
    ? [...state.user.badges, "FIRST_SLATE" as const]
    : state.user.badges;
  return {
    ...state,
    user: {
      ...state.user,
      submittedByMatchday: { ...state.user.submittedByMatchday, [state.matchday.number]: true },
      badges,
    },
  };
}

function biasedProbs(trueProbs: OutcomeProbs, pick: Outcome | undefined, luckBias: number): OutcomeProbs {
  if (!pick || luckBias === 0) return trueProbs;
  const bias = clamp(luckBias, -0.9, 0.9);
  const boosted: OutcomeProbs = { ...trueProbs };
  const key = pick === "HOME" ? "home" : pick === "DRAW" ? "draw" : "away";
  boosted[key] = clamp(boosted[key] + bias * (1 - boosted[key]), 0.02, 0.96);
  const total = boosted.home + boosted.draw + boosted.away;
  return { home: boosted.home / total, draw: boosted.draw / total, away: boosted.away / total };
}

function simulateResults(fixtures: Fixture[], userPicks: Pick[], luckBias: number): FixtureResult[] {
  return fixtures.map((fixture) => {
    const userPick = userPicks.find((p) => p.fixtureId === fixture.id)?.outcome;
    const probs = biasedProbs(fixture.trueProbs, userPick, luckBias);
    const outcome = sampleOutcome(probs);
    return { fixtureId: fixture.id, score: sampleScoreline(outcome), outcome };
  });
}

export function computePickDistribution(fixtures: Fixture[], allPicks: Pick[][]): PickDistribution[] {
  return fixtures.map((fixture) => {
    let home = 0;
    let draw = 0;
    let away = 0;
    for (const picks of allPicks) {
      const p = picks.find((pk) => pk.fixtureId === fixture.id);
      if (!p) continue;
      if (p.outcome === "HOME") home++;
      else if (p.outcome === "DRAW") draw++;
      else away++;
    }
    return { fixtureId: fixture.id, home, draw, away, totalPicks: home + draw + away };
  });
}

function isUpsetResult(dist: PickDistribution | undefined, outcome: Outcome): boolean {
  if (!dist || dist.totalPicks === 0) return false;
  const count = outcome === "HOME" ? dist.home : outcome === "DRAW" ? dist.draw : dist.away;
  return count / dist.totalPicks < 0.25;
}

function scoreFixtureForPick(
  pick: Pick | undefined,
  result: FixtureResult,
  upset: boolean
): FixtureScoreBreakdown {
  if (!pick) {
    return { fixtureId: result.fixtureId, outcomeCorrect: false, exactCorrect: false, upset: false, points: 0 };
  }
  const outcomeCorrect = pick.outcome === result.outcome;
  const exactCorrect =
    outcomeCorrect &&
    !!pick.exactScore &&
    pick.exactScore.home === result.score.home &&
    pick.exactScore.away === result.score.away;
  let points = 0;
  if (outcomeCorrect) points += 10;
  if (exactCorrect) points += 15;
  const upsetHit = outcomeCorrect && upset;
  if (upsetHit) points += 10;
  return { fixtureId: result.fixtureId, outcomeCorrect, exactCorrect, upset: upsetHit, points };
}

export function scoreMatchdayForPicks(
  picks: Pick[],
  fixtures: Fixture[],
  results: FixtureResult[],
  distribution: PickDistribution[],
  streakBefore: number
): Omit<MatchdayScoreResult, "playerId"> {
  const breakdown = fixtures.map((fixture) => {
    const result = results.find((r) => r.fixtureId === fixture.id)!;
    const dist = distribution.find((d) => d.fixtureId === fixture.id);
    const pick = picks.find((p) => p.fixtureId === fixture.id);
    return scoreFixtureForPick(pick, result, isUpsetResult(dist, result.outcome));
  });
  const rawPoints = breakdown.reduce((s, b) => s + b.points, 0);
  const fullSlate = picks.length === fixtures.length;
  const perfectBonus =
    fullSlate && fixtures.length === FIXTURES_PER_MATCHDAY && breakdown.every((b) => b.outcomeCorrect) ? 30 : 0;
  const multiplier = streakMultiplier(streakBefore);
  const totalPoints = Math.round((rawPoints + perfectBonus) * multiplier);
  return { breakdown, rawPoints, perfectBonus, multiplier, totalPoints, fullSlate };
}

export function computePrizes(
  scores: MatchdayScoreResult[],
  participantHasPicks: (playerId: string) => boolean
): PrizeAward[] {
  const participants = scores.filter((s) => participantHasPicks(s.playerId));
  const ranked = [...participants].sort((a, b) => b.totalPoints - a.totalPoints);
  const prizes: PrizeAward[] = [];
  const rankPrizes = [8, 5, 3, 1, 1, 1, 1, 1, 1, 1];
  ranked.slice(0, 10).forEach((s, i) => {
    prizes.push({ playerId: s.playerId, amount: rankPrizes[i], reason: "RANK", rank: i + 1 });
  });
  const fullSlateParticipants = shuffleInPlace(participants.filter((s) => s.fullSlate).map((s) => s.playerId));
  fullSlateParticipants.slice(0, 4).forEach((playerId) => {
    prizes.push({ playerId, amount: 0.5, reason: "RANDOM_DRAW" });
  });
  return prizes;
}

export function getActivePlayers(state: AppState): SimPlayer[] {
  return state.players.slice(0, clamp(state.settings.activePlayerCount, 1, state.players.length));
}

function updateStreakAndPoints(
  streak: number,
  shields: number,
  fullSlate: boolean,
  participated: boolean
): { streak: number; shields: number } {
  if (fullSlate) return { streak: streak + 1, shields };
  if (!participated && shields > 0) return { streak, shields: shields - 1 };
  return { streak: 0, shields };
}

export function settleMatchday(state: AppState): AppState {
  if (state.matchday.status === "settled") return state;
  const fixtures = state.matchday.fixtures;
  const userPicks = getUserPicks(state);
  const userSubmitted = hasUserSubmitted(state);
  const results = simulateResults(fixtures, userSubmitted ? userPicks : [], state.settings.luckBias);

  const activePlayers = getActivePlayers(state);
  const botPickMap = new Map<string, { picks: Pick[]; fullSlate: boolean }>();
  const activityBias = (state.settings.activePlayerCount - 40) / 200;
  for (const player of activePlayers) {
    botPickMap.set(player.id, generateBotPicks(player, fixtures, activityBias));
  }

  const allPicksForDistribution: Pick[][] = [
    ...(userSubmitted ? [userPicks] : []),
    ...Array.from(botPickMap.values()).map((b) => b.picks),
  ];
  const distribution = computePickDistribution(fixtures, allPicksForDistribution);

  const userScore: MatchdayScoreResult = {
    playerId: "user",
    ...scoreMatchdayForPicks(userPicks, fixtures, results, distribution, state.user.streak),
  };

  const botScores: MatchdayScoreResult[] = activePlayers.map((player) => {
    const { picks } = botPickMap.get(player.id)!;
    return {
      playerId: player.id,
      ...scoreMatchdayForPicks(picks, fixtures, results, distribution, player.streak),
    };
  });

  const allScores = [userScore, ...botScores];
  const prizes = computePrizes(allScores, (id) => {
    if (id === "user") return userSubmitted && userPicks.length > 0;
    return (botPickMap.get(id)?.picks.length ?? 0) > 0;
  });

  let wallet = state.wallet;
  const userPrizes = prizes.filter((p) => p.playerId === "user");
  for (const prize of userPrizes) {
    const label = prize.reason === "RANK" ? `Matchday #${prize.rank} prize` : "Random draw prize";
    wallet = credit(wallet, prize.reason === "RANK" ? "PRIZE_RANK" : "PRIZE_DRAW", prize.amount, label, state.clock);
  }

  const userStreakUpdate = updateStreakAndPoints(
    state.user.streak,
    state.user.streakShields,
    userScore.fullSlate,
    userSubmitted && userPicks.length > 0
  );

  const badges = [...state.user.badges];
  if (userScore.perfectBonus > 0 && !badges.includes("PERFECT_MATCHDAY")) badges.push("PERFECT_MATCHDAY");
  if (userStreakUpdate.streak >= 5 && !badges.includes("STREAK_5")) badges.push("STREAK_5");
  if (userPrizes.length > 0 && !badges.includes("PRIZE_WINNER")) badges.push("PRIZE_WINNER");
  if (userScore.breakdown.some((b) => b.upset) && !badges.includes("UPSET_HUNTER")) badges.push("UPSET_HUNTER");

  const updatedPlayers = state.players.map((player) => {
    const botScore = botScores.find((s) => s.playerId === player.id);
    if (!botScore) return player;
    const { picks, fullSlate } = botPickMap.get(player.id)!;
    const streakUpdate = updateStreakAndPoints(player.streak, 0, fullSlate, picks.length > 0);
    return {
      ...player,
      streak: streakUpdate.streak,
      lifetimePoints: player.lifetimePoints + botScore.totalPoints,
      seasonPoints: player.seasonPoints + botScore.totalPoints,
      picksByMatchday: { ...player.picksByMatchday, [state.matchday.number]: picks },
      fullSlateByMatchday: { ...player.fullSlateByMatchday, [state.matchday.number]: fullSlate },
    };
  });

  return {
    ...state,
    matchday: {
      ...state.matchday,
      status: "settled",
      results,
      pickDistribution: distribution,
      scores: allScores,
      prizes,
    },
    wallet,
    players: updatedPlayers,
    user: {
      ...state.user,
      lifetimePoints: state.user.lifetimePoints + userScore.totalPoints,
      seasonPoints: state.user.seasonPoints + userScore.totalPoints,
      streak: userStreakUpdate.streak,
      streakShields: userStreakUpdate.shields,
      badges,
    },
  };
}

export function nextMatchday(state: AppState): AppState {
  if (state.matchday.status !== "settled") return state;

  if (state.currentMatchdayIndex < MATCHDAYS_PER_SEASON - 1) {
    return {
      ...state,
      currentMatchdayIndex: state.currentMatchdayIndex + 1,
      matchday: createMatchday(state.season, state.currentMatchdayIndex + 1),
    };
  }

  const activePlayers = getActivePlayers(state);
  const seasonRanking = [{ id: "user", points: state.user.seasonPoints }, ...activePlayers.map((p) => ({ id: p.id, points: p.seasonPoints }))]
    .sort((a, b) => b.points - a.points);
  const userPosition = seasonRanking.findIndex((r) => r.id === "user") + 1;

  const badges = [...state.user.badges];
  if (userPosition === 1 && !badges.includes("SEASON_CHAMPION")) badges.push("SEASON_CHAMPION");
  if (userPosition > 0 && userPosition <= 10 && !badges.includes("SEASON_TOP10")) badges.push("SEASON_TOP10");

  const seasonHistory = [
    ...state.user.seasonHistory,
    {
      season: state.season,
      finalSeasonPoints: state.user.seasonPoints,
      finalRankPosition: userPosition,
      badgesEarned: badges.filter((b) => !state.user.badges.includes(b)),
    },
  ];

  const resetPlayers = state.players.map((p) => ({ ...p, seasonPoints: 0 }));

  return {
    ...state,
    season: state.season + 1,
    currentMatchdayIndex: 0,
    matchday: createMatchday(state.season + 1, 0),
    players: resetPlayers,
    user: {
      ...state.user,
      seasonPoints: 0,
      badges,
      seasonHistory,
    },
  };
}

function autoSubmitRandomUserPicks(state: AppState): AppState {
  let next = state;
  for (const fixture of state.matchday.fixtures) {
    const outcome = sampleOutcome(fixture.trueProbs);
    next = setUserPick(next, fixture.id, outcome);
  }
  return submitUserPicks(next);
}

export function simulateFullSeason(state: AppState): AppState {
  let current = state;
  const matchdaysToRun = MATCHDAYS_PER_SEASON - current.currentMatchdayIndex;
  for (let i = 0; i < matchdaysToRun; i++) {
    if (!hasUserSubmitted(current) && current.matchday.status === "upcoming") {
      current = autoSubmitRandomUserPicks(current);
    }
    if (current.matchday.status !== "settled") {
      current = settleMatchday(current);
    }
    current = nextMatchday(current);
  }
  return current;
}

export function advanceTime(state: AppState, hours: number): AppState {
  const clock = state.clock + hours * HOUR_MS;
  let matchday = state.matchday;
  if (matchday.status === "upcoming" && isMatchdayLocked(matchday, clock)) {
    matchday = { ...matchday, status: "locked" };
  }

  let dailyFree = state.dailyFree;
  let user = state.user;
  let guard = 0;
  while (clock >= dailyFree.fixture.kickoff && guard < 60) {
    guard++;
    if (!dailyFree.resolved) {
      const result: FixtureResult = {
        fixtureId: dailyFree.fixture.id,
        score: sampleScoreline(sampleOutcome(dailyFree.fixture.trueProbs)),
        outcome: sampleOutcome(dailyFree.fixture.trueProbs),
      };
      const correct = dailyFree.userPick === result.outcome;
      dailyFree = { ...dailyFree, resolved: true, result, correct };
      if (correct) {
        user = { ...user, lifetimePoints: user.lifetimePoints + 5 };
      }
    }
    const nextDay = dailyFree.day + 1;
    if (clock < nextDay * DAY_MS + 20 * HOUR_MS) break;
    dailyFree = createDailyFree(nextDay);
  }

  return { ...state, clock, matchday, dailyFree, user };
}

export function setDailyFreePick(state: AppState, outcome: Outcome): AppState {
  if (state.dailyFree.resolved || state.clock >= state.dailyFree.fixture.kickoff) return state;
  return { ...state, dailyFree: { ...state.dailyFree, userPick: outcome } };
}

export function resetSeason(state: AppState): AppState {
  const resetPlayers = state.players.map((p) => ({ ...p, seasonPoints: 0 }));
  return {
    ...state,
    season: 1,
    currentMatchdayIndex: 0,
    matchday: createMatchday(1, 0),
    players: resetPlayers,
    user: { ...state.user, seasonPoints: 0 },
  };
}

export function resetAll(): AppState {
  return initAppState();
}

export function setLuckBias(state: AppState, luckBias: number): AppState {
  return { ...state, settings: { ...state.settings, luckBias: clamp(luckBias, -1, 1) } };
}

export function setActivePlayerCount(state: AppState, count: number): AppState {
  return { ...state, settings: { ...state.settings, activePlayerCount: clamp(count, 5, state.players.length) } };
}

export function findLeagueByCode(state: AppState, code: string): League | undefined {
  return state.leagues.find((l) => l.code.toLowerCase() === code.trim().toLowerCase());
}

export function createLeague(state: AppState, name: string): AppState {
  const league: League = {
    id: randId("league"),
    code: randCode(),
    name: name.trim() || "New League",
    memberIds: [],
    isUserMember: true,
    isDemo: false,
  };
  return {
    ...state,
    leagues: [...state.leagues, league],
    user: { ...state.user, leagueIds: [...state.user.leagueIds, league.id] },
  };
}

export function joinLeagueByCode(state: AppState, code: string): AppState {
  const league = findLeagueByCode(state, code);
  if (!league || league.isUserMember) return state;
  return {
    ...state,
    leagues: state.leagues.map((l) => (l.id === league.id ? { ...l, isUserMember: true } : l)),
    user: { ...state.user, leagueIds: [...state.user.leagueIds, league.id] },
  };
}

export function generateReferralLink(state: AppState): string {
  return `https://minipay.app/matchpick/join?ref=${state.user.referralCode}`;
}

export function simulateFriendJoining(state: AppState): AppState {
  const wallet = credit(state.wallet, "REFERRAL_BONUS", 0.5, "Referral bonus — friend joined via your link", state.clock);
  const badges = state.user.badges.includes("REFERRER") ? state.user.badges : [...state.user.badges, "REFERRER" as const];
  return {
    ...state,
    wallet,
    user: {
      ...state.user,
      referralsCompleted: state.user.referralsCompleted + 1,
      streakShields: Math.min(state.user.streakShields + 1, 1),
      badges,
    },
  };
}
