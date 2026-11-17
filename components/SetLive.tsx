"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PieceViewer } from "./PieceViewer";
import { LEVELS, levelOpen, loadProgress, type Progress } from "@/lib/progress";
import { KINDS, KIND_NAME, type ChessSet, type Kind, type Side } from "@/lib/types";

const fmt = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${Math.round(ms / 1000)} s`);

/** A set's page. While Lux3D forges, it refreshes itself and shows each piece as it lands. */
export function SetLive({ initial }: { initial: ChessSet }) {
  const router = useRouter();
  const [set, setSet] = useState(initial);
  const [pick, setPick] = useState<Kind>("k");
  const [progress, setProgress] = useState<Progress>({ wins: {} });
  const [level, setLevel] = useState(1);
  const [side, setSide] = useState<Side | "random">("w");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const p = loadProgress();
    setProgress(p);
    // Start at the hardest level the player has opened.
    setLevel(LEVELS.filter((l) => levelOpen(p, l.level)).pop()?.level ?? 1);
  }, []);

  useEffect(() => {
    const pending = set.status === "forging" || KINDS.some((k) => !set.pieces[k].modelUrl && !set.pieces[k].error && set.status !== "failed");
    if (!pending) return;
    const t = window.setInterval(async () => {
      try {
        const next = (await (await fetch(`/api/sets/${set.id}`)).json()) as ChessSet;
        if (next?.id) setSet(next);
      } catch {
        // retry next tick
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [set]);

  const piece = set.pieces[pick];
  const built = KINDS.filter((k) => set.pieces[k].modelUrl).length;
  const drawn = KINDS.filter((k) => set.pieces[k].imageUrl).length;
  const total = KINDS.reduce((sum, k) => sum + set.pieces[k].stages.reduce((s, x) => s + x.ms, 0), 0);
  const chosenSide = (): Side => (side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side);

  const playOnline = async () => {
    setBusy("online");
    setError("");
    try {
      const res = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: set.id, side: chosenSide() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      try {
        localStorage.setItem(`sp.seat.${d.game.id}`, d.token);
      } catch {
        // without storage the player can still play in this tab
      }
      router.push(`/g/${d.game.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not open an online game.");
      setBusy("");
    }
  };

  const retry = async (k: Kind) => {
    setBusy(k);
    const res = await fetch(`/api/sets/${set.id}/reforge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error ?? "Could not start that.");
    else setSet({ ...set, pieces: { ...set.pieces, [k]: { ...set.pieces[k], error: undefined } } });
    setBusy("");
  };

  return (
    <main className="page">
      <div className="set-hero">
        <div>
          <PieceViewer url={piece.modelUrl} label={KIND_NAME[pick]} />
          <div className="piece-row" role="group" aria-label="Pieces">
            {KINDS.map((k) => {
              const p = set.pieces[k];
              return (
                <button key={k} className="piece-tile" aria-pressed={pick === k} onClick={() => setPick(k)}>
                  <div className="img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span className="muted">…</span>}
                  </div>
                  <small>{KIND_NAME[k]}</small>
                  <span className={`state${p.error ? " err" : ""}`}>
                    {p.error ? "Failed" : p.modelUrl ? "In 3D" : p.imageUrl ? "Building 3D" : set.status === "failed" ? "—" : "Drawing"}
                  </span>
                </button>
              );
            })}
          </div>
          {piece.error && (
            <p className="notice is-error">
              {piece.error}{" "}
              <button className="btn" onClick={() => retry(pick)} disabled={busy === pick}>
                {busy === pick ? "Starting…" : `Try the ${KIND_NAME[pick].toLowerCase()} again`}
              </button>
            </p>
          )}
        </div>

        <div className="card">
          <h1 style={{ fontSize: "var(--step-3)", fontStyle: "italic" }}>{set.name}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            “{set.theme}”{set.author ? ` · by ${set.author}` : ""}
          </p>
          {set.status === "forging" && (
            <p className="notice" role="status">
              Lux3D is forging this set: {drawn} of 6 drawn, {built} of 6 in 3D. You can start a game now; the plain pieces are
              replaced as yours arrive.
            </p>
          )}
          {set.status === "failed" && <p className="notice is-error">Lux3D could not forge this set.</p>}

          <h2 style={{ fontSize: "var(--step-1)", marginTop: 22 }}>Play the computer</h2>
          <div className="levels" role="group" aria-label="Computer level">
            {LEVELS.map((l) => {
              const open = levelOpen(progress, l.level);
              const wins = progress.wins[l.level] ?? 0;
              return (
                <button key={l.level} className="level" aria-pressed={level === l.level} disabled={!open} onClick={() => setLevel(l.level)}>
                  <strong>{open ? l.name : `🔒 ${l.name}`}</strong>
                  <span>{open ? l.note : `Beat ${LEVELS[l.level - 2].name} to unlock`}</span>
                  <span className="won">{wins ? `${wins} ${wins === 1 ? "win" : "wins"}` : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <span className="muted">Play as</span>
            <div className="segmented" role="group" aria-label="Your side">
              {(
                [
                  ["w", "White"],
                  ["b", "Black"],
                  ["random", "Random"],
                ] as [Side | "random", string][]
              ).map(([id, label]) => (
                <button key={id} aria-pressed={side === id} onClick={() => setSide(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <Link className="btn btn-primary btn-big" href={`/play/${set.id}?mode=cpu&level=${level}&side=${side === "random" ? "random" : side}`}>
              Play the computer
            </Link>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={playOnline} disabled={busy === "online"}>
              {busy === "online" ? "Opening…" : "Play a friend online"}
            </button>
            <Link className="btn" href={`/play/${set.id}?mode=local`}>
              Pass and play
            </Link>
            <Link className="btn" href={`/print/${set.id}`}>
              Print this set
            </Link>
          </div>
          {error && (
            <p className="notice is-error" role="alert">
              {error}
            </p>
          )}

          <h2 style={{ fontSize: "var(--step-1)", marginTop: 26 }}>How it was made</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--step--1)" }}>
            {set.photoUrl ? "Styled from a photo" : "Designed from one sentence"}. Every piece was drawn by Lux3D with the king as
            its style reference, then built in 3D by Lux3D. {total ? `Lux3D time: ${fmt(total)}.` : ""}
          </p>
          <ul className="made">
            {KINDS.map((k) => {
              const st = set.pieces[k].stages;
              const draw = st.find((s) => s.name === "draw");
              const build = st.find((s) => s.name === "build");
              return (
                <li key={k}>
                  <span>{KIND_NAME[k]}</span>
                  <span className="muted">
                    {draw ? `drawn ${fmt(draw.ms)}` : "—"} · {build ? `3D ${fmt(build.ms)}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {set.photoUrl && (
            <p style={{ marginTop: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={set.photoUrl} alt="The photo the style came from" style={{ width: 120, borderRadius: 10 }} />
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
