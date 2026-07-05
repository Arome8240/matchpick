import type { Fixture, Pick, SimPlayer } from "./types";
import { clamp, randInt, sampleOutcome } from "./rand";
import { sampleScoreline } from "./fixtures";

interface NamePool {
  username: string;
  country: string;
}

const NAME_POOL: NamePool[] = [
  { username: "ChidiBallsOut", country: "Nigeria" },
  { username: "AmaraTips9ja", country: "Nigeria" },
  { username: "TundeGunner", country: "Nigeria" },
  { username: "LagosLion10", country: "Nigeria" },
  { username: "EnyimbaFanatic", country: "Nigeria" },
  { username: "NaijaProphet", country: "Nigeria" },
  { username: "AbujaBaller", country: "Nigeria" },
  { username: "IjeCallsIt", country: "Nigeria" },
  { username: "OgaPredictor", country: "Nigeria" },
  { username: "Yemi_Analyst", country: "Nigeria" },
  { username: "KwameMensahJr", country: "Ghana" },
  { username: "AccraAceKofi", country: "Ghana" },
  { username: "GPLGuru", country: "Ghana" },
  { username: "AsanteFan01", country: "Ghana" },
  { username: "KotokoKing", country: "Ghana" },
  { username: "ZamaluxFan", country: "Egypt" },
  { username: "CairoOracle", country: "Egypt" },
  { username: "AhlyForever", country: "Egypt" },
  { username: "NileStriker", country: "Egypt" },
  { username: "SundownsQueen", country: "South Africa" },
  { username: "ChiefsTillIDie", country: "South Africa" },
  { username: "PSLPicker", country: "South Africa" },
  { username: "SowetoSharp", country: "South Africa" },
  { username: "NairobiNumbers", country: "Kenya" },
  { username: "HarambeeHawk", country: "Kenya" },
  { username: "DarStrikerTZ", country: "Tanzania" },
  { username: "SimbaSCFan", country: "Tanzania" },
  { username: "KampalaKicks", country: "Uganda" },
  { username: "CasaCasablanca", country: "Morocco" },
  { username: "WydadWarrior", country: "Morocco" },
  { username: "MoTheOracle", country: "Egypt" },
  { username: "PriyaKicksIt", country: "India" },
  { username: "CarlosPunter", country: "Brazil" },
  { username: "MariaPalpites", country: "Brazil" },
  { username: "JamesFCBLondon", country: "England" },
  { username: "PixelStriker", country: "England" },
  { username: "MancMike", country: "England" },
  { username: "GoalHunter22", country: "England" },
  { username: "MadridistaAna", country: "Spain" },
  { username: "CulerCarla", country: "Spain" },
  { username: "SevillaSteve", country: "Spain" },
  { username: "BettorBoye", country: "Nigeria" },
  { username: "PortHarcourtPro", country: "Nigeria" },
  { username: "KanoKlassic", country: "Nigeria" },
  { username: "IbadanIQ", country: "Nigeria" },
  { username: "JosPlateauJoy", country: "Nigeria" },
  { username: "BenueBaller", country: "Nigeria" },
  { username: "DeltaDynamo", country: "Nigeria" },
  { username: "OyoOracle", country: "Nigeria" },
  { username: "FCTFinesse", country: "Nigeria" },
  { username: "RiversUnitedRae", country: "Nigeria" },
  { username: "TemaTactician", country: "Ghana" },
  { username: "KumasiKid", country: "Ghana" },
  { username: "AlexAlgorithm", country: "USA" },
  { username: "DaveDoubleChance", country: "USA" },
  { username: "SofiaScoreline", country: "Bulgaria" },
  { username: "LiamLuckyStreak", country: "Ireland" },
  { username: "YukiYellowCard", country: "Japan" },
  { username: "OmarOverUnder", country: "Egypt" },
  { username: "ZaraZonalMark", country: "Kenya" },
  { username: "FemiFormGuide", country: "Nigeria" },
];

function initialsFromUsername(username: string): string {
  const letters = username.match(/[A-Z]/g);
  if (letters && letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function generateSimPlayers(count: number): SimPlayer[] {
  const pool = NAME_POOL.slice(0, count);
  return pool.map((entry, i) => {
    const skill = clamp(0.15 + Math.random() * 0.8, 0.1, 0.98);
    return {
      id: `bot_${i}`,
      username: entry.username,
      initials: initialsFromUsername(entry.username),
      country: entry.country,
      skill,
      streak: randInt(0, 3),
      lifetimePoints: randInt(0, 900),
      seasonPoints: 0,
      picksByMatchday: {},
      fullSlateByMatchday: {},
      badges: [],
    };
  });
}

/** A bot perceives true fixture probabilities blended toward uniform noise based on (lack of) skill. */
function perceivedProbs(trueProbs: Fixture["trueProbs"], skill: number) {
  const uniform = 1 / 3;
  return {
    home: trueProbs.home * skill + uniform * (1 - skill),
    draw: trueProbs.draw * skill + uniform * (1 - skill),
    away: trueProbs.away * skill + uniform * (1 - skill),
  };
}

export function generateBotPicks(
  player: SimPlayer,
  fixtures: Fixture[],
  activityBias: number
): { picks: Pick[]; fullSlate: boolean } {
  const participateChance = clamp(0.5 + player.skill * 0.35 + activityBias, 0.05, 0.98);
  if (Math.random() > participateChance) {
    return { picks: [], fullSlate: false };
  }

  const fullSlateChance = clamp(0.55 + player.skill * 0.4, 0.1, 0.97);
  const goesFullSlate = Math.random() < fullSlateChance;

  const targetFixtures = goesFullSlate
    ? fixtures
    : fixtures.filter(() => Math.random() < 0.5 + player.skill * 0.3);

  const picks: Pick[] = targetFixtures.map((fixture) => {
    const probs = perceivedProbs(fixture.trueProbs, player.skill);
    const outcome = sampleOutcome(probs);
    const pick: Pick = { fixtureId: fixture.id, outcome };
    if (Math.random() < 0.12 * player.skill) {
      pick.exactScore = sampleScoreline(outcome);
    }
    return pick;
  });

  return { picks, fullSlate: goesFullSlate && picks.length === fixtures.length };
}
