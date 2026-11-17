import { promises as fs } from "node:fs";
import path from "node:path";
import { FILES_DIR } from "@/lib/server/paths";
import { ensureSeed } from "@/lib/server/store";

const TYPES: Record<string, string> = { ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  await ensureSeed();
  const file = path.join(FILES_DIR, ...(await ctx.params).path);
  if (!file.startsWith(FILES_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const stat = await fs.stat(file);
    const etag = `"${stat.size.toString(36)}-${Math.round(stat.mtimeMs).toString(36)}"`;
    const headers = { ETag: etag, "Cache-Control": "public, no-cache" };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { ...headers, "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream", "Content-Length": String(data.byteLength) },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
