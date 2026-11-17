"use client";

import { useEffect, useRef, useState } from "react";

/** The rules, controls and goals, one tap away on every page. */
export function HowToPlay({ onPlay = false }: { onPlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem("sp.help") === "1");
    } catch {
      // storage blocked
    }
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = () => {
    setOpen(true);
    setSeen(true);
    try {
      localStorage.setItem("sp.help", "1");
    } catch {
      // storage blocked
    }
  };

  return (
    <>
      <button className={`help-fab${onPlay ? " on-play" : ""}${seen ? "" : " nudge"}`} onClick={show} aria-haspopup="dialog">
        <span aria-hidden>?</span> How to play
      </button>
      <dialog ref={ref} className="help" onClose={() => setOpen(false)} aria-label="How to play">
        <div className="help-head">
          <h2>How it works</h2>
          <button className="btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <h3>1. Forge a set</h3>
        <p>
          Click <strong>Forge a set</strong> and describe a theme, like “garden tools in cast iron” or “my family as wooden
          figures”, or upload a photo to take the style from. Aholo Lux3D draws all six pieces in one style, then builds each in
          3D. It takes about fifteen minutes, and you can start playing straight away: your pieces replace the plain ones as
          they arrive.
        </p>

        <h3>2. Move a piece</h3>
        <ul>
          <li>Tap or click one of your pieces. Dots show where it can go; rings show what it can take.</li>
          <li>Tap a dot or ring to move there. Tap anywhere else to cancel.</li>
          <li>Drag on the board to turn it. Scroll or pinch to zoom.</li>
          <li>A pawn reaching the far side lets you choose a queen, rook, bishop or knight from your own set.</li>
        </ul>

        <h3>How each piece moves</h3>
        <ul className="pieces-guide">
          <li><strong>King</strong>: one square any way</li>
          <li><strong>Queen</strong>: any distance, any line</li>
          <li><strong>Rook</strong>: straight lines</li>
          <li><strong>Bishop</strong>: diagonals</li>
          <li><strong>Knight</strong>: an L shape, and it jumps</li>
          <li><strong>Pawn</strong>: forward one (two at first), takes diagonally</li>
        </ul>
        <p className="muted" style={{ marginTop: 6 }}>
          Castling, en passant and promotion all work. Win by checkmate: the enemy king is attacked and cannot escape.
        </p>

        <h3>3. Choose who to play</h3>
        <ul>
          <li><strong>The computer</strong>: four levels. Beat one to unlock the next.</li>
          <li><strong>A friend online</strong>: you get a link; the game starts when they open it.</li>
          <li><strong>Pass and play</strong>: two people, one screen.</li>
        </ul>

        <h3>4. Earn finishes</h3>
        <p>The second side can be walnut or ebony. Beat the Club computer for jade, and the Master for gold.</p>

        <h3>5. Print it</h3>
        <p>
          On any set, <strong>Print this set</strong> scales every piece to tournament size and downloads files for a 3D
          printer, with how many of each to print.
        </p>

        <h3>Lost a real piece?</h3>
        <p>
          Open <strong>Lost a piece?</strong>, photograph a piece from your set that survived, and say which one is missing.
          Lux3D makes the missing piece in the same style, ready to print.
        </p>
      </dialog>
    </>
  );
}
