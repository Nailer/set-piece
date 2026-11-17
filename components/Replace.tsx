"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PieceViewer } from "./PieceViewer";
import { KINDS, KIND_NAME, type Kind, type Replacement } from "@/lib/types";

export function ReplaceForm() {
  const router = useRouter();
  const [preview, setPreview] = useState("");
  const [missing, setMissing] = useState<string>("k");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const data = new FormData(e.currentTarget);
    data.set("missing", missing === "other" ? custom : missing);
    try {
      const res = await fetch("/api/replace", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      router.push(`/replace/${body.id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not reach the server.");
      setSending(false);
    }
  };

  return (
    <main className="page page-narrow">
      <h1 className="display" style={{ fontSize: "var(--step-4)" }}>
        Lost a piece?
      </h1>
      <p className="lede">
        Photograph a piece that survived. Say which one is missing. Lux3D draws the missing piece in the same style, builds it in
        3D, and you print it at the right size. It works for game tokens and knobs too.
      </p>
      <form className="form" onSubmit={submit}>
        <label className="drop">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="The surviving piece" />
          ) : (
            <span>
              <strong>Photograph a piece that survived</strong>
              <span className="muted">One piece, standing up, on a plain background.</span>
            </span>
          )}
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : "");
            }}
          />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Which piece is missing?</legend>
          <div className="segmented" role="group">
            {[...KINDS, "other"].map((k) => (
              <button key={k} type="button" aria-pressed={missing === k} onClick={() => setMissing(k)}>
                {k === "other" ? "Something else" : KIND_NAME[k as Kind]}
              </button>
            ))}
          </div>
          {missing === "other" && (
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={40} placeholder="the red game token, the radio knob…" required />
          )}
        </fieldset>
        {error && (
          <p className="notice is-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-big" disabled={sending}>
          {sending ? "Sending…" : "Make the missing piece"}
        </button>
      </form>
    </main>
  );
}

export function ReplaceLive({ initial }: { initial: Replacement }) {
  const [r, setR] = useState(initial);
  const [height, setHeight] = useState(70);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (r.status !== "working") return;
    const t = window.setInterval(async () => {
      try {
        const next = (await (await fetch(`/api/replace/${r.id}`)).json()) as Replacement;
        if (next?.id) setR(next);
      } catch {
        // retry next tick
      }
    }, 4000);
    return () => window.clearInterval(t);
  }, [r]);

  const download = async () => {
    if (!r.modelUrl) return;
    setBusy(true);
    const { loadSolid, toStl } = await import("@/lib/game/stl");
    const blob = toStl(await loadSolid(r.modelUrl), height, true);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `replacement-${r.name.replace(/\W+/g, "-").toLowerCase()}-${height}mm.stl`;
    a.click();
    setBusy(false);
  };

  const steps = [
    { done: true, label: "Your photo" },
    { done: Boolean(r.imageUrl), label: "Drawn to match by Lux3D" },
    { done: Boolean(r.modelUrl), label: "Built in 3D by Lux3D" },
  ];

  return (
    <main className="page">
      <h1 className="display" style={{ fontSize: "var(--step-3)" }}>
        Replacement {r.name.toLowerCase()}
      </h1>
      {r.status === "failed" && <p className="notice is-error">{r.error ?? "Lux3D could not make this piece."}</p>}
      {r.status === "working" && (
        <p className="notice" role="status">
          Lux3D is working on it. This takes two to four minutes; the page updates by itself.
        </p>
      )}
      <div className="set-hero" style={{ marginTop: 20 }}>
        <PieceViewer url={r.modelUrl} label={r.name} />
        <div className="card">
          <div className="row" style={{ alignItems: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.photoUrl} alt="The surviving piece" style={{ width: 120, borderRadius: 10 }} />
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt="The missing piece as Lux3D drew it" style={{ width: 120, borderRadius: 10, background: "#fff" }} />
            )}
          </div>
          <ol className="progress">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? "is-done" : undefined}>
                <strong>{s.label}</strong>
              </li>
            ))}
          </ol>
          <label className="field" style={{ marginBottom: 14 }}>
            <span>Height to match your set: {height} mm</span>
            <input className="range" type="range" min={20} max={130} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            <small>Measure the surviving piece and set the same height.</small>
          </label>
          <button className="btn btn-primary btn-big" onClick={download} disabled={!r.modelUrl || busy}>
            {busy ? "Preparing…" : "Download STL"}
          </button>
        </div>
      </div>
    </main>
  );
}
