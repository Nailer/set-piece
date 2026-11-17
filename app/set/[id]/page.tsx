import { notFound } from "next/navigation";
import { SetLive } from "@/components/SetLive";
import { getSet } from "@/lib/server/store";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props) {
  const s = await getSet((await props.params).id);
  return { title: s ? `${s.name} — Set Piece` : "Set Piece" };
}

export default async function SetPage(props: Props) {
  const set = await getSet((await props.params).id);
  if (!set) notFound();
  return <SetLive initial={set} />;
}
