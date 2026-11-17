import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { newId } from "./store";

const MAX_BYTES = 12 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/** Saves an uploaded photo to a temporary file, or explains what is wrong with it. */
export async function stash(file: FormDataEntryValue | null): Promise<string | undefined | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return undefined;
  const ext = EXT[file.type];
  if (!ext) return { error: "Photos must be JPG, PNG or WebP." };
  if (file.size > MAX_BYTES) return { error: "That photo is over 12 MB. Use a smaller one." };
  const dest = path.join(os.tmpdir(), `${newId("upload")}${ext}`);
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return dest;
}

const counts = new Map<string, number>();

/** The public demo shares one Lux3D account, so builds are rationed per visitor per day. */
export function ration(req: Request, perDay: number): string | null {
  const day = new Date().toISOString().slice(0, 10);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${day}:${ip}`;
  const n = counts.get(key) ?? 0;
  if (n >= perDay) return `You have used today's ${perDay} builds. More open at midnight UTC.`;
  counts.set(key, n + 1);
  return null;
}

export function isAdmin(form: FormData | URLSearchParams): boolean {
  const token = process.env.ADMIN_TOKEN;
  return Boolean(token) && form.get("admin") === token;
}
