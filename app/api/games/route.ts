import { NextResponse } from "next/server";
import { publicGame, token } from "@/lib/server/games";
import { getSet, newId, saveGame } from "@/lib/server/store";
import type { GameRecord, Side } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Opens an online game. The creator gets a seat token; the friend gets the other seat when they open the link. */
export async function POST(req: Request) {
  const { setId, side } = (await req.json().catch(() => ({}))) as { setId?: string; side?: Side };
  if (!setId || !(await getSet(setId))) return NextResponse.json({ error: "Unknown set." }, { status: 400 });
  const mine: Side = side === "b" ? "b" : "w";
  const seat = token();
  const g: GameRecord = {
    id: newId("g"),
    setId,
    moves: [],
    white: "friend",
    black: "friend",
    level: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seats: { [mine]: seat },
  };
  await saveGame(g);
  return NextResponse.json({ game: publicGame(g), token: seat, side: mine });
}
