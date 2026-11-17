import { NextResponse } from "next/server";
import { reforgePiece } from "@/lib/server/forge";
import { hasApiKey } from "@/lib/server/lux";
import { getSet } from "@/lib/server/store";
import { ration } from "@/lib/server/upload";
import { KINDS, type Kind } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Redraws one piece. Only pieces that failed can be redone, so finished sets cannot be vandalised. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasApiKey()) return NextResponse.json({ error: "Forging is switched off on this server." }, { status: 503 });
  const set = await getSet((await ctx.params).id);
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: Kind };
  if (!set || !kind || !KINDS.includes(kind)) return NextResponse.json({ error: "Unknown piece." }, { status: 400 });
  if (set.pieces[kind]?.modelUrl && !set.pieces[kind]?.error) return NextResponse.json({ error: "That piece is already made." }, { status: 400 });
  const limited = ration(req, 6);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  await reforgePiece(set.id, kind);
  return NextResponse.json({ ok: true });
}
