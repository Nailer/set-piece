import { promises as fs } from "node:fs";
import path from "node:path";
import { KINDS, KIND_NAME, type ChessSet, type Job, type Kind, type Piece, type Replacement, type Stage } from "../types";
import { download, explain, run } from "./lux";
import { FILES_DIR } from "./paths";
import { shrinkGlb } from "./shrink";
import { getSet, newId, patchSet, saveReplacement, saveSet } from "./store";

/**
 * The forge. Every piece goes through Aholo Lux3D twice:
 *   1. multimodal-to-image draws it, using the king as the style reference
 *      so all six pieces share one material, palette and base;
 *   2. image-to-3D builds it as a GLB.
 * Pieces are written to the set as they finish, so the board can swap them in live.
 */

/** What makes each piece readable on a board, whatever the theme. */
const SILHOUETTE: Record<Kind, string> = {
  k: "the tallest and broadest piece, topped with a large, clearly visible cross standing upright at the very top",
  q: "slimmer than a king, topped with an open ring of pointed spikes (a coronet) around a single round ball; it has no cross anywhere",
  r: "a short, wide castle tower with square battlements around a flat top",
  b: "a slim piece with a rounded pointed mitre on top, cut by one diagonal slit",
  n: "a horse's head and neck, facing to the side, on a base",
  p: "the smallest piece, a short body with a simple round ball on top",
};

const prompt = (k: Kind, theme: string) =>
  `A single ${KIND_NAME[k].toLowerCase()} chess piece themed as ${theme}. It is ${SILHOUETTE[k]}. One object standing upright on a round flat base, centred, front view, plain white background, studio product photo, nothing else in the picture.`;

const follow = (k: Kind, theme: string) =>
  `${prompt(k, theme)} Copy only the material, colours, surface detail and the round base of the king in the reference picture. The shape must be a ${KIND_NAME[k].toLowerCase()}, not a king: ${SILHOUETTE[k]}.`;

interface QueueState {
  jobs: Map<string, Job>;
  order: string[];
  chain: Promise<void>;
}
const g = globalThis as unknown as { __forgeQueue?: QueueState };
const state: QueueState = (g.__forgeQueue ??= { jobs: new Map(), order: [], chain: Promise.resolve() });

export function getJob(id: string): Job | null {
  const job = state.jobs.get(id);
  if (!job) return null;
  const waiting = state.order.filter((j) => !["done", "failed"].includes(state.jobs.get(j)?.status ?? ""));
  return { ...job, ahead: Math.max(0, waiting.indexOf(id)) };
}

const emptyPieces = (): Record<Kind, Piece> =>
  Object.fromEntries(KINDS.map((k) => [k, { kind: k, stages: [] }])) as unknown as Record<Kind, Piece>;

/** Creates the set record straight away so players can open it and play while it forges. */
export async function forge(input: { name: string; theme: string; author?: string; photoPath?: string; id?: string; starter?: boolean }): Promise<{ job: Job; set: ChessSet }> {
  const id = input.id ?? newId("set");
  const set: ChessSet = {
    id,
    name: input.name,
    theme: input.theme,
    author: input.author,
    pieces: emptyPieces(),
    status: "forging",
    createdAt: Date.now(),
    plays: 0,
    starter: input.starter,
  };
  if (input.photoPath) {
    const ext = path.extname(input.photoPath) || ".jpg";
    await fs.mkdir(path.join(FILES_DIR, id), { recursive: true });
    await fs.copyFile(input.photoPath, path.join(FILES_DIR, id, `photo${ext}`));
    set.photoUrl = `/api/file/${id}/photo${ext}`;
  }
  await saveSet(set);
  const job: Job = { id: newId("job"), setId: id, status: "queued", ahead: 0 };
  state.jobs.set(job.id, job);
  state.order.push(job.id);
  state.chain = state.chain.then(() => runForge(job, set, input.photoPath)).catch(() => undefined);
  return { job: getJob(job.id)!, set };
}

async function timed<T>(stages: Stage[], name: string, label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  stages.push({ name, label, ms: Date.now() - t0 });
  return out;
}

async function runForge(job: Job, set: ChessSet, photoPath?: string) {
  job.status = "forging";
  const dir = path.join(FILES_DIR, set.id);
  const base = `/api/file/${set.id}`;
  await fs.mkdir(dir, { recursive: true });
  let made = 0;
  try {
    // 1. Draw all six pieces first, the king setting the style for the rest.
    const images: Partial<Record<Kind, string>> = {};
    for (const k of KINDS) {
      const stages: Stage[] = [];
      try {
        const url = await timed(stages, "draw", "Drawn by Lux3D", () =>
          run((l) => {
            if (k === "k") {
              return photoPath
                ? l.multimodalToImage.createFromFile(photoPath, {
                    prompt: `${prompt("k", set.theme)} Take the material, colours and style from the object in this photo.`,
                  })
                : l.multimodalToImage.create({ prompt: prompt("k", set.theme) });
            }
            return l.multimodalToImage.createFromFile(images.k!, { prompt: follow(k, set.theme) });
          }),
        );
        const file = path.join(dir, `${k}.png`);
        await download(url, file);
        images[k] = file;
        await patchSet(set.id, (s) => {
          s.pieces[k] = { ...s.pieces[k], imageUrl: `${base}/${k}.png`, stages };
        });
      } catch (err) {
        if (k === "k") throw err;
        await patchSet(set.id, (s) => {
          s.pieces[k] = { ...s.pieces[k], error: explain(err) };
        });
      }
    }

    // 2. Build each drawing in 3D. The board swaps every piece in as it lands.
    for (const k of KINDS) {
      if (!images[k]) continue;
      try {
        const stages: Stage[] = [];
        const url = await timed(stages, "build", "Built in 3D by Lux3D", () =>
          run((l) => l.imgTo3d.createFromFile(images[k]!, { version: "G1-Turbo", outputFormat: ["glb"], faceCount: 30000 })),
        );
        const raw = path.join(dir, `${k}-raw.glb`);
        await download(url, raw);
        await shrinkGlb(raw, path.join(dir, `${k}.glb`));
        await fs.rm(raw, { force: true });
        made++;
        await patchSet(set.id, (s) => {
          s.pieces[k] = { ...s.pieces[k], modelUrl: `${base}/${k}.glb`, stages: [...s.pieces[k].stages, ...stages], error: undefined };
        });
      } catch (err) {
        await patchSet(set.id, (s) => {
          s.pieces[k] = { ...s.pieces[k], error: explain(err) };
        });
      }
    }
    await patchSet(set.id, (s) => {
      s.status = made > 0 ? "ready" : "failed";
    });
    job.status = made > 0 ? "done" : "failed";
    if (!made) job.error = "Lux3D could not build any pieces for this set.";
  } catch (err) {
    job.status = "failed";
    job.error = explain(err);
    await patchSet(set.id, (s) => {
      s.status = "failed";
    });
  } finally {
    if (photoPath) await fs.rm(photoPath, { force: true }).catch(() => undefined);
  }
}

