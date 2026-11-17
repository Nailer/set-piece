import { bestMove } from "./ai";

self.onmessage = (e: MessageEvent<{ id: number; fen: string; level: number }>) => {
  const { id, fen, level } = e.data;
  const san = bestMove(fen, level);
  (self as unknown as Worker).postMessage({ id, san });
};
