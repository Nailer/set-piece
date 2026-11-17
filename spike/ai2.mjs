import engine from "js-chess-engine";
const { aiMove } = engine;
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
for (const level of [1, 2, 3, 4]) {
  const t0 = Date.now();
  const m = aiMove(fen, level);
  console.log("level", level, JSON.stringify(m), Date.now() - t0, "ms");
}
const mid = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 1 5";
for (const level of [1, 2, 3, 4]) { const t0 = Date.now(); console.log("mid", level, JSON.stringify(aiMove(mid, level)), Date.now() - t0, "ms"); }
const mate = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
console.log("mate", JSON.stringify(aiMove(mate, 1)), JSON.stringify(aiMove(mate, 2)));
