import type { Finish } from "./game/board";

/**
 * What a player has earned, kept in their browser. Beating each computer
 * level unlocks the next one, and the two rarest finishes are prizes.
 */
export interface Progress {
  /** Wins against each computer level, 1 to 4. */
  wins: Record<number, number>;
}

export const LEVELS = [
  { level: 1, name: "Easy", note: "Learns the rules with you. Leaves pieces hanging." },
  { level: 2, name: "Club", note: "Spots simple tactics and punishes free pieces." },
  { level: 3, name: "Expert", note: "Plans a few moves ahead. Hard to fool." },
  { level: 4, name: "Master", note: "Thinks deepest. Beat it to earn the gold finish." },
];

export const FINISHES: { id: Finish; name: string; unlock?: number }[] = [
  { id: "natural", name: "Walnut" },
  { id: "ebony", name: "Ebony" },
  { id: "jade", name: "Jade", unlock: 2 },
  { id: "gold", name: "Gold", unlock: 4 },
];

const KEY = "sp.progress";

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Progress | null;
    if (p?.wins) return p;
  } catch {
    // storage blocked
  }
  return { wins: {} };
}

export function recordWin(level: number): Progress {
  const p = loadProgress();
  p.wins[level] = (p.wins[level] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked
  }
  return p;
}

/** A level is open once the one below it has been beaten. */
export const levelOpen = (p: Progress, level: number) => level === 1 || (p.wins[level - 1] ?? 0) > 0;
export const finishOpen = (p: Progress, unlock?: number) => !unlock || (p.wins[unlock] ?? 0) > 0;
