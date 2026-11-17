import { shrinkGlb } from "../lib/server/shrink";
for (const k of ["king", "pawn"]) await shrinkGlb(`spike/out/${k}.glb`, `spike/out/${k}-small.glb`);
