import { NextResponse } from "next/server";
import { token } from "@/lib/server/games";
import { getGame, saveGame } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** The second person to open an online game takes the empty seat. Anyone after that watches. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await getGame((await ctx.params).id);
  if (!g) return NextResponse.json({ error: "No such game." }, { status: 404 });
  const free = !g.seats?.w ? "w" : !g.seats?.b ? "b" : null;
  if (!free) return NextResponse.json({ error: "Both seats are taken. You can watch." }, { status: 409 });
  const seat = token();
  g.seats = { ...g.seats, [free]: seat };
  g.updatedAt = Date.now();
  await saveGame(g);
  return NextResponse.json({ side: free, token: seat });
}
