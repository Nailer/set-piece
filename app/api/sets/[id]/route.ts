import { NextResponse } from "next/server";
import { getSet } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const set = await getSet((await ctx.params).id);
  return set ? NextResponse.json(set) : NextResponse.json({ error: "No such set." }, { status: 404 });
}
