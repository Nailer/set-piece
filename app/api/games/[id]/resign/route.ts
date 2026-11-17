import { NextResponse } from "next/server";
import { getGame, saveGame } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  const g = await getGame((await ctx.params).id);
  if (!g || g.result) return NextResponse.json({ error: "No game to resign." }, { status: 400 });
  const side = g.seats?.w === token ? "w" : g.seats?.b === token ? "b" : null;
  if (!side) return NextResponse.json({ error: "You are not playing in this game." }, { status: 403 });
  g.result = side === "w" ? "0-1" : "1-0";
  g.reason = "resigned";
  g.updatedAt = Date.now();
  await saveGame(g);
  return NextResponse.json({ ok: true });
}
