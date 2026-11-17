import { NextResponse } from "next/server";
import { forge } from "@/lib/server/forge";
import { hasApiKey } from "@/lib/server/lux";
import { listSets } from "@/lib/server/store";
import { isAdmin, ration, stash } from "@/lib/server/upload";

export const dynamic = "force-dynamic";

const PER_DAY = Number(process.env.MAX_SETS_PER_DAY) || 8;

export async function POST(req: Request) {
  if (!hasApiKey()) return NextResponse.json({ error: "Forging is switched off on this server because it has no Lux3D key." }, { status: 503 });
  const form = await req.formData();
  const admin = isAdmin(form);
  if (!admin) {
    const day = new Date().toISOString().slice(0, 10);
    const today = (await listSets()).filter((s) => !s.starter && new Date(s.createdAt).toISOString().slice(0, 10) === day).length;
    if (today >= PER_DAY) return NextResponse.json({ error: `Today's ${PER_DAY} sets have been forged. More open at midnight UTC.` }, { status: 429 });
    const limited = ration(req, 2);
    if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  }
  const theme = String(form.get("theme") ?? "").trim().slice(0, 160);
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const author = String(form.get("author") ?? "").trim().slice(0, 24);
  const photo = await stash(form.get("photo"));
  if (photo && typeof photo === "object") return NextResponse.json(photo, { status: 400 });
  if (!theme && !photo) return NextResponse.json({ error: "Describe a theme or add a photo." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Give your set a name." }, { status: 400 });
  const { job, set } = await forge({
    name,
    theme: theme || "the object in the photo",
    author: author || undefined,
    photoPath: photo,
    starter: admin && form.get("starter") === "on",
  });
  return NextResponse.json({ job, set });
}
