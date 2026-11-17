import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChessSet, GameRecord, Replacement } from "../types";
import { DATA_DIR, FILES_DIR, SEED_DIR } from "./paths";

/** File-backed storage. Lux3D result links expire, so every file is copied here and served from /api/file/…. */
const SETS = path.join(DATA_DIR, "sets.json");
const GAMES = path.join(DATA_DIR, "games.json");
const REPLACEMENTS = path.join(DATA_DIR, "replacements.json");
const SEED_MARK = path.join(DATA_DIR, ".seed-version");

let writing: Promise<unknown> = Promise.resolve();

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Writes are queued so two requests cannot clobber each other. */
function writeJson(file: string, value: unknown): Promise<void> {
  const next = writing.then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 1));
    await fs.rename(tmp, file);
  });
  writing = next.catch(() => undefined);
  return next;
}

/** Updates a JSON list in place, inside the write queue so concurrent changes are not lost. */
function mutate<T>(file: string, fn: (list: T[]) => T[] | void): Promise<void> {
  const next = writing.then(async () => {
    const list = await readJson<T[]>(file, []);
    const out = fn(list) ?? list;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 1));
    await fs.rename(tmp, file);
  });
  writing = next.catch(() => undefined);
  return next;
}

let seeded: Promise<void> | null = null;

/** Copies the sets that ship with the app into the data folder, without touching anything players made. */
export function ensureSeed(): Promise<void> {
  return (seeded ??= (async () => {
    try {
      const want = (await fs.readFile(path.join(SEED_DIR, "VERSION"), "utf8").catch(() => "1")).trim();
      const have = (await fs.readFile(SEED_MARK, "utf8").catch(() => "")).trim();
      if (have === want) return;
      await fs.mkdir(FILES_DIR, { recursive: true });
      await fs.cp(path.join(SEED_DIR, "files"), FILES_DIR, { recursive: true, force: true });
      const shipped = await readJson<ChessSet[]>(path.join(SEED_DIR, "sets.json"), []);
      await mutate<ChessSet>(SETS, (list) => {
        const known = new Map(list.map((s) => [s.id, s]));
        for (const s of shipped) known.set(s.id, { ...s, plays: known.get(s.id)?.plays ?? s.plays });
        return [...known.values()];
      });
      await fs.writeFile(SEED_MARK, want);
    } catch {
      // No seed folder: the gallery starts empty.
    }
  })());
}

export async function listSets(): Promise<ChessSet[]> {
  await ensureSeed();
  const all = await readJson<ChessSet[]>(SETS, []);
  return all.sort((a, b) => Number(Boolean(b.starter)) - Number(Boolean(a.starter)) || b.createdAt - a.createdAt);
}

export async function getSet(id: string): Promise<ChessSet | null> {
  return (await listSets()).find((s) => s.id === id) ?? null;
}

export function saveSet(set: ChessSet): Promise<void> {
  return mutate<ChessSet>(SETS, (list) => {
    const i = list.findIndex((s) => s.id === set.id);
    if (i >= 0) list[i] = set;
    else list.push(set);
  });
}

export function patchSet(id: string, fn: (s: ChessSet) => void): Promise<void> {
  return mutate<ChessSet>(SETS, (list) => {
    const s = list.find((x) => x.id === id);
    if (s) fn(s);
  });
}

export async function getGame(id: string): Promise<GameRecord | null> {
  return (await readJson<GameRecord[]>(GAMES, [])).find((g) => g.id === id) ?? null;
}

export async function listGames(limit = 30): Promise<GameRecord[]> {
  const all = await readJson<GameRecord[]>(GAMES, []);
  return all.filter((g) => g.result).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export function saveGame(g: GameRecord): Promise<void> {
  return mutate<GameRecord>(GAMES, (list) => {
    const i = list.findIndex((x) => x.id === g.id);
    if (i >= 0) list[i] = g;
    else list.push(g);
    // Old unfinished games are dropped so the file stays small.
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
    return list.filter((x) => x.result || x.updatedAt > cutoff).slice(-3000);
  });
}

export async function listReplacements(): Promise<Replacement[]> {
  return (await readJson<Replacement[]>(REPLACEMENTS, [])).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getReplacement(id: string): Promise<Replacement | null> {
  return (await listReplacements()).find((r) => r.id === id) ?? null;
}

export function saveReplacement(r: Replacement): Promise<void> {
  return mutate<Replacement>(REPLACEMENTS, (list) => {
    const i = list.findIndex((x) => x.id === r.id);
    if (i >= 0) list[i] = r;
    else list.push(r);
  });
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export { FILES_DIR };
