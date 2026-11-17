import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintStudio } from "@/components/PrintStudio";
import { getSet } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export default async function PrintPage(props: { params: Promise<{ id: string }> }) {
  const set = await getSet((await props.params).id);
  if (!set) notFound();
  return (
    <main className="page">
      <p style={{ margin: "0 0 16px" }}>
        <Link href={`/set/${set.id}`}>← {set.name}</Link>
      </p>
      <PrintStudio set={set} />
    </main>
  );
}
