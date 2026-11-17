"use client";

import Link from "next/link";
import { Chess, type Move, type Square as CSquare } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardView, type Finish, type MoveAnim, type Square } from "@/lib/game/board";
import { sfx } from "@/lib/game/sfx";
import { FINISHES, LEVELS, finishOpen, levelOpen, loadProgress, recordWin, type Progress } from "@/lib/progress";
import { KIND_NAME, type ChessSet, type GameRecord, type Kind, type Side } from "@/lib/types";
import { resultCard } from "@/lib/game/card";

export type Mode = "cpu" | "local" | "online";

interface Props {
  set: ChessSet;
  mode: Mode;
  level?: number;
  /** The human's side against the computer. */
  side?: Side;
  /** Online games start from the server's record. */
  game?: GameRecord;
}

const toAnim = (m: Move): MoveAnim => {
  const anim: MoveAnim = { from: m.from, to: m.to, captured: Boolean(m.captured), color: m.color, piece: m.piece as Kind };
  if (m.flags.includes("e")) anim.capturedOn = m.to[0] + m.from[1];
  if (m.flags.includes("k")) anim.castle = { from: "h" + m.from[1], to: "f" + m.from[1] };
  if (m.flags.includes("q")) anim.castle = { from: "a" + m.from[1], to: "d" + m.from[1] };
  if (m.promotion) anim.promotion = m.promotion as Kind;
  return anim;
};

const capturedFrom = (history: Move[]) => history.filter((m) => m.captured).map((m) => ({ kind: m.captured as Kind, owner: (m.color === "w" ? "b" : "w") as Side }));

