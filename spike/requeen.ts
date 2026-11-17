import { reforgePiece } from "../lib/server/forge";
import { getSet } from "../lib/server/store";
await reforgePiece("set-kitchen", "q");
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await getSet("set-kitchen");
  const q = s!.pieces.q;
  if (q.error || q.modelUrl?.includes("?v=")) { console.log("DONE", q.error ?? q.modelUrl); break; }
}
