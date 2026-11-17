"use client";

import { useEffect, useState } from "react";
import { zipSync } from "fflate";
import type * as THREE from "three";
import { KINDS, KIND_COUNT, KIND_HEIGHT, KIND_NAME, type ChessSet, type Kind } from "@/lib/types";

/** Tournament kings are 85–105 mm; 95 mm suits a board with 50 mm squares. */
const DEFAULT_KING = 95;

const slug = (s: string) => s.replace(/\W+/g, "-").toLowerCase();

export function PrintStudio({ set }: { set: ChessSet }) {
  const [king, setKing] = useState(DEFAULT_KING);
  const [base, setBase] = useState(true);
  const [solids, setSolids] = useState<Partial<Record<Kind, THREE.BufferGeometry>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const ready = KINDS.filter((k) => set.pieces[k].modelUrl);

  useEffect(() => {
    let live = true;
    (async () => {
      const { loadSolid } = await import("@/lib/game/stl");
      const out: Partial<Record<Kind, THREE.BufferGeometry>> = {};
      await Promise.all(
        ready.map(async (k) => {
          try {
            out[k] = await loadSolid(set.pieces[k].modelUrl!);
          } catch {
            // listed as unavailable
          }
        }),
      );
      if (live) {
        setSolids(out);
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  const height = (k: Kind) => Math.round(king * KIND_HEIGHT[k]);

  const one = async (k: Kind) => {
    const s = solids[k];
    if (!s) return;
    setBusy(k);
    const { toStl } = await import("@/lib/game/stl");
    const blob = toStl(s, height(k), base);
    save(blob, `${slug(set.name)}-${KIND_NAME[k].toLowerCase()}-${height(k)}mm.stl`);
    setBusy("");
  };

  const all = async () => {
    setBusy("all");
    await new Promise((r) => setTimeout(r, 30));
    const { toStl, volumeCm3 } = await import("@/lib/game/stl");
    const files: Record<string, Uint8Array> = {};
    const lines = [
      `${set.name}`,
      `Theme: ${set.theme}`,
      `Designed and built by Aholo Lux3D on Set Piece.`,
      ``,
      `King height ${king} mm. Print each file this many times per side, in a light and a dark filament:`,
      ``,
    ];
    let grams = 0;
    for (const k of KINDS) {
      const s = solids[k];
      if (!s) continue;
      const name = `${KIND_NAME[k].toLowerCase()}-${height(k)}mm.stl`;
      files[name] = new Uint8Array(await toStl(s, height(k), base).arrayBuffer());
      // PLA at 1.24 g/cm³, about 20% infill and walls: roughly a third of the solid volume.
      const g = volumeCm3(s, height(k)) * 1.24 * 0.35;
      grams += g * KIND_COUNT[k] * 2;
      lines.push(`  ${name.padEnd(22)} x${KIND_COUNT[k]} per side (${KIND_COUNT[k] * 2} total)`);
    }
    lines.push("", `Estimated filament for the whole set: about ${Math.round(grams)} g of PLA.`, "Print upright with the base on the bed. Thin parts may need supports.");
    files["README.txt"] = new TextEncoder().encode(lines.join("\n"));
    save(new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: "application/zip" }), `${slug(set.name)}-chess-set.zip`);
    setBusy("");
  };

  return (
    <div className="print-grid">
      <div className="card">
        <h1 style={{ fontSize: "var(--step-3)", fontStyle: "italic" }}>Print {set.name}</h1>
        <p className="muted" style={{ margin: "8px 0 18px" }}>
          Every piece is scaled to Staunton tournament proportions from one number: the king’s height. Print one colour for
          each side.
        </p>
        <label className="field" style={{ marginBottom: 16 }}>
          <span>King height: {king} mm</span>
          <input className="range" type="range" min={50} max={120} step={1} value={king} onChange={(e) => setKing(Number(e.target.value))} />
          <small>95 mm suits a board with 50 mm squares. 60 mm makes a travel set.</small>
        </label>
        <label className="row" style={{ marginBottom: 20, cursor: "pointer" }}>
          <input type="checkbox" checked={base} onChange={(e) => setBase(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--brass)" }} />
          <span>Add a thin flat disc under each piece so it sticks to the print bed</span>
        </label>
        <button className="btn btn-primary btn-big" onClick={all} disabled={loading || busy !== "" || !Object.keys(solids).length}>
          {busy === "all" ? "Packing the set…" : loading ? "Loading pieces…" : "Download the whole set (.zip)"}
        </button>
        {ready.length < 6 && (
          <p className="notice">
            {6 - ready.length} {6 - ready.length === 1 ? "piece is" : "pieces are"} not built yet. The download includes the pieces that are ready.
          </p>
        )}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Piece</th>
              <th className="n">Height</th>
              <th className="n">Per side</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {KINDS.map((k) => (
              <tr key={k}>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {set.pieces[k].imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={set.pieces[k].imageUrl} alt="" width={36} height={36} style={{ borderRadius: 6, background: "#ece3d5", objectFit: "cover" }} />
                    )}
                    {KIND_NAME[k]}
                  </span>
                </td>
                <td className="n">{height(k)} mm</td>
                <td className="n">{KIND_COUNT[k]}</td>
                <td className="n">
                  <button className="btn" style={{ padding: "6px 10px" }} onClick={() => one(k)} disabled={!solids[k] || busy !== ""}>
                    {busy === k ? "…" : "STL"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: "var(--step--1)", marginTop: 12 }}>
          Files are in millimetres with Z up, ready for any slicer or print service.
        </p>
      </div>
    </div>
  );
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
