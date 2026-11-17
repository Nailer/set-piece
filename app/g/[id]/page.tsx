import { notFound } from "next/navigation";
import { Play } from "@/components/Play";
import { publicGame } from "@/lib/server/games";
import { getGame, getSet } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Online game — Set Piece" };

export default async function OnlineGame(props: { params: Promise<{ id: string }> }) {
  const game = await getGame((await props.params).id);
  if (!game) notFound();
  const set = await getSet(game.setId);
  if (!set) notFound();
  return <Play set={set} mode="online" game={publicGame(game)} />;
}
