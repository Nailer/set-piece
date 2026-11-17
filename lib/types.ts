export type Kind = "k" | "q" | "r" | "b" | "n" | "p";

export const KINDS: Kind[] = ["k", "q", "r", "b", "n", "p"];

export const KIND_NAME: Record<Kind, string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};

/** How many of each piece a full set needs, per side. */
export const KIND_COUNT: Record<Kind, number> = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };

/** Heights relative to the king, as in a Staunton tournament set. */
export const KIND_HEIGHT: Record<Kind, number> = { k: 1, q: 0.88, b: 0.74, n: 0.66, r: 0.56, p: 0.5 };

export interface Stage {
  name: string;
  label: string;
  ms: number;
}

export interface Piece {
  kind: Kind;
  /** Lux3D's concept drawing of the piece. */
  imageUrl?: string;
  /** The 3D piece, meshopt-compressed GLB. */
  modelUrl?: string;
  /** Lux3D's real-world height prediction, in millimetres. */
  heightMm?: number;
  stages: Stage[];
  error?: string;
}

export interface ChessSet {
  id: string;
  name: string;
  theme: string;
  author?: string;
  /** The photo the style came from, if any. */
  photoUrl?: string;
  pieces: Record<Kind, Piece>;
  status: "forging" | "ready" | "failed";
  createdAt: number;
  /** Games started with this set. */
  plays: number;
  starter?: boolean;
}

export type Side = "w" | "b";
export type Player = "human" | "cpu" | "friend";

export interface GameRecord {
  id: string;
  setId: string;
  /** Moves in SAN, from the start position. */
  moves: string[];
  white: Player;
  black: Player;
  level: number;
  result?: "1-0" | "0-1" | "1/2-1/2";
  reason?: string;
  createdAt: number;
  updatedAt: number;
  /** Seat tokens for online games, so each player can only move their own side. */
  seats?: { w?: string; b?: string };
  names?: { w?: string; b?: string };
}

export interface Job {
  id: string;
  setId: string;
  status: "queued" | "forging" | "done" | "failed";
  ahead: number;
  error?: string;
}

/** A single replacement piece made from a photo of a surviving one. */
export interface Replacement {
  id: string;
  name: string;
  photoUrl: string;
  imageUrl?: string;
  modelUrl?: string;
  heightMm?: number;
  status: "working" | "ready" | "failed";
  error?: string;
  createdAt: number;
  stages: Stage[];
}
