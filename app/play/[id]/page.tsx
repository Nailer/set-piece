import { notFound } from "next/navigation";
import { Play } from "@/components/Play";
import { getSet } from "@/lib/server/store";
import type { Side } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlayPage(props: Props) {
  const set = await getSet((await props.params).id);
  if (!set) notFound();
  const q = await props.searchParams;
  const mode = q.mode === "local" ? "local" : "cpu";
  const level = Math.max(1, Math.min(4, Number(q.level) || 1));
  const side: Side = q.side === "b" ? "b" : q.side === "random" ? (Math.random() < 0.5 ? "w" : "b") : "w";
  return <Play key={`${set.id}-${mode}-${level}-${side}`} set={set} mode={mode} level={level} side={side} />;
}