/** Re-forges one piece of an existing set, e.g. one that failed or that the owner wants redrawn. */
export async function reforgePiece(setId: string, k: Kind): Promise<void> {
  const set = await getSet(setId);
  if (!set) return;
  state.chain = state.chain
    .then(async () => {
      const dir = path.join(FILES_DIR, setId);
      const base = `/api/file/${setId}`;
      const stages: Stage[] = [];
      try {
        const ref = path.join(dir, "k.png");
        const url = await timed(stages, "draw", "Drawn by Lux3D", () =>
          run((l) => (k === "k" ? l.multimodalToImage.create({ prompt: prompt("k", set.theme) }) : l.multimodalToImage.createFromFile(ref, { prompt: follow(k, set.theme) }))),
        );
        await download(url, path.join(dir, `${k}.png`));
        const glb = await timed(stages, "build", "Built in 3D by Lux3D", () =>
          run((l) => l.imgTo3d.createFromFile(path.join(dir, `${k}.png`), { version: "G1-Turbo", outputFormat: ["glb"], faceCount: 30000 })),
        );
        await download(glb, path.join(dir, `${k}-raw.glb`));
        await shrinkGlb(path.join(dir, `${k}-raw.glb`), path.join(dir, `${k}.glb`));
        await fs.rm(path.join(dir, `${k}-raw.glb`), { force: true });
        const v = Date.now().toString(36);
        await patchSet(setId, (s) => {
          s.pieces[k] = { kind: k, imageUrl: `${base}/${k}.png?v=${v}`, modelUrl: `${base}/${k}.glb?v=${v}`, stages };
        });
      } catch (err) {
        await patchSet(setId, (s) => {
          s.pieces[k] = { ...s.pieces[k], error: explain(err) };
        });
      }
    })
    .catch(() => undefined);
}

/**
 * Missing piece: from a photo of a piece that survived, Lux3D draws the lost
 * one in the same style, then builds it in 3D for printing.
 */
export async function replace(input: { photoPath: string; missing: Kind | string }): Promise<Replacement> {
  const id = newId("rep");
  const dir = path.join(FILES_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(input.photoPath) || ".jpg";
  await fs.copyFile(input.photoPath, path.join(dir, `photo${ext}`));
  const kind = (KINDS as string[]).includes(input.missing) ? (input.missing as Kind) : null;
  const name = kind ? KIND_NAME[kind] : String(input.missing).slice(0, 40);
  const rep: Replacement = { id, name, photoUrl: `/api/file/${id}/photo${ext}`, status: "working", createdAt: Date.now(), stages: [] };
  await saveReplacement(rep);
  state.chain = state.chain
    .then(async () => {
      try {
        const describe = kind ? `a ${name.toLowerCase()} chess piece: ${SILHOUETTE[kind]}` : `a ${name}`;
        const img = await timed(rep.stages, "draw", "Drawn to match by Lux3D", () =>
          run((l) =>
            l.multimodalToImage.createFromFile(input.photoPath, {
              prompt: `Make ${describe}, from the same set as the object in this photo: the same material, colour, finish, proportions and base. One object standing upright, centred, front view, plain white background, studio product photo.`,
            }),
          ),
        );
        await download(img, path.join(dir, "piece.png"));
        rep.imageUrl = `/api/file/${id}/piece.png`;
        await saveReplacement(rep);
        const glb = await timed(rep.stages, "build", "Built in 3D by Lux3D", () =>
          run((l) => l.imgTo3d.createFromFile(path.join(dir, "piece.png"), { version: "G1-Turbo", outputFormat: ["glb"], faceCount: 30000 })),
        );
        await download(glb, path.join(dir, "raw.glb"));
        await shrinkGlb(path.join(dir, "raw.glb"), path.join(dir, "piece.glb"));
        await fs.rm(path.join(dir, "raw.glb"), { force: true });
        rep.modelUrl = `/api/file/${id}/piece.glb`;
        rep.status = "ready";
      } catch (err) {
        rep.status = "failed";
        rep.error = explain(err);
      }
      await saveReplacement(rep);
      await fs.rm(input.photoPath, { force: true }).catch(() => undefined);
    })
    .catch(() => undefined);
  return rep;
}

/** How many forges are waiting, so pages can say how long the line is. */
export function queueLength(): number {
  return state.order.filter((j) => !["done", "failed"].includes(state.jobs.get(j)?.status ?? "")).length;
}
