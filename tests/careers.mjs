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
// Senators (one on the 2028 ballot, one not) and the President.
const sens = [S.SENATE.find((m) => m.cls === 3 && m.p === "D" && m.own < 54), S.SENATE.find((m) => m.cls === 3 && m.p === "R"), S.SENATE.find((m) => m.cls === 1 && m.p === "D")].filter(Boolean);
for (const you of sens) for (let seed = 1; seed <= 4; seed++) {
  let s = S.newCareer(you.id, seed), guard = 0;
  try {
    while (!s.over && guard++ < 200) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff").slice(0, 4)) s = S.answer(s, m.id, seed % 2);
      const b = S.activeBills(s).find((x) => x.party !== you.p);
      if (b && seed % 2 && S.can(s, "hold")) s = S.doAction(s, "hold", { bill: b.id });
      if (b && seed === 4 && S.can(s, "filibuster") && s.week % 9 === 0) s = S.doAction(s, "filibuster", { bill: b.id });
      const c = s.cab.find((x) => !x.vacant); if (c && S.can(s, "hearing") && s.week % 5 === 0) s = S.doAction(s, "hearing", { id: c.id });
      if (S.can(s, "district")) s = S.doAction(s, "district");
      s = S.advance(s);
    }
    if (!s.over) throw new Error("senate career never ended");
    out.push({ seat: "Sen " + you.seat + " cls" + you.cls, p: you.p, own: you.own, style: "senator", seed, kind: s.result.kind, won: s.result.won, margin: s.result.margin ?? s.result.score ?? 0, laws: s.laws.length, houseD: s.result.houseD });
    n++;
  } catch (e) { fail++; console.log("FAIL senate", you.seat, seed, "week", s.week, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
const presOut = [];
for (let seed = 1; seed <= 8; seed++) {
  let s = S.newCareer("POTUS", seed), guard = 0;
  try {
    while (!s.over && guard++ < 200) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff")) s = S.answer(s, m.id, seed % 3 === 0 ? 1 : 0);
      for (const b of s.bills.filter((x) => x.stage === "desk")) s = S.decide(s, b.id, seed % 2 === 0 || S.presView(s, b).signs);
      const b = S.activeBills(s).find((x) => x.stage === "committee");
      if (b) { const t = S.HOUSE.find((m) => m.p === "R" && !(b.asked || {})[m.id]); if (t && S.can(s, "call")) s = S.doAction(s, "call", { bill: b.id, id: t.id }); if (!S.presView(s, b).signs && S.can(s, "threat") && !b.threat) s = S.doAction(s, "threat", { bill: b.id }); }
      if (seed > 4 && S.can(s, "rally")) s = S.doAction(s, "rally");
      if (s.week % 10 === 3 && S.can(s, "eo")) s = S.doAction(s, "eo", { pid: ["deport", "tariffs_up", "school_choice", "permitting", "voter_id"][s.week % 5] });
      const hot = s.cab.find((c) => !c.vacant && c.heat > 0.8); if (hot && S.can(s, "fire")) s = S.doAction(s, "fire", { id: hot.id });
      s = S.advance(s);
    }
    if (!s.over) throw new Error("presidency never ended");
    presOut.push(s.result); n++;
  } catch (e) { fail++; console.log("FAIL president", seed, "week", s.week, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
// Campaigners: spend, poll, pay dues, give, petition, request earmarks, force votes.
for (const you of [picks[0], picks[2], S.SENATE.find((m) => m.cls === 3 && m.p === "D")]) for (let seed = 1; seed <= 3; seed++) {
  let s = S.newCareer(you.id, seed), guard = 0;
  try {
    while (!s.over && guard++ < 200) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff")) s = S.answer(s, m.id, seed % 3);
      if (S.earWindow(s)) for (const e of S.earOptions(s).slice(0, 3)) s = S.requestEarmark(s, e.i);
      if (s.week % 6 === 0) s = S.payDues(s, 25);
      if (s.week === 3) s = S.startLpac(s);
      if (S.yourRace(s) && s.opp) { const left = S.ELECTION_WEEK - (s.week - (s.termStart || 0)); if (left > 30 && s.week % 5 === 0) s = S.campaignSpend(s, "field", 50); if (left < 9) s = S.campaignSpend(s, "tv", 100); if (s.week % 9 === 0) s = S.buyPoll(s); if (s.week % 10 === 0) s = S.askForHelp(s); }
      const bg = S.battleground(s, you.ch, you.p); if (bg.length && s.week % 7 === 0) { const x = bg[0]; s = S.giveTo(s, x.mine ? x.m.id : `cand:${x.m.id}`, s.week % 14 ? "check" : "event"); if (s.lpac) s = S.giveTo(s, x.mine ? x.m.id : `cand:${x.m.id}`, "lpac"); }
      for (const b of S.activeBills(s)) { if (S.canPetition(s, b) && S.can(s, "petition") && seed === 1) s = S.doAction(s, "petition", { bill: b.id }); if (S.PRIVILEGED[b.pid] && !b.privileged && S.can(s, "privileged")) s = S.doAction(s, "privileged", { bill: b.id }); }
      if (S.can(s, "funds")) s = S.doAction(s, "funds");
      s = S.advance(s);
    }
    if (!s.over) throw new Error("campaign career never ended");
    out.push({ seat: (you.ch === "S" ? "Sen " : "") + you.seat, p: you.p, own: you.own, style: "campaigner", seed, kind: s.result.kind, won: s.result.won, margin: s.result.margin ?? 0, laws: s.laws.length, houseD: s.result.houseD, week: s.week });
    n++;
    if (seed === 1) console.log("campaigner", you.seat, "opp", s.opp && Math.round(s.opp.raised), "spent", Math.round(s.camp?.spent || 0), "polls", (s.polls || []).length, "ears", (s.ear || []).map((e) => e.status).join("/"), "dues", s.dues?.paid, "petitions", (s.petitions || []).map((p) => p.n + p.status).join(" "), "lpac", s.lpac && s.lpac.raised);
  } catch (e) { fail++; console.log("FAIL campaigner", you.seat, seed, "week", s.week, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
// Money, courts and crises: every new inbox kind answered every way, every money option on.
for (const [id, label] of [[S.SENATE.find((m) => m.last === "Booker").id, "Booker"], ["POTUS", "President"]]) for (let seed = 1; seed <= 3; seed++) {
  let s = S.newCareer(id, seed), guard = 0;
  try {
    s = S.setMoney(s, id === "POTUS" ? "family" : "trade", id === "POTUS" ? true : "informed"); s = S.setMoney(s, "spousePay", seed === 2); s = S.setMoney(s, "spouseConsult", seed === 3); s = S.setMoney(s, "teach", seed === 1);
    while (!s.over && guard++ < 200) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff")) s = S.answer(s, m.id, (s.week + seed) % 3);
      if (s.week === 8) s = S.bookDeal(s); if (s.week === 9) s = S.bookDeal(s, true);
      s = S.advance(s);
    }
    if (!s.over) throw new Error("career never ended");
    s = S.chooseAfter(s, S.afterPaths(s)[0][0]);
    if (!(S.earnTotal(s) > 0)) throw new Error("no earnings");
    if (seed === 1) console.log("world", label, "earned", Math.round(S.earnTotal(s)), "court", S.onBench(s).length, "decided", s.court.decided.length, "crises", (s.crises || []).length, "judges", s.bench.confirmed);
    n++;
  } catch (e) { fail++; console.log("FAIL world", label, seed, "week", s.week, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
// Long careers: keep winning and keep going, through 2034.
const longOut = [];
for (const [id, seed] of [[S.HOUSE.filter((m) => m.p === "D").sort((a, b) => b.own - a.own)[0].id, 1], [S.HOUSE.filter((m) => m.p === "R").sort((a, b) => b.own - a.own)[0].id, 2], [S.SENATE.find((m) => m.cls === 1).id, 3], [S.HOUSE.find((m) => m.p === "D" && m.st === "GA").id, 4]]) {
  let s = S.newCareer(id, seed), guard = 0, terms = 1;
  try {
    while (guard++ < 900) {
      for (const m of s.inbox.filter((x) => !x.done && x.kind !== "staff")) s = S.answer(s, m.id, m.kind === "higher" ? (seed === 4 ? 0 : 1) : 0);
      if (S.can(s, "district")) s = S.doAction(s, "district");
      if (S.can(s, "funds")) s = S.doAction(s, "funds");
      s = S.advance(s);
      if (s.over) { if (S.canContinue(s) && terms < 4) { s = S.nextCongress(s); terms++; } else break; }
    }
    if (!s.over) throw new Error("long career never ended");
    longOut.push(`${S.memberById[s.youId].seat} terms ${terms} ${s.result.kind} ${s.result.won ? "W" : "L"} pp ${S.presParty()} H-D ${S.HOUSE.filter((m) => m.p === "D").length} S-D ${S.SENATE.filter((m) => m.p === "D").length} lead ${S.memberById[s.youId].lead?.[0] || "-"}`); n++;
  } catch (e) { fail++; console.log("FAIL long", id, seed, "week", s.week, e.stack.split("\n").slice(0, 4).join(" | ")); }
}
console.log("Long careers:", longOut.join(" · "));
console.log("President:", presOut.map((r) => `${r.kind} ${r.won ? "W" : "L"} ${r.margin ?? ""} appr ${r.approval ?? ""} laws ${r.laws ?? ""} vetoes ${r.vetoes ?? ""}`).join(" · "));
const by = (f) => out.reduce((a, r) => ((a[f(r)] = a[f(r)] || []).push(r), a), {});
for (const [k, rs] of Object.entries(by((r) => `${r.seat} ${r.p} own ${r.own} · ${r.style}`)))
  console.log(k.padEnd(34), "won", rs.filter((r) => r.won).length + "/" + rs.length, "avg margin", (rs.reduce((a, r) => a + r.margin, 0) / rs.length).toFixed(1), "laws", (rs.reduce((a, r) => a + r.laws, 0) / rs.length).toFixed(1), "ended by", [...new Set(rs.map((r) => r.kind))].join("/"));
console.log("careers", n, "failures", fail, "House D after election, range", Math.min(...out.map((r) => r.houseD ?? 999)), "to", Math.max(...out.map((r) => r.houseD ?? 0)));
process.exit(fail ? 1 : 0);
