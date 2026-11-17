"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const IDEAS = [
  "garden tools in cast iron",
  "a jazz band carved from ebony",
  "Lagos danfo buses and market stalls in bright enamel",
  "deep-sea creatures in blown glass",
  "office supplies in polished brass",
  "origami animals folded from gold paper",
];

/** "garden tools in cast iron" becomes "Garden Tools". */
const autoName = (theme: string) =>
  theme
    .split(/\b(?:in|made|carved|from|of|with)\b/i)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 40);

export function ForgeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"words" | "photo">("words");
  const [theme, setTheme] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<{ canMake: boolean; queue: number } | null>(null);

  useEffect(() => {
    fetch("/api/sets")
      .then((r) => r.json())
      .then((d) => setInfo({ canMake: Boolean(d.canMake), queue: d.queue ?? 0 }))
      .catch(() => setInfo({ canMake: false, queue: 0 }));
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const data = new FormData(e.currentTarget);
    if (mode === "words") data.delete("photo");
    if (!name.trim()) data.set("name", autoName(theme) || "My set");
    try {
      const res = await fetch("/api/forge", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      router.push(`/set/${body.set.id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not reach the server. Check your connection.");
      setSending(false);
    }
  };

  return (
    <main className="page page-narrow">
      <h1 className="display" style={{ fontSize: "var(--step-4)" }}>
        Forge a set
      </h1>
      <p className="lede">
        One sentence is enough. Lux3D designs a king in your theme, then draws the other five pieces to match it, and builds all
        six in 3D. About fifteen minutes, and you can play while it works.
      </p>
      {info && !info.canMake && <p className="notice">Forging is switched off on this server. You can still play every set in the gallery.</p>}
      {info && info.queue > 0 && (
        <p className="notice">
          {info.queue} {info.queue === 1 ? "set is" : "sets are"} forging right now. Yours will start when they finish.
        </p>
      )}

      <form className="form" onSubmit={submit}>
        <div className="segmented" role="tablist" aria-label="Start from">
          <button type="button" role="tab" aria-selected={mode === "words"} onClick={() => setMode("words")}>
            From a theme
          </button>
          <button type="button" role="tab" aria-selected={mode === "photo"} onClick={() => setMode("photo")}>
            From a photo
          </button>
        </div>

        <label className="field">
          <span>{mode === "words" ? "Theme" : "Anything else about the theme (optional)"}</span>
          <textarea
            name="theme"
            rows={2}
            maxLength={160}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder={mode === "words" ? "garden tools in cast iron" : "make them look like lighthouses"}
            required={mode === "words"}
          />
          {mode === "words" && (
            <div className="chips" aria-label="Ideas">
              {IDEAS.map((i) => (
                <button key={i} type="button" className="chip" onClick={() => setTheme(i)}>
                  {i}
                </button>
              ))}
            </div>
          )}
          <small>Name a subject and a material for the best results: “sea creatures in blown glass”.</small>
        </label>

        {mode === "photo" && (
          <label className="drop">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" />
            ) : (
              <span>
                <strong>Add a photo</strong>
                <span className="muted">A figurine, a vase, a carving, a toy. Lux3D takes its material and style for every piece.</span>
              </span>
            )}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required={mode === "photo"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : "");
              }}
            />
          </label>
        )}

        <label className="field">
          <span>Name of the set</span>
          <input name="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName(theme) || "The Potting Shed"} />
          <small>Leave it empty and the theme becomes the name.</small>
        </label>
        <label className="field">
          <span>Your name (optional)</span>
          <input name="author" maxLength={24} placeholder="Shown on the set" />
        </label>

        {error && (
          <p className="notice is-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-big" disabled={sending || info?.canMake === false}>
          {sending ? "Starting the forge…" : "Forge my set"}
        </button>
        <p className="muted" style={{ fontSize: "var(--step--1)", margin: 0 }}>
          Sets are public in the <Link href="/sets">gallery</Link> so others can play them. Two sets per person per day.
        </p>
      </form>
    </main>
  );
}
