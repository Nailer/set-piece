import { NextResponse } from "next/server";
import { queueLength } from "@/lib/server/forge";
import { hasApiKey } from "@/lib/server/lux";
import { listSets } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sets: await listSets(), canMake: hasApiKey(), queue: queueLength() });
}
