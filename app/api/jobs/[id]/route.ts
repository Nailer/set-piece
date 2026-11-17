import { NextResponse } from "next/server";
import { getJob } from "@/lib/server/forge";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = getJob((await ctx.params).id);
  return job ? NextResponse.json(job) : NextResponse.json({ error: "That job is no longer on this server." }, { status: 404 });
}
