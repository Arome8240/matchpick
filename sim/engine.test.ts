import { describe, expect, it } from "vitest";
import type { Fixture, FixtureResult, Pick, PickDistribution } from "./types";
import {
  computePickDistribution,
  computePrizes,
  rankForPoints,
  scoreMatchdayForPicks,
  streakMultiplier,
} from "./engine";

function makeFixture(id: string): Fixture {
  return {
    id,
    matchday: 0,
    home: "Home FC",
    away: "Away FC",
    homeInitials: "HFC",
    awayInitials: "AFC",
    competition: "Test League",
    kickoff: 0,
    trueProbs: { home: 0.4, draw: 0.3, away: 0.3 },
  };
}

describe("streakMultiplier", () => {
  it("returns 1.0 at streak 0", () => {
    expect(streakMultiplier(0)).toBe(1);
  });
  it("increments by 0.05 per streak up to cap", () => {
    expect(streakMultiplier(1)).toBeCloseTo(1.05);
    expect(streakMultiplier(2)).toBeCloseTo(1.1);
    expect(streakMultiplier(3)).toBeCloseTo(1.15);
    expect(streakMultiplier(4)).toBeCloseTo(1.2);
    expect(streakMultiplier(5)).toBeCloseTo(1.25);
  });
  it("caps at 1.25 beyond streak 5", () => {
    expect(streakMultiplier(6)).toBeCloseTo(1.25);
    expect(streakMultiplier(50)).toBeCloseTo(1.25);
  });
});

describe("rankForPoints", () => {
  it("maps lifetime points to the correct rank tier", () => {
    expect(rankForPoints(0)).toBe("Amateur");
    expect(rankForPoints(499)).toBe("Amateur");
    expect(rankForPoints(500)).toBe("Semi-Pro");
    expect(rankForPoints(1499)).toBe("Semi-Pro");
    expect(rankForPoints(1500)).toBe("Pro");
    expect(rankForPoints(3999)).toBe("Pro");
    expect(rankForPoints(4000)).toBe("Legend");
  });
});

