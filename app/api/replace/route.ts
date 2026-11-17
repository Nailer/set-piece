import { NextResponse } from "next/server";
import { replace } from "@/lib/server/forge";
import { hasApiKey } from "@/lib/server/lux";
import { ration, stash } from "@/lib/server/upload";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasApiKey()) return NextResponse.json({ error: "Making pieces is switched off on this server." }, { status: 503 });
  const form = await req.formData();
  const photo = await stash(form.get("photo"));
  if (!photo) return NextResponse.json({ error: "Add a photo of a piece that survived." }, { status: 400 });
  if (typeof photo === "object") return NextResponse.json(photo, { status: 400 });
  const missing = String(form.get("missing") ?? "").trim().slice(0, 40);
  if (!missing) return NextResponse.json({ error: "Say which piece is missing." }, { status: 400 });
  const limited = ration(req, 3);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  return NextResponse.json(await replace({ photoPath: photo, missing }));
}
