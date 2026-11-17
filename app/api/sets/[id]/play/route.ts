import { NextResponse } from "next/server";
import { patchSet } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await patchSet((await ctx.params).id, (s) => {
    s.plays = (s.plays ?? 0) + 1;
  });
  return NextResponse.json({ ok: true });
}