describe("scoreMatchdayForPicks", () => {
  it("awards 10 points for a correct outcome only", () => {
    const fixtures = [makeFixture("f1")];
    const results: FixtureResult[] = [{ fixtureId: "f1", outcome: "HOME", score: { home: 2, away: 0 } }];
    const picks: Pick[] = [{ fixtureId: "f1", outcome: "HOME" }];
    const dist: PickDistribution[] = [{ fixtureId: "f1", home: 50, draw: 25, away: 25, totalPicks: 100 }];
    const result = scoreMatchdayForPicks(picks, fixtures, results, dist, 0);
    expect(result.breakdown[0].points).toBe(10);
    expect(result.totalPoints).toBe(10);
  });

  it("stacks the exact scoreline bonus on top of the outcome points", () => {
    const fixtures = [makeFixture("f1")];
    const results: FixtureResult[] = [{ fixtureId: "f1", outcome: "HOME", score: { home: 2, away: 1 } }];
    const picks: Pick[] = [{ fixtureId: "f1", outcome: "HOME", exactScore: { home: 2, away: 1 } }];
    const dist: PickDistribution[] = [{ fixtureId: "f1", home: 50, draw: 25, away: 25, totalPicks: 100 }];
    const result = scoreMatchdayForPicks(picks, fixtures, results, dist, 0);
    expect(result.breakdown[0].points).toBe(25);
  });

  it("does not award the exact bonus when the scoreline is wrong even if outcome matches", () => {
    const fixtures = [makeFixture("f1")];
    const results: FixtureResult[] = [{ fixtureId: "f1", outcome: "HOME", score: { home: 2, away: 1 } }];
    const picks: Pick[] = [{ fixtureId: "f1", outcome: "HOME", exactScore: { home: 1, away: 0 } }];
    const dist: PickDistribution[] = [{ fixtureId: "f1", home: 50, draw: 25, away: 25, totalPicks: 100 }];
    const result = scoreMatchdayForPicks(picks, fixtures, results, dist, 0);
    expect(result.breakdown[0].points).toBe(10);
    expect(result.breakdown[0].exactCorrect).toBe(false);
  });

  it("awards the upset bonus only when fewer than 25% of the pool picked the correct outcome", () => {
    const fixtures = [makeFixture("f1")];
    const results: FixtureResult[] = [{ fixtureId: "f1", outcome: "AWAY", score: { home: 0, away: 1 } }];
    const picks: Pick[] = [{ fixtureId: "f1", outcome: "AWAY" }];
    const lowConsensus: PickDistribution[] = [{ fixtureId: "f1", home: 70, draw: 20, away: 10, totalPicks: 100 }];
    const highConsensus: PickDistribution[] = [{ fixtureId: "f1", home: 20, draw: 20, away: 60, totalPicks: 100 }];

    const upsetResult = scoreMatchdayForPicks(picks, fixtures, results, lowConsensus, 0);
    expect(upsetResult.breakdown[0].upset).toBe(true);
    expect(upsetResult.breakdown[0].points).toBe(20);

    const noUpsetResult = scoreMatchdayForPicks(picks, fixtures, results, highConsensus, 0);
    expect(noUpsetResult.breakdown[0].upset).toBe(false);
    expect(noUpsetResult.breakdown[0].points).toBe(10);
  });

  it("awards the perfect matchday bonus only for a full 8-fixture correct slate", () => {
    const fixtures = Array.from({ length: 8 }, (_, i) => makeFixture(`f${i}`));
    const results: FixtureResult[] = fixtures.map((f) => ({ fixtureId: f.id, outcome: "HOME", score: { home: 1, away: 0 } }));
    const dist: PickDistribution[] = fixtures.map((f) => ({ fixtureId: f.id, home: 40, draw: 30, away: 30, totalPicks: 100 }));

    const fullCorrect: Pick[] = fixtures.map((f) => ({ fixtureId: f.id, outcome: "HOME" }));
    const perfect = scoreMatchdayForPicks(fullCorrect, fixtures, results, dist, 0);
    expect(perfect.perfectBonus).toBe(30);
    expect(perfect.totalPoints).toBe(8 * 10 + 30);

    const partialCorrect: Pick[] = fixtures.map((f, i) => ({ fixtureId: f.id, outcome: i === 0 ? "AWAY" : "HOME" }));
    const notPerfect = scoreMatchdayForPicks(partialCorrect, fixtures, results, dist, 0);
    expect(notPerfect.perfectBonus).toBe(0);
  });

  it("does not award the perfect bonus on a full-but-short slate (fewer than 8 fixtures)", () => {
    const fixtures = [makeFixture("f1"), makeFixture("f2")];
    const results: FixtureResult[] = [
      { fixtureId: "f1", outcome: "HOME", score: { home: 1, away: 0 } },
      { fixtureId: "f2", outcome: "AWAY", score: { home: 0, away: 1 } },
    ];
    const dist: PickDistribution[] = fixtures.map((f) => ({ fixtureId: f.id, home: 40, draw: 30, away: 30, totalPicks: 100 }));
    const fullCorrect: Pick[] = [
      { fixtureId: "f1", outcome: "HOME" },
      { fixtureId: "f2", outcome: "AWAY" },
    ];
    const result = scoreMatchdayForPicks(fullCorrect, fixtures, results, dist, 0);
    expect(result.perfectBonus).toBe(0);
    expect(result.totalPoints).toBe(20);
  });

  it("applies the streak multiplier to raw points plus perfect bonus", () => {
    const fixtures = [makeFixture("f1")];
    const results: FixtureResult[] = [{ fixtureId: "f1", outcome: "HOME", score: { home: 1, away: 0 } }];
    const picks: Pick[] = [{ fixtureId: "f1", outcome: "HOME" }];
    const dist: PickDistribution[] = [{ fixtureId: "f1", home: 50, draw: 25, away: 25, totalPicks: 100 }];

    const noStreak = scoreMatchdayForPicks(picks, fixtures, results, dist, 0);
    expect(noStreak.multiplier).toBe(1);
    expect(noStreak.totalPoints).toBe(10);

    const maxStreak = scoreMatchdayForPicks(picks, fixtures, results, dist, 5);
    expect(maxStreak.multiplier).toBeCloseTo(1.25);
    expect(maxStreak.totalPoints).toBe(Math.round(10 * 1.25));
  });

  it("marks fullSlate true only when a pick exists for every fixture", () => {
    const fixtures = [makeFixture("f1"), makeFixture("f2")];
    const results: FixtureResult[] = [
      { fixtureId: "f1", outcome: "HOME", score: { home: 1, away: 0 } },
      { fixtureId: "f2", outcome: "DRAW", score: { home: 1, away: 1 } },
    ];
    const dist: PickDistribution[] = fixtures.map((f) => ({ fixtureId: f.id, home: 40, draw: 30, away: 30, totalPicks: 100 }));
    const partial = scoreMatchdayForPicks([{ fixtureId: "f1", outcome: "HOME" }], fixtures, results, dist, 0);
    expect(partial.fullSlate).toBe(false);
  });
});

