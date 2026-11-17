// Can Lux3D keep six chess pieces in one style? King first, then each piece
// drawn with the king as the style reference, then two pieces built in 3D.
import { mkdir } from "node:fs/promises";
import { download, lux, run } from "../lib/server/lux";

const out = "spike/out";
await mkdir(out, { recursive: true });
const theme = process.argv[2] ?? "kitchen utensils carved from olive wood";
const t = (label: string) => {
  const t0 = Date.now();
  return () => console.log(label, ((Date.now() - t0) / 1000).toFixed(0) + "s");
};

const base = (piece: string) =>
  `A single ${piece} chess piece themed as ${theme}. One object standing upright on a round flat base, centred, front view, plain white background, studio product photo, nothing else in the picture`;

let done = t("king image");
const kingImg = await run((l) => l.multimodalToImage.create({ prompt: base("king") }));
done();
await download(kingImg, `${out}/king.png`);

for (const piece of ["queen", "knight", "pawn"]) {
  done = t(`${piece} image`);
  const url = await run((l) =>
    l.multimodalToImage.createFromFile(`${out}/king.png`, {
      prompt: `${base(piece)}. Match the exact style, material, colours and base of the king in the reference picture, but make it a ${piece}.`,
    }),
  );
  done();
  await download(url, `${out}/${piece}.png`);
}

for (const piece of ["king", "pawn"]) {
  done = t(`${piece} 3D`);
  const url = await run((l) =>
    l.imgTo3d.createFromFile(`${out}/${piece}.png`, { version: "G1-Turbo", outputFormat: ["glb"], aiPredictSize: true, faceCount: 30000 }),
  );
  done();
  await download(url, `${out}/${piece}.glb`);
}
console.log("DONE");
void lux;
