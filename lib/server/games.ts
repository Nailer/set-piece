import { randomBytes } from "node:crypto";
import { Chess } from "chess.js";
import type { GameRecord, Side } from "../types";
import { getGame, saveGame } from "./store";

export const token = () => randomBytes(12).toString("base64url");

/** Hides the seat tokens before a game is sent to the browser. */
export function publicGame(g: GameRecord): GameRecord {
  return { ...g, seats: { w: g.seats?.w ? "taken" : undefined, b: g.seats?.b ? "taken" : undefined } };
}

/** Plays a move on the server's copy of an online game, after checking whose turn it is. */
export async function move(id: string, seat: string, san: string): Promise<GameRecord | { error: string }> {
  const g = await getGame(id);
  if (!g) return { error: "No such game." };
  if (g.result) return { error: "The game is over." };
  const c = new Chess();
  for (const m of g.moves) c.move(m);
  const side: Side | null = g.seats?.w === seat ? "w" : g.seats?.b === seat ? "b" : null;
  if (!side) return { error: "You are not playing in this game." };
  if (c.turn() !== side) return { error: "It is not your turn." };
  try {
    const m = c.move(san);
    g.moves.push(m.san);
  } catch {
    return { error: "That move is not legal." };
  }
  if (c.isGameOver()) {
    g.result = c.isCheckmate() ? (c.turn() === "w" ? "0-1" : "1-0") : "1/2-1/2";
    g.reason = c.isCheckmate() ? "checkmate" : "draw";
  }
  g.updatedAt = Date.now();
  await saveGame(g);
  return g;
}
