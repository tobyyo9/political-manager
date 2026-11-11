// How a member decides a vote. Weights for the party line, loyalty, party wings and
// cross-pressure were fitted to real 119th Congress roll calls (scripts/calibrate.py);
// the rest are design values still to be tuned.
import type { Bill, Member, MemberVote, Pressure, RollCallResult } from "./types";
import calibration from "../data/calibration.json" with { type: "json" };

const W = calibration.weights as { line: number; loyal: number; wing1: number; wing2: number; cross: number };
const WHIP = 2.2;            // how far a leadership whip moves a party's line (log-odds)
const PRESIDENT = 0.9;       // his pull on his own party's line; the opposition is pushed the other way at a third of that
const PLEDGE = 3.0;          // penalty for breaking the anti-tax pledge
const PRES_PARTY = "R";

const sig = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (x: number) => { const c = Math.min(0.98, Math.max(0.02, x)); return Math.log(c / (1 - c)); };
const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1; };

export interface Extras { deal?: Record<string, number>; relation?: Record<string, number> }

// A member's own pull toward the bill, before any party pressure.
function conviction(m: Member, b: Bill) {
  return b.base + b.dir1 * b.sharp1 * (m.dim1 - b.cut1) + b.dir2 * b.sharp2 * (m.dim2 - b.cut2);
}

export function leanings(members: Member[], bill: Bill, extras: Extras = {}) {
  const out: { m: Member; lean: number; p: number; pressures: Pressure[] }[] = [];
  const parties = { D: members.filter((m) => m.party === "D"), R: members.filter((m) => m.party === "R") };
  const facts: Record<string, { line: number; sd1: number; sd2: number; natural: number }> = {};
  for (const p of ["D", "R"] as const) {
    const ms = parties[p];
    const natural = ms.reduce((a, m) => a + sig(conviction(m, bill)), 0) / Math.max(1, ms.length);
    const pres = bill.president * (p === PRES_PARTY ? PRESIDENT : -PRESIDENT / 3);
    const whip = bill.kind === "procedural" ? WHIP * 1.6 : WHIP;
    const override = bill.kind === "override" && p === PRES_PARTY ? -1.2 : 0;      // defying him twice is harder
    const mustpass = bill.kind === "mustpass" ? 0.8 : 0;
    facts[p] = {
      natural,
      line: logit(natural) + whip * bill.lead[p] + pres + override + mustpass,
      sd1: sd(ms.map((m) => m.dim1)), sd2: sd(ms.map((m) => m.dim2)),
    };
  }
  for (const m of members) {
    const mine = facts[m.party === "I" ? "D" : m.party];
    const other = facts[m.party === "R" ? "D" : "R"];
    const loyalty = ((m.unity ?? 0.95) - 0.95) * 10;
    const pr: Pressure[] = [];
    const add = (label: string, value: number) => { if (Math.abs(value) >= 0.05) pr.push({ label, value }); };
    const whipPart = W.line * WHIP * bill.lead[mine === facts.D ? "D" : "R"];
    add(bill.lead[m.party === "R" ? "R" : "D"] > 0 ? "Party leaders are whipping for it" : "Party leaders are whipping against it", whipPart);
    add("Where their party naturally stands", W.line * logit(mine.natural));
    const presPart = W.line * bill.president * (m.party === PRES_PARTY ? PRESIDENT : -PRESIDENT / 3);
    add(bill.president > 0 ? "The President wants it" : "The President opposes it", presPart);
    add("Loyalty to the party line", W.loyal * mine.line * loyalty);
    // Which wing of their party the bill splits off.
    const wing1 = W.wing1 * bill.dir1 * Math.min(1.5, bill.sharp1 / 3) * ((m.dim1 - b1(bill, parties, m)) / mine.sd1);
    const wing2 = W.wing2 * bill.dir2 * Math.min(1.5, bill.sharp2 / 3) * ((m.dim2 - b2(bill, parties, m)) / mine.sd2);
    add("Their own views on the economics", wing1);
    add("Their own views on the cultural side", wing2);
    const unsafe = Math.max(0, 0.08 - (m.ownLean ?? 20) / 100);
    add("Their district leans toward the other party", W.cross * unsafe * (other.line - mine.line) * 4);
    if (bill.kind === "override" && m.party === PRES_PARTY) add("Overriding their own President", W.line * -1.2);
    if (bill.kind === "mustpass") add("Failure means a default or shutdown", W.line * 0.8);
    if (bill.taxHike && m.party === "R") add("Signed the anti-tax pledge", -PLEDGE);
    const deal = extras.deal?.[m.id] ?? 0; add("What you offered them", deal);
    const rel = extras.relation?.[m.id] ?? 0; add("Their relationship with you", rel);
    const lean = pr.reduce((a, x) => a + x.value, 0);
    pr.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    out.push({ m, lean, p: sig(lean), pressures: pr });
  }
  return out;
}

// The dividing line inside a party: the bill's own line, kept inside the party's range.
function clampTo(ms: Member[], key: "dim1" | "dim2", cut: number) {
  const xs = ms.map((m) => m[key]).sort((a, b) => a - b);
  const lo = xs[Math.floor(xs.length * 0.1)], hi = xs[Math.floor(xs.length * 0.9)];
  return Math.min(hi, Math.max(lo, cut));
}
const cache = new WeakMap<object, Record<string, number>>();
function cuts(bill: Bill, parties: Record<"D" | "R", Member[]>) {
  let c = cache.get(bill);
  if (!c) {
    c = { D1: clampTo(parties.D, "dim1", bill.cut1), R1: clampTo(parties.R, "dim1", bill.cut1), D2: clampTo(parties.D, "dim2", bill.cut2), R2: clampTo(parties.R, "dim2", bill.cut2) };
    cache.set(bill, c);
  }
  return c;
}
const b1 = (bill: Bill, parties: Record<"D" | "R", Member[]>, m: Member) => cuts(bill, parties)[(m.party === "R" ? "R" : "D") + "1"];
const b2 = (bill: Bill, parties: Record<"D" | "R", Member[]>, m: Member) => cuts(bill, parties)[(m.party === "R" ? "R" : "D") + "2"];

export function needFor(bill: Bill, total: number) {
  return bill.kind === "override" ? Math.ceil((total * 2) / 3) : Math.floor(total / 2) + 1;
}

// Call the roll: every member's probability becomes a yes or no.
export function rollCall(members: Member[], bill: Bill, rand: () => number, extras: Extras = {}): RollCallResult {
  const ls = leanings(members, bill, extras);
  const raw = ls.map((l) => ({ ...l, yes: rand() < l.p }));
  const byParty: Record<string, { yes: number; no: number }> = { D: { yes: 0, no: 0 }, R: { yes: 0, no: 0 }, I: { yes: 0, no: 0 } };
  for (const v of raw) byParty[v.m.party][v.yes ? "yes" : "no"]++;
  const majority = (p: string) => byParty[p].yes >= byParty[p].no;
  const votes: MemberVote[] = raw.map((v) => ({ id: v.m.id, lean: v.lean, p: v.p, yes: v.yes, pressures: v.pressures, crossed: v.m.party !== "I" && v.yes !== majority(v.m.party) }));
  const yes = votes.filter((v) => v.yes).length;
  const need = needFor(bill, members.length);
  return { bill, votes, yes, no: votes.length - yes, need, passed: yes >= need, byParty };
}
