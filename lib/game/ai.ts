import { Chess } from "chess.js";
import engine from "js-chess-engine";

/**
 * Picks the computer's move with js-chess-engine (MIT). Levels 1 to 4 map to
 * its search depths: 1 misses easy tactics on purpose, 4 looks well ahead.
 * Returns SAN for chess.js, which stays the single source of the rules.
 */
export function bestMove(fen: string, level: number): string | null {
  const c = new Chess(fen);
  if (c.isGameOver()) return null;
  try {
    const move = engine.aiMove(fen, Math.max(1, Math.min(4, level))) as Record<string, string>;
    const [from, to] = Object.entries(move)[0] ?? [];
    if (from && to) {
      const piece = c.get(from.toLowerCase() as never);
      const promo = piece?.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : undefined;
      const m = c.move({ from: from.toLowerCase(), to: to.toLowerCase(), promotion: promo });
      if (m) return m.san;
    }
  } catch {
    // Fall through to any legal move rather than freezing the game.
  }
  const moves = new Chess(fen).moves();
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
}
