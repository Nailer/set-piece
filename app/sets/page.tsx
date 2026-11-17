import Link from "next/link";
import { SetCard } from "@/components/SetCard";
import { listSets } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sets — Set Piece" };

export default async function Sets() {
  const sets = await listSets();
  return (
    <main className="page">
      <h1 className="display" style={{ fontSize: "var(--step-4)" }}>
        Every set
      </h1>
      <p className="lede">
        {sets.length} sets, each one designed from a single sentence or photo. Open one to see its pieces, play with it, or
        print it.
      </p>
      <div className="sets" style={{ marginTop: 28 }}>
        {sets.map((s) => (
          <SetCard key={s.id} set={s} />
        ))}
      </div>
      {!sets.length && (
        <p className="notice">
          No sets yet. <Link href="/forge">Forge the first one.</Link>
        </p>
      )}
    </main>
  );
}
