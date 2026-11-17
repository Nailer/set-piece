import { promises as fs } from "node:fs";
import sharp from "sharp";
const sets = JSON.parse(await fs.readFile("seed/sets.json", "utf8"));
for (const s of sets) {
  for (const k of Object.keys(s.pieces)) {
    const p = s.pieces[k];
    if (!p.imageUrl?.includes(".png")) continue;
    const src = `seed/files/${s.id}/${k}.png`;
    await sharp(src).resize(640, 640, { fit: "inside" }).webp({ quality: 84 }).toFile(`seed/files/${s.id}/${k}.webp`);
    await fs.rm(src);
    p.imageUrl = p.imageUrl.replace(/\.png(\?.*)?$/, ".webp");
  }
}
await fs.writeFile("seed/sets.json", JSON.stringify(sets, null, 1));
