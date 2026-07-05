export type Outcome = "HOME" | "DRAW" | "AWAY";

export interface Score {
  home: number;
  away: number;
}

export interface OutcomeProbs {
  home: number;
  draw: number;
  away: number;
}

export interface Fixture {
  id: string;
  matchday: number;
  home: string;
  away: string;
  homeInitials: string;
  awayInitials: string;
  competition: string;
  /** simulated kickoff time, ms since sim epoch */
  kickoff: number;
  /** hidden probabilities used to simulate the actual result */
  trueProbs: OutcomeProbs;
}

export interface FixtureResult {
  fixtureId: string;
  score: Score;
  outcome: Outcome;
}

export interface Pick {
  fixtureId: string;
  outcome: Outcome;
  exactScore?: Score;
}

export type Badge =
  | "FIRST_SLATE"
  | "PERFECT_MATCHDAY"
  | "STREAK_5"
  | "SEASON_TOP10"
  | "SEASON_CHAMPION"
  | "UPSET_HUNTER"
  | "PRIZE_WINNER"
  | "REFERRER";

export type Rank = "Amateur" | "Semi-Pro" | "Pro" | "Legend";

export interface FixtureScoreBreakdown {
  fixtureId: string;
  outcomeCorrect: boolean;
  exactCorrect: boolean;
  upset: boolean;
  points: number;
}

export interface MatchdayScoreResult {
  playerId: string;
  breakdown: FixtureScoreBreakdown[];
  rawPoints: number;
  perfectBonus: number;
  multiplier: number;
  totalPoints: number;
  fullSlate: boolean;
}

export interface PrizeAward {
  playerId: string;
  amount: number;
  reason: "RANK" | "RANDOM_DRAW";
  rank?: number;
}

export interface PickDistribution {
  fixtureId: string;
  home: number;
  draw: number;
  away: number;
  totalPicks: number;
}

export type MatchdayStatus = "upcoming" | "locked" | "settled";

export interface Matchday {
  number: number;
  fixtures: Fixture[];
  status: MatchdayStatus;
  results?: FixtureResult[];
  pickDistribution?: PickDistribution[];
  scores?: MatchdayScoreResult[];
  prizes?: PrizeAward[];
}

export interface SimPlayer {
  id: string;
  username: string;
  initials: string;
  country: string;
  skill: number; // 0..1
  streak: number;
  lifetimePoints: number;
  seasonPoints: number;
  picksByMatchday: Record<number, Pick[]>;
  fullSlateByMatchday: Record<number, boolean>;
  badges: Badge[];
}

export type TransactionType =
  | "STARTING_BALANCE"
  | "PRIZE_RANK"
  | "PRIZE_DRAW"
  | "REFERRAL_BONUS";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: number;
  txHash: string;
  balanceAfter: number;
}

export interface Wallet {
  balance: number;
  transactions: Transaction[];
}

export interface League {
  id: string;
  code: string;
  name: string;
  memberIds: string[]; // sim player ids
  isUserMember: boolean;
  isDemo: boolean;
}

export interface DailyFreePick {
  day: number;
  fixture: Fixture;
  userPick?: Outcome;
  resolved: boolean;
  result?: FixtureResult;
  correct?: boolean;
}

export interface SeasonHistoryEntry {
  season: number;
  finalSeasonPoints: number;
  finalRankPosition: number;
  badgesEarned: Badge[];
}

export interface UserState {
  address: string;
  picksByMatchday: Record<number, Pick[]>;
  submittedByMatchday: Record<number, boolean>;
  lifetimePoints: number;
  seasonPoints: number;
  streak: number;
  streakShields: number;
  badges: Badge[];
  leagueIds: string[];
  referralCode: string;
  referralsCompleted: number;
  seasonHistory: SeasonHistoryEntry[];
}

export interface SimSettings {
  luckBias: number; // -1..1, nudges user's simulated result luck
  activePlayerCount: number; // how many of the 60 sim players are "active" this season
}

export interface AppState {
  clock: number;
  season: number;
  currentMatchdayIndex: number; // 0-3, position within the season
  matchday: Matchday;
  dailyFree: DailyFreePick;
  user: UserState;
  players: SimPlayer[];
  wallet: Wallet;
  leagues: League[];
  settings: SimSettings;
}
