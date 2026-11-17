import { NextResponse } from "next/server";
import { getReplacement } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await getReplacement((await ctx.params).id);
  return r ? NextResponse.json(r) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
