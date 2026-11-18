import Link from "next/link";
import { Demo } from "@/components/Demo";
import { SetCard } from "@/components/SetCard";
import { listSets } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sets = await listSets();
  const featured = sets.find((s) => s.status === "ready" && Object.values(s.pieces).every((p) => p.modelUrl)) ?? sets.find((s) => s.status === "ready") ?? null;
  return (
    <>
      <section className="hero">
        <Demo set={featured} />
        <div className="hero-copy">
          <h1>
            Any theme. <em>A whole chess set.</em>
          </h1>
          <p className="lede">
            Describe a theme, or show a photo. Aholo Lux3D designs all six pieces in one style and builds them in 3D. Play
            the set against the computer or a friend, then print it.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link className="btn btn-primary btn-big" href="/forge">
              Forge a set
            </Link>
            {featured && (
              <Link className="btn btn-big" href={`/play/${featured.id}?mode=cpu&level=1`}>
                Play now
              </Link>
            )}
          </div>
        </div>
        {featured && (
          <p className="caption">
            {featured.name}, forged from “{featured.theme}”, replaying Morphy’s Opera Game (Paris, 1858).
          </p>
        )}
      </section>

      <div className="page">
        <h2 className="section-title" style={{ marginTop: 20 }}>
          How a set is forged
        </h2>
        <ol className="steps">
          <li>
            <strong>You give it a theme</strong>
            <span>A sentence, or a photo to take the style from.</span>
          </li>
          <li>
            <strong>Lux3D draws the king</strong>
            <span>Multimodal-to-image sets the style for the whole set.</span>
          </li>
          <li>
            <strong>…and the other five to match</strong>
            <span>Each piece is drawn with the king as its reference, so they belong together.</span>
          </li>
          <li>
            <strong>Then builds each in 3D</strong>
            <span>Image-to-3D, scaled to tournament heights, on the board as each one lands.</span>
          </li>
        </ol>

        <h2 className="section-title">The sets</h2>
        <div className="sets">
          {sets.slice(0, 6).map((s) => (
            <SetCard key={s.id} set={s} />
          ))}
        </div>
        {sets.length > 6 && (
          <p style={{ marginTop: 16 }}>
            <Link href="/sets">All {sets.length} sets</Link>
          </p>
        )}

        <h2 className="section-title">Lost a piece from a real set?</h2>
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <p style={{ margin: 0, maxWidth: "60ch" }}>
            Photograph a piece that survived and say which one is missing. Lux3D makes the missing piece in the same style,
            sized and ready to print.
          </p>
          <Link className="btn btn-primary" href="/replace">
            Replace a piece
          </Link>
        </div>
      </div>
      <footer className="footer">Every piece on this site was designed and built by Aholo Lux3D.</footer>
    </>
  );
}
