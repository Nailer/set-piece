import { notFound } from "next/navigation";
import { ReplaceLive } from "@/components/Replace";
import { getReplacement } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export default async function ReplaceResult(props: { params: Promise<{ id: string }> }) {
  const r = await getReplacement((await props.params).id);
  if (!r) notFound();
  return <ReplaceLive initial={r} />;
}
