"use client";

import { Chess } from "chess.js";
import { useEffect, useRef } from "react";
import { BoardView, type MoveAnim } from "@/lib/game/board";
import { OPERA_GAME } from "@/lib/game/opera";
import type { ChessSet, Kind } from "@/lib/types";

/** The home page board: a forged set replaying Morphy's Opera Game, on a loop. */
export function Demo({ set }: { set: ChessSet | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const board = new BoardView(ref.current!, { demo: true });
    const c = new Chess();
    board.setFen(c.fen());
    void board.useSet(set);
    let live = true;
    let i = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = async () => {
      if (!live) return;
      if (i >= OPERA_GAME.length) {
        await new Promise((r) => setTimeout(r, 3500));
        c.reset();
        board.clearTrays();
        board.setFen(c.fen());
        board.mark({});
        i = 0;
      }
      const m = c.move(OPERA_GAME[i++]);
      const anim: MoveAnim = { from: m.from, to: m.to, captured: Boolean(m.captured), color: m.color, piece: m.piece as Kind };
      if (m.flags.includes("k")) anim.castle = { from: "h" + m.from[1], to: "f" + m.from[1] };
      if (m.flags.includes("q")) anim.castle = { from: "a" + m.from[1], to: "d" + m.from[1] };
      board.mark({ last: [m.from, m.to] });
      await board.animate(anim, c.fen());
      if (live) setTimeout(step, 1100);
    };
    const t = reduced ? 0 : window.setTimeout(step, 1200);
    return () => {
      live = false;
      clearTimeout(t);
      board.dispose();
    };
  }, [set]);
  return <canvas ref={ref} aria-hidden />;
}
