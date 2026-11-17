import { NextResponse } from "next/server";
import { publicGame } from "@/lib/server/games";
import { getGame } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await getGame((await ctx.params).id);
  return g ? NextResponse.json(publicGame(g)) : NextResponse.json({ error: "No such game." }, { status: 404 });
}
