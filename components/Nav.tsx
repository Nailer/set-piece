"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HowToPlay } from "./HowToPlay";

const LINKS = [
  { href: "/sets", label: "Sets", hide: false },
  { href: "/replace", label: "Lost a piece?", hide: true },
];

export function Nav() {
  const path = usePathname() ?? "";
  return (
    <>
      <nav className="nav" aria-label="Main">
        <Link href="/" className="brand">
          <svg viewBox="0 0 64 64" aria-hidden>
            <path d="M32 6v9M27 10.5h10" stroke="#c8a46a" strokeWidth="4" strokeLinecap="round" />
            <path d="M22 52h20l-3-8 4-14c0-6-5-10-11-10s-11 4-11 10l4 14z" fill="#c8a46a" />
            <rect x="16" y="50" width="32" height="7" rx="3" fill="#e6c48a" />
          </svg>
          Set Piece
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={l.hide ? "hide-sm" : undefined} aria-current={path.startsWith(l.href) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
        <Link href="/forge" className="nav-cta">
          Forge a set
        </Link>
      </nav>
      <HowToPlay onPlay={path.startsWith("/play") || path.startsWith("/g/")} />
    </>
  );
}
