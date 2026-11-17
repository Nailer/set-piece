import { forge, getJob } from "../lib/server/forge";
const sets = [
  { id: "set-kitchen", name: "Kitchen Kingdom", theme: "kitchen utensils carved from warm olive wood" },
  { id: "set-robots", name: "Tin Robots", theme: "retro wind-up tin toy robots in red, cream and silver with rivets" },
  { id: "set-sea", name: "Under the Sea", theme: "coral reef creatures made of frosted sea glass and polished shells" },
];
const only = process.argv.slice(2);
for (const s of sets) {
  if (only.length && !only.some((o) => s.id.includes(o))) continue;
  const t0 = Date.now();
  const { job } = await forge({ ...s, author: "Set Piece", starter: true });
  let last = "";
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const j = getJob(job.id)!;
    if (j.status !== last) { console.log(s.name, j.status, Math.round((Date.now() - t0) / 1000) + "s"); last = j.status; }
    if (j.status === "done" || j.status === "failed") { console.log(s.name, "RESULT", j.status, j.error ?? ""); break; }
  }
}
console.log("ALL DONE");