export function Play({ set: initialSet, mode, level = 1, side = "w", game }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<BoardView | null>(null);
  const chessRef = useRef(new Chess());
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  /** Bumped on undo and restart, so a computer reply for an old position is thrown away. */
  const epochRef = useRef(0);
  const [sendError, setSendError] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const movesRef = useRef<HTMLOListElement>(null);
  const [set, setSet] = useState(initialSet);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<{ text: string; winner: Side | null } | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [finish, setFinishState] = useState<Finish>("natural");
  const [progress, setProgress] = useState<Progress>({ wins: {} });
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [orientation, setOrientation] = useState<Side>(mode === "cpu" ? side : "w");
  const [seat, setSeat] = useState<{ side: Side | null; token?: string }>({ side: null });
  const [online, setOnline] = useState<GameRecord | null>(game ?? null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [locked, setLocked] = useState(false);

  const mySide: Side | "both" | null = mode === "local" ? "both" : mode === "cpu" ? side : seat.side;
  const turn = fen.split(" ")[1] as Side;
  const myTurn = !result && (mySide === "both" || mySide === turn);

  // ---------- setup ----------

  useEffect(() => {
    setOrigin(window.location.origin);
    setProgress(loadProgress());
    // Levels are earned; a typed-in link cannot skip ahead.
    if (mode === "cpu" && !levelOpen(loadProgress(), level)) setLocked(true);
    try {
      const m = localStorage.getItem("sp.muted") === "1";
      setMuted(m);
      sfx.setMuted(m);
      const f = localStorage.getItem("sp.finish") as Finish | null;
      if (f && FINISHES.some((x) => x.id === f && finishOpen(loadProgress(), x.unlock))) setFinishState(f);
    } catch {
      // storage blocked
    }
  }, []);

  useEffect(() => {
    const board = new BoardView(canvasRef.current!, { onSquare: (sq) => clickRef.current(sq) });
    boardRef.current = board;
    board.setFen(chessRef.current.fen());
    void board.useSet(initialSet);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __board?: BoardView; __chess?: Chess }).__board = board;
    (window as unknown as { __chess?: Chess }).__chess = chessRef.current;
    return () => board.dispose();
  }, [initialSet]);

  useEffect(() => {
    boardRef.current?.setFinish(finish);
  }, [finish]);

  useEffect(() => {
    boardRef.current?.setOrientation(orientation);
  }, [orientation]);

  // Count the game once per visit.
  useEffect(() => {
    void fetch(`/api/sets/${initialSet.id}/play`, { method: "POST" }).catch(() => undefined);
  }, [initialSet.id]);

  // While the set is still forging, new pieces swap onto the board as Lux3D finishes them.
  useEffect(() => {
    if (set.status !== "forging") return;
    const t = window.setInterval(async () => {
      try {
        const next = (await (await fetch(`/api/sets/${set.id}`)).json()) as ChessSet;
        if (!next?.id) return;
        setSet(next);
        await boardRef.current?.useSet(next);
      } catch {
        // try again on the next tick
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [set.id, set.status]);

  // ---------- moves ----------

  const sync = useCallback(() => {
    const c = chessRef.current;
    setFen(c.fen());
    setHistory(c.history());
  }, []);

  const checkEnd = useCallback(() => {
    const c = chessRef.current;
    if (!c.isGameOver()) return;
    let r: { text: string; winner: Side | null };
    if (c.isCheckmate()) {
      const winner: Side = c.turn() === "w" ? "b" : "w";
      r = { text: `Checkmate. ${winner === "w" ? "White" : "Black"} wins.`, winner };
    } else if (c.isStalemate()) r = { text: "Stalemate. It's a draw.", winner: null };
    else if (c.isThreefoldRepetition()) r = { text: "Draw by repetition.", winner: null };
    else if (c.isInsufficientMaterial()) r = { text: "Draw: not enough pieces left to mate.", winner: null };
    else r = { text: "Draw by the fifty-move rule.", winner: null };
    finishGame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishGame = (r: { text: string; winner: Side | null }) => {
    setResult(r);
    const won = mode === "cpu" ? r.winner === side : mode === "online" ? r.winner === seat.side : r.winner !== null;
    sfx.end(Boolean(won));
    if (mode === "cpu" && r.winner === side) {
      const before = loadProgress();
      const after = recordWin(level);
      setProgress(after);
      const newLevel = LEVELS.find((l) => l.level === level + 1);
      const newFinish = FINISHES.find((f) => f.unlock === level);
      if (!(before.wins[level] ?? 0)) {
        const bits = [newLevel ? `${newLevel.name} level` : null, newFinish ? `the ${newFinish.name.toLowerCase()} finish` : null].filter(Boolean);
        if (bits.length) setUnlocked(bits.join(" and "));
      }
    }
  };

  /** Plays a move on the real game, animates it, and hands over to the computer if needed. */
  const play = useCallback(
    async (input: string | { from: string; to: string; promotion?: string }, local = true) => {
      const c = chessRef.current;
      if (busyRef.current) return false;
      let m: Move;
      try {
        m = c.move(input);
      } catch {
        sfx.illegal();
        return false;
      }
      busyRef.current = true;
      setSelected(null);
      boardRef.current?.mark({ last: [m.from, m.to] });
      if (m.captured) sfx.capture();
      else sfx.move();
      await boardRef.current?.animate(toAnim(m), c.fen());
      if (c.inCheck()) sfx.check();
      const king = c.inCheck() ? findKing(c, c.turn()) : null;
      boardRef.current?.mark({ last: [m.from, m.to], check: king });
      sync();
      busyRef.current = false;
      if (local && mode === "online" && online && seat.token) void send(m.san);
      // Pass and play: turn the board to whoever moves next.
      if (mode === "local" && autoFlipRef.current && !c.isGameOver()) setOrientation(c.turn());
      checkEnd();
      if (mode === "cpu" && !c.isGameOver() && c.turn() !== side) askComputer();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, online, seat.token, side, sync, checkEnd],
  );

  const autoFlipRef = useRef(autoFlip);
  autoFlipRef.current = autoFlip;

  /** Sends an online move, retrying a few times if the connection drops. */
  const send = async (san: string) => {
    for (let i = 0; i < 4; i++) {
      try {
        const res = await fetch(`/api/games/${online!.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: seat.token, san }),
        });
        if (res.ok || res.status === 400) {
          setSendError(!res.ok);
          return;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    setSendError(true);
  };

  const askComputer = () => {
    const c = chessRef.current;
    if (!workerRef.current) workerRef.current = new Worker(new URL("../lib/game/ai.worker.ts", import.meta.url), { type: "module" });
    const w = workerRef.current;
    const id = ++epochRef.current;
    setThinking(true);
    const started = Date.now();
    w.onmessage = (e: MessageEvent<{ id: number; san: string | null }>) => {
      if (e.data.id !== id || id !== epochRef.current) return;
      // A short pause reads as thinking; instant replies feel robotic.
      const wait = Math.max(0, 450 - (Date.now() - started));
      setTimeout(() => {
        if (id !== epochRef.current) return;
        setThinking(false);
        if (e.data.san) void play(e.data.san, false);
      }, wait);
    };
    w.postMessage({ id, fen: c.fen(), level });
  };

  useEffect(() => () => workerRef.current?.terminate(), []);

  // Keep the newest move in view.
  useEffect(() => {
    const el = movesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  useEffect(() => {
    if (!promo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPromo(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promo]);

  // The computer moves first when the player takes black.
  useEffect(() => {
    if (mode === "cpu" && side === "b" && chessRef.current.history().length === 0) {
      const t = setTimeout(askComputer, 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- clicks ----------

  const click = (sq: Square) => {
    const c = chessRef.current;
    if (busyRef.current || thinking || result || !myTurn) return;
    if (selected) {
      const moves = c.moves({ square: selected as CSquare, verbose: true });
      const hit = moves.filter((m) => m.to === sq);
      if (hit.length) {
        if (hit.some((m) => m.promotion)) return setPromo({ from: selected, to: sq });
        void play({ from: selected, to: sq });
        return;
      }
    }
    const piece = c.get(sq as CSquare);
    if (piece && piece.color === c.turn()) {
      sfx.select();
      setSelected(sq);
      const moves = c.moves({ square: sq as CSquare, verbose: true });
      boardRef.current?.mark({
        selected: sq,
        targets: [...new Set(moves.map((m) => m.to))],
        captures: moves.filter((m) => m.captured).map((m) => m.to),
        last: lastPair(c),
        check: c.inCheck() ? findKing(c, c.turn()) : null,
      });
    } else {
      setSelected(null);
      boardRef.current?.mark({ last: lastPair(c), check: c.inCheck() ? findKing(c, c.turn()) : null });
    }
  };
  const clickRef = useRef(click);
  clickRef.current = click;

  // ---------- online ----------

  useEffect(() => {
    if (mode !== "online" || !online) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem(`sp.seat.${online.id}`);
    } catch {
      // storage blocked
    }
    (async () => {
      // The server checks the saved seat; a new visitor takes the empty one, if there is one.
      const res = await fetch(`/api/games/${online.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const d = (await res.json()) as { side: Side; token: string };
        try {
          localStorage.setItem(`sp.seat.${online.id}`, d.token);
        } catch {
          // storage blocked
        }
        setSeat({ side: d.side, token: d.token });
        setOrientation(d.side);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, online?.id]);

  // Catch up with the other player's moves.
  useEffect(() => {
    if (mode !== "online" || !online) return;
    const t = window.setInterval(async () => {
      if (busyRef.current) return;
      try {
        const g = (await (await fetch(`/api/games/${online.id}`)).json()) as GameRecord;
        setOnline(g);
        const have = chessRef.current.history().length;
        if (g.moves.length > have) await play(g.moves[have], false);
        if (g.result && !result && g.reason === "resigned") {
          setResult({ text: `${g.result === "1-0" ? "Black" : "White"} resigned.`, winner: g.result === "1-0" ? "w" : "b" });
        }
      } catch {
        // retry next tick
      }
    }, 1500);
    return () => window.clearInterval(t);
  }, [mode, online, play, result]);

  // Replay moves already made, when an online game is reopened.
  useEffect(() => {
    if (mode !== "online" || !game?.moves.length) return;
    const c = chessRef.current;
    for (const san of game.moves) c.move(san);
    boardRef.current?.setFen(c.fen());
    boardRef.current?.setCaptured(capturedFrom(c.history({ verbose: true })));
    boardRef.current?.mark({ last: lastPair(c), check: c.inCheck() ? findKing(c, c.turn()) : null });
    sync();
    checkEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- actions ----------

  const undo = () => {
    const c = chessRef.current;
    if (busyRef.current || thinking || mode !== "cpu") return;
    epochRef.current++;
    // Take back the computer's reply and your move.
    c.undo();
    if (c.turn() !== side) c.undo();
    boardRef.current?.setFen(c.fen());
    boardRef.current?.setCaptured(capturedFrom(c.history({ verbose: true })));
    boardRef.current?.mark({ last: lastPair(c) });
    setResult(null);
    sync();
  };

  const resign = () => {
    if (result) return;
    const loser: Side = mode === "local" ? turn : (mySide as Side);
    const winner: Side = loser === "w" ? "b" : "w";
    finishGame({ text: `${loser === "w" ? "White" : "Black"} resigned.`, winner });
    if (mode === "online" && online && seat.token) {
      void fetch(`/api/games/${online.id}/resign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: seat.token }) });
    }
  };

  const restart = () => {
    epochRef.current++;
    setThinking(false);
    const c = chessRef.current;
    c.reset();
    boardRef.current?.clearTrays();
    boardRef.current?.setFen(c.fen());
    boardRef.current?.mark({});
    setResult(null);
    setUnlocked(null);
    sync();
    if (mode === "cpu" && side === "b") setTimeout(askComputer, 700);
  };

  const pickFinish = (f: Finish) => {
    setFinishState(f);
    try {
      localStorage.setItem("sp.finish", f);
    } catch {
      // storage blocked
    }
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    sfx.setMuted(m);
    try {
      localStorage.setItem("sp.muted", m ? "1" : "0");
    } catch {
      // storage blocked
    }
  };

  const saveCard = async () => {
    if (!boardRef.current || !result) return;
    const png = await resultCard(boardRef.current.snapshot(), set.name, result.text, history.length);
    const a = document.createElement("a");
    a.href = png;
    a.download = `${set.name.replace(/\W+/g, "-").toLowerCase()}-game.png`;
    a.click();
  };

  const inviteUrl = online ? `${origin}/g/${online.id}` : "";
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  const status = useMemo(() => {
    if (result) return result.text;
    if (mode === "online" && online && !(online.seats?.w && online.seats?.b)) return "Waiting for your friend to join…";
    if (thinking) return "The computer is thinking…";
    const c = new Chess(fen);
    const who = turn === "w" ? "White" : "Black";
    const check = c.inCheck() ? " Check!" : "";
    if (mode === "local") return `${who} to move.${check}`;
    return myTurn ? `Your move.${check}` : `${who} to move.${check}`;
  }, [fen, turn, result, thinking, mode, myTurn, online]);

  const pairs = useMemo(() => {
    const out: [number, string, string?][] = [];
    for (let i = 0; i < history.length; i += 2) out.push([i / 2 + 1, history[i], history[i + 1]]);
    return out;
  }, [history]);

  const forging = set.status === "forging";
  const ready = Object.values(set.pieces).filter((p) => p.modelUrl).length;
  const tweet = result
    ? `I just played a game of chess with pieces I designed in one sentence: "${set.theme}". Made with @AholoWorld Lux3D, then 3D-printable. ${origin}/set/${set.id} #Manycorehackathon`
    : "";

  return (
    <main className="play">
      <div className="play-board">
        <canvas ref={canvasRef} aria-label={`Chess board with the ${set.name} set. Tap a piece, then tap a square to move.`} />
        {forging && (
          <div className="forge-banner" role="status">
            Lux3D is still forging this set: {ready} of 6 pieces are in. The rest swap in as they finish.
          </div>
        )}
      </div>

      <aside className="play-side">
        <div className="play-head">
          <Link href={`/set/${set.id}`} className="set-link">
            {set.name}
          </Link>
          <p className="muted">
            {mode === "cpu"
              ? `You play ${side === "w" ? "white" : "black"} against the ${LEVELS[level - 1].name.toLowerCase()} computer`
              : mode === "local"
                ? "Two players, one screen"
                : seat.side
                  ? `Online · you are ${seat.side === "w" ? "white" : "black"}`
                  : "Online · watching"}
          </p>
        </div>

        <p className={`status${result ? " over" : ""}`} role="status" aria-live="polite">
          {status}
        </p>

        {mode === "online" && online && !(online.seats?.w && online.seats?.b) && (
          <div className="invite">
            <p>Send this link to a friend. The game starts when they open it.</p>
            <div className="row">
              <input readOnly value={inviteUrl} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
              <button className="btn" onClick={copyInvite}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="result">
            {unlocked && <p className="unlock">Unlocked: {unlocked}.</p>}
            <div className="grid2">
              <button className="btn btn-primary" onClick={restart}>
                Play again
              </button>
              <button className="btn" onClick={saveCard}>
                Save result card
              </button>
              <a className="btn" href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}`} target="_blank" rel="noreferrer">
                Post on X
              </a>
              <Link className="btn" href={`/print/${set.id}`}>
                Print this set
              </Link>
            </div>
          </div>
        )}

        {sendError && (
          <p className="notice is-error" role="alert">
            Your last move could not be sent. Check your connection; it will sync when you are back.
          </p>
        )}

        <ol className="moves" aria-label="Moves" ref={movesRef}>
          {pairs.map(([n, w, b]) => (
            <li key={n}>
              <span>{n}.</span>
              <span>{w}</span>
              <span>{b ?? ""}</span>
            </li>
          ))}
          {!pairs.length && <li className="muted">Moves appear here.</li>}
        </ol>

        <div className="finish" role="group" aria-label="Finish for the second side">
          <span>Second side</span>
          {FINISHES.map((f) => {
            const open = finishOpen(progress, f.unlock);
            return (
              <button
                key={f.id}
                className={`swatch swatch-${f.id}`}
                aria-pressed={finish === f.id}
                disabled={!open}
                title={open ? f.name : `Beat the ${LEVELS[(f.unlock ?? 1) - 1].name} computer to unlock ${f.name}`}
                onClick={() => pickFinish(f.id)}
              >
                {open ? f.name : `🔒 ${f.name}`}
              </button>
            );
          })}
        </div>

        <div className="tools">
          {mode === "cpu" && (
            <button className="btn" onClick={undo} disabled={!history.length || thinking}>
              Take back
            </button>
          )}
          <button className="btn" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}>
            Turn board
          </button>
          <button className="btn" onClick={resign} disabled={Boolean(result) || !mySide}>
            Resign
          </button>
          {mode === "local" && (
            <button className="btn" onClick={() => setAutoFlip((v) => !v)} aria-pressed={autoFlip}>
              {autoFlip ? "Auto-turn on" : "Auto-turn off"}
            </button>
          )}
          <button className="btn" onClick={toggleMute} aria-pressed={muted}>
            {muted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </aside>

      {locked && (
        <div className="overlay" role="dialog" aria-label="Level locked">
          <div className="panel">
            <h2>{LEVELS[level - 1].name} is still locked</h2>
            <p className="muted">Beat the {LEVELS[level - 2]?.name ?? "previous"} computer first. Each level you beat opens the next.</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
              <Link className="btn btn-primary" href={`/play/${set.id}?mode=cpu&level=${Math.max(1, level - 1)}&side=${side}`}>
                Play {LEVELS[level - 2]?.name ?? "Easy"}
              </Link>
              <Link className="btn" href={`/set/${set.id}`}>
                Back to the set
              </Link>
            </div>
          </div>
        </div>
      )}

      {promo && (
        <div className="overlay" role="dialog" aria-label="Promote your pawn">
          <div className="panel">
            <h2>Promote your pawn</h2>
            <div className="promo">
              {(["q", "r", "b", "n"] as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    const p = promo;
                    setPromo(null);
                    void play({ from: p.from, to: p.to, promotion: k });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {set.pieces[k]?.imageUrl ? <img src={set.pieces[k].imageUrl} alt="" /> : <span className="glyph">{k.toUpperCase()}</span>}
                  {KIND_NAME[k]}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setPromo(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function findKing(c: Chess, color: Side): Square | null {
  const b = c.board();
  for (const row of b) for (const sq of row) if (sq && sq.type === "k" && sq.color === color) return sq.square;
  return null;
}

function lastPair(c: Chess): [Square, Square] | null {
  const h = c.history({ verbose: true });
  const m = h[h.length - 1];
  return m ? [m.from, m.to] : null;
}
