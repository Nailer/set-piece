import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Thin wrappers around the Aholo Lux3D SDK. Every 3D asset in Set Piece comes
 * through here. They retry the two things that go wrong in practice: the
 * account being busy (one generation at a time) and dropped connections.
 */

export const NETWORK = /fetch failed|timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network|aborted/i;
const BUSY = /CONCURRENCY|concurren|busy|too many/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const region = (): "com" | "cn" => (process.env.AHOLO_REGION === "cn" ? "cn" : "com");
export const hasApiKey = () => Boolean(process.env.AHOLO_API_KEY);

type Lux = Awaited<ReturnType<typeof client>>;
let cached: Promise<Lux> | null = null;

async function client() {
  const { createLux3dClient } = await import("@manycore/aholo-sdk-lux3d");
  return createLux3dClient({ region: region() });
}

export function lux(): Promise<Lux> {
  return (cached ??= client());
}

/** Starts a task, retrying while the account is busy or the network drops. */
export async function start(fn: (l: Lux) => Promise<number>): Promise<number> {
  const l = await lux();
  for (let i = 0; ; i++) {
    try {
      return await fn(l);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!(BUSY.test(msg) || NETWORK.test(msg)) || i >= 30) throw err;
      await sleep(10_000);
    }
  }
}

/** Waits for a task. A dropped connection does not stop the task, so the wait resumes. */
export async function finish(taskId: number, minutes = 10): Promise<string[]> {
  const l = await lux();
  const deadline = Date.now() + minutes * 60_000;
  for (;;) {
    try {
      const res = await l.tasks.waitFor(taskId, { intervalMs: 3000, timeoutMs: Math.max(30_000, deadline - Date.now()) });
      return res.outputs.map((o) => o.content ?? "").filter(Boolean);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!NETWORK.test(msg) || Date.now() > deadline) throw err;
      await sleep(6000);
    }
  }
}

export async function run(fn: (l: Lux) => Promise<number>, minutes?: number): Promise<string> {
  const outputs = await finish(await start(fn), minutes);
  const url = outputs.find((o) => o.startsWith("http"));
  if (!url) throw new Error("Lux3D finished but returned no file.");
  return url;
}

export async function download(url: string, dest: string): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not download a Lux3D result (${res.status}).`);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (err) {
      if (i >= 5 || !NETWORK.test(String(err))) throw err;
      await sleep(4000 * (i + 1));
    }
  }
}

export function explain(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/auth|api key|401|403/i.test(msg)) return "Lux3D rejected the API key.";
  if (/credit|quota|balance/i.test(msg)) return "This Lux3D account is out of credits.";
  if (BUSY.test(msg)) return "Lux3D is busy with another build on this account. Try again in a few minutes.";
  if (NETWORK.test(msg)) return "The connection to Lux3D kept dropping. Try again in a few minutes.";
  if (/status=4|failed/i.test(msg)) return "Lux3D could not make this piece. Try wording the theme differently.";
  return msg;
}
