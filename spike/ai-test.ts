import { Chess } from "chess.js";
import { bestMove } from "../lib/game/ai";
for (const level of [1, 2, 3]) {
  const c = new Chess();
  let t = 0, moves = 0;
  while (!c.isGameOver() && moves < 20) {
    const t0 = Date.now();
    const san = bestMove(c.fen(), level)!;
    t = Math.max(t, Date.now() - t0);
    c.move(san);
    moves++;
  }
  console.log("level", level, "slowest move ms", t, "pgn", c.pgn().slice(0, 120));
}
// Mate in one must be found: white to play Qh5xf7#? Scholar's position.
const m = new Chess("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
console.log("mate in one found:", bestMove(m.fen(), 2), bestMove(m.fen(), 3));
