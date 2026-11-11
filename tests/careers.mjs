// Headless careers: many seeds, several kinds of seat and play style. Nothing may crash,
// every career must end, and results must look like real elections.
import * as S from "SIM";
const picks = [S.HOUSE.find((m) => m.flip), S.HOUSE.filter((m) => m.p === "D").sort((a, b) => b.own - a.own)[0],
  S.HOUSE.filter((m) => m.p === "R").sort((a, b) => a.own - b.own)[0], S.HOUSE.filter((m) => m.p === "R").sort((a, b) => b.own - a.own)[0]];
const styles = { idle: [], district: ["district", "district", "funds"], insider: ["committee", "committee", "tv"] };
let fail = 0, n = 0; const out = [];
for (const you of picks) for (const [style, acts] of Object.entries(styles)) for (let seed = 1; seed <= 6; seed++) {
  let s = S.newCareer(you.id, seed), guard = 0;
  try {
    while (!s.over && guard++ < 200) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff").slice(0, 3)) s = S.answer(s, m.id, seed % 2);
      for (const a of acts) if (S.can(s, a)) s = S.doAction(s, a);
      if (style === "insider") { const b = S.activeBills(s)[0]; const t = b && S.HOUSE.find((m) => m.id !== you.id && !(b.asked || {})[m.id]); if (b && t && S.can(s, "whip")) s = S.doAction(s, "whip", { bill: b.id, id: t.id }); }
      s = S.advance(s);
    }
    if (!s.over) throw new Error("career never ended");
    const rk = S.rankings(s);
    out.push({ seat: you.seat, p: you.p, own: you.own, style, seed, kind: s.result.kind, won: s.result.won, margin: s.result.margin ?? (s.result.share - 50) * 2, laws: s.laws.length, houseD: s.result.houseD, week: s.week });
    n++;
  } catch (e) { fail++; console.log("FAIL", you.seat, style, seed, "week", s.week, e.message.split("\n")[0]); }
}
const by = (f) => out.reduce((a, r) => ((a[f(r)] = a[f(r)] || []).push(r), a), {});
for (const [k, rs] of Object.entries(by((r) => `${r.seat} ${r.p} own ${r.own} · ${r.style}`)))
  console.log(k.padEnd(34), "won", rs.filter((r) => r.won).length + "/" + rs.length, "avg margin", (rs.reduce((a, r) => a + r.margin, 0) / rs.length).toFixed(1), "laws", (rs.reduce((a, r) => a + r.laws, 0) / rs.length).toFixed(1), "ended by", [...new Set(rs.map((r) => r.kind))].join("/"));
console.log("careers", n, "failures", fail, "House D after election, range", Math.min(...out.map((r) => r.houseD ?? 999)), "to", Math.max(...out.map((r) => r.houseD ?? 0)));
process.exit(fail ? 1 : 0);