describe("computePickDistribution", () => {
  it("tallies outcome picks per fixture across all players", () => {
    const fixtures = [makeFixture("f1")];
    const allPicks: Pick[][] = [
      [{ fixtureId: "f1", outcome: "HOME" }],
      [{ fixtureId: "f1", outcome: "HOME" }],
      [{ fixtureId: "f1", outcome: "DRAW" }],
      [{ fixtureId: "f1", outcome: "AWAY" }],
    ];
    const dist = computePickDistribution(fixtures, allPicks);
    expect(dist[0]).toMatchObject({ home: 2, draw: 1, away: 1, totalPicks: 4 });
  });
});

describe("computePrizes", () => {
  it("distributes the $25 sponsored pool across rank tiers and random draws", () => {
    const scores = Array.from({ length: 15 }, (_, i) => ({
      playerId: `p${i}`,
      breakdown: [],
      rawPoints: 100 - i,
      perfectBonus: 0,
      multiplier: 1,
      totalPoints: 100 - i,
      fullSlate: true,
    }));
    const prizes = computePrizes(scores, () => true);
    const rankPrizes = prizes.filter((p) => p.reason === "RANK");
    const drawPrizes = prizes.filter((p) => p.reason === "RANDOM_DRAW");

    expect(rankPrizes).toHaveLength(10);
    expect(rankPrizes.find((p) => p.rank === 1)?.amount).toBe(8);
    expect(rankPrizes.find((p) => p.rank === 2)?.amount).toBe(5);
    expect(rankPrizes.find((p) => p.rank === 3)?.amount).toBe(3);
    expect(rankPrizes.filter((p) => (p.rank ?? 0) >= 4).every((p) => p.amount === 1)).toBe(true);
    expect(drawPrizes).toHaveLength(4);
    expect(drawPrizes.every((p) => p.amount === 0.5)).toBe(true);

    const total = prizes.reduce((s, p) => s + p.amount, 0);
    expect(total).toBeCloseTo(25);
  });

  it("excludes players without any submitted picks from ranking", () => {
    const scores = [
      { playerId: "a", breakdown: [], rawPoints: 50, perfectBonus: 0, multiplier: 1, totalPoints: 50, fullSlate: true },
      { playerId: "b", breakdown: [], rawPoints: 0, perfectBonus: 0, multiplier: 1, totalPoints: 0, fullSlate: false },
    ];
    const prizes = computePrizes(scores, (id) => id === "a");
    expect(prizes.some((p) => p.playerId === "b")).toBe(false);
  });
});
