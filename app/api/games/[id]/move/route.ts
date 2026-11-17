import { NextResponse } from "next/server";
import { move, publicGame } from "@/lib/server/games";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { token, san } = (await req.json().catch(() => ({}))) as { token?: string; san?: string };
  if (!token || !san) return NextResponse.json({ error: "Missing move." }, { status: 400 });
  const out = await move((await ctx.params).id, token, san);
  return "error" in out ? NextResponse.json(out, { status: 400 }) : NextResponse.json(publicGame(out));
}
