export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randChoice<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export function randId(prefix: string, length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += randChoice(chars.split(""));
  return `${prefix}_${out}`;
}

export function randCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[randInt(0, chars.length - 1)];
  return out;
}

export function randTxHash(): string {
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 24; i++) out += chars[randInt(0, chars.length - 1)];
  return out;
}

/** Weighted sample from a list of {value, weight} entries. */
export function weightedSample<T>(entries: Array<{ value: T; weight: number }>): T {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

/** Sample an outcome from a probability triple. */
export function sampleOutcome(probs: { home: number; draw: number; away: number }): "HOME" | "DRAW" | "AWAY" {
  const r = Math.random();
  if (r < probs.home) return "HOME";
  if (r < probs.home + probs.draw) return "DRAW";
  return "AWAY";
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Fisher-Yates shuffle, mutates and returns the given array. */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
