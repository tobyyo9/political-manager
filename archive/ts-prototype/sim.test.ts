// Headless checks: the roster loads, votes are reproducible from a seed, and the
// opening bills land where real votes of that kind land.
import { readFileSync } from "node:fs";
import { rollCall, leanings } from "../src/engine/vote.ts";
import { rng } from "../src/engine/rng.ts";
import { BILLS } from "../src/engine/bills.ts";

const house = JSON.parse(readFileSync(new URL("../src/data/house.json", import.meta.url), "utf8"));
const members = house.members;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`); if (!ok) fail++; };

check("roster size", members.length >= 425 && members.length <= 435, String(members.length));
const a = rollCall(members, BILLS[0], rng(42)), b = rollCall(members, BILLS[0], rng(42));
check("same seed, same vote", a.yes === b.yes && a.votes.every((v, i) => v.yes === b.votes[i].yes));
for (const bill of BILLS) {
  const runs = Array.from({ length: 40 }, (_, i) => rollCall(members, bill, rng(i + 1)));
  const avg = (f: (r: typeof runs[0]) => number) => Math.round(runs.reduce((s, r) => s + f(r), 0) / runs.length);
  console.log(`     ${bill.title.padEnd(42)} yes ${avg((r) => r.yes)} / need ${runs[0].need} | D ${avg((r) => r.byParty.D.yes)}-${avg((r) => r.byParty.D.no)} R ${avg((r) => r.byParty.R.yes)}-${avg((r) => r.byParty.R.no)} | passes ${Math.round(100 * runs.filter((r) => r.passed).length / runs.length)}%`);
}
const recon = rollCall(members, BILLS[0], rng(1));
check("reconciliation is party-line", recon.byParty.R.yes <= 3 && recon.byParty.D.no <= 8, `R yes ${recon.byParty.R.yes}, D no ${recon.byParty.D.no}`);
const kids = rollCall(members, BILLS[1], rng(1));
check("bipartisan bill passes wide", kids.yes > 330, String(kids.yes));
const t0 = performance.now(); for (let i = 0; i < 200; i++) leanings(members, BILLS[i % BILLS.length]); const ms = (performance.now() - t0) / 200;
check("a vote computes fast", ms < 5, ms.toFixed(2) + " ms");
process.exit(fail ? 1 : 0);
