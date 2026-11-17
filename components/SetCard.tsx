import Link from "next/link";
import { KINDS, KIND_NAME, type ChessSet } from "@/lib/types";

/** The six pieces standing in a row, as Lux3D drew them. */
export function Lineup({ set }: { set: ChessSet }) {
  return (
    <div className="lineup" aria-hidden>
      {(["r", "n", "b", "k", "q", "p"] as const).map((k) =>
        set.pieces[k]?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={set.pieces[k].imageUrl} alt="" loading="lazy" />
        ) : (
          <span key={k} className="ghost" />
        ),
      )}
    </div>
  );
}

export function SetCard({ set }: { set: ChessSet }) {
  const built = KINDS.filter((k) => set.pieces[k]?.modelUrl).length;
  return (
    <Link href={`/set/${set.id}`} className="set-card" aria-label={`${set.name}: ${KINDS.map((k) => KIND_NAME[k]).join(", ")}`}>
      <Lineup set={set} />
      <div className="meta">
        <h3>
          {set.name}
          {set.status === "forging" && <span className="badge forging">Forging {built}/6</span>}
          {set.starter && <span className="badge">House set</span>}
        </h3>
        <p>“{set.theme}”</p>
        <p>
          {set.plays} {set.plays === 1 ? "game" : "games"} played{set.author ? ` · by ${set.author}` : ""}
        </p>
      </div>
    </Link>
  );
}
