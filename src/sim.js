// Political Manager simulation engine. No screen code in here: the world, the
// members, the vote formula and the weekly loop. Everything random comes from a
// seed, so the same seed and the same choices replay the same history.
import RAW from "./data/members.json";
import GENDER from "./data/gender.json";
import CAUCUS from "./data/caucuses.json";
import { GROUPS } from "./shared/data/typology.js";
import { POLICIES } from "./shared/data/policies.js";
import { PRESIDENT_STANCE } from "./shared/data/president.js";
import { groupScores, byId, tenYearOf } from "./shared/engine.js";
import { IGROUPS, groupById, groupPull, dependence } from "./groups.js";
import { CABINET, BENCH, PRESIDENT } from "./exec.js";
// The President's party and the current year change when a career runs past 2028.
let PP = "R", YEAR = 2027;
const PSIGN = () => (PP === "R" ? 1 : -1);
// Where the generic ballot settles given the President's approval: a 40% President costs his party about 3 points, plus about 2 for being the party in power.
export const moodTarget = (s) => PSIGN() * ((45 - s.presApproval) * 0.45 + 2);
export const presParty = () => PP;
export const yearOf = () => YEAR;
export { IGROUPS, groupById };

export { byId, tenYearOf };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sig = (x) => 1 / (1 + Math.exp(-x));

// ── Random numbers from a seed ──
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const noise = (key) => { const r = rng(hash(key)); return (r() + r() + r() - 1.5) / 1.5; }; // roughly -1..1, bell-shaped

// ── The calendar ──
export const START = Date.UTC(2027, 0, 3);
export const WEEKS = 97;              // Jan 3, 2027 to the Nov 7, 2028 election
export const PRIMARY_WEEK = 74;       // June 2028
export const ELECTION_WEEK = 96;
export const dateOf = (w) => new Date(START + w * 7 * 86400000);
export const fmtDate = (w) => dateOf(w).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// ── Voters: the nine Pew groups, tilted to match each district's 2024 result ──
const two = (g) => g.dem / (g.dem + g.rep);
function mixFor(demPct) {
  const target = clamp(demPct / 100, 0.08, 0.92);
  const share = (t) => { let n = 0, d = 0; for (const g of GROUPS) { const w = g.share * g.turnout2024 * Math.exp(t * (g.dem - g.rep)); n += w * two(g); d += w; } return n / d; };
  let lo = -6, hi = 6;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (share(mid) < target) lo = mid; else hi = mid; }
  const t = (lo + hi) / 2, w = {}; let s = 0;
  for (const g of GROUPS) { w[g.id] = g.share * g.turnout2024 * Math.exp(t * (g.dem - g.rep)); s += w[g.id]; }
  for (const k in w) w[k] /= s;
  return w;
}
function primaryMix(mix, party) {
  const w = {}; let s = 0;
  for (const g of GROUPS) { w[g.id] = mix[g.id] * (party === "D" ? g.dem : g.rep) * g.turnout2024; s += w[g.id]; }
  for (const k in w) w[k] /= s;
  return w;
}

// ── Members ──
export const TRAIT_LABEL = { dealmaker: "Dealmaker", believer: "True believer", grudge: "Long memory", vain: "Loves the spotlight", loyalist: "Party loyalist", follower: "Follows the President", wonk: "Policy wonk", showhorse: "Show horse" };
export const TRAIT_DESC = {
  dealmaker: "Easier to move, but always wants something back.", believer: "Moves only if their voters like the bill.", grudge: "Remembers a broken promise for years.",
  vain: "Your standing counts double with them.", loyalist: "Votes with party leaders unless the district revolts.", follower: "Moves when the President signals.",
  wonk: "Cares about the details; respects committee work.", showhorse: "Chases cameras; trades votes for attention.",
};
function factionOf(m, q) {
  if (m.p === "D") return m.x < q.D[0] ? "Progressives" : m.x < q.D[1] ? "Mainstream Democrats" : "Moderate Democrats";
  return m.x > q.R[1] ? "Hard-right conservatives" : m.x > q.R[0] ? "Mainstream Republicans" : "Governing-wing Republicans";
}
export const FACTION_NOTE = {
  "Progressive Caucus": "The Congressional Progressive Caucus, the left of the party. Wants Medicare for All, higher taxes on the rich, limits on ICE and war powers.",
  "New Democrat Coalition": "The pro-business, pro-growth center of the party and its biggest bloc. Membership here is estimated: the public roster could not be fetched.",
  "Blue Dog Coalition": "Fiscally conservative Democrats, mostly from Trump-won or rural seats. Small, but each vote is in play.",
  "Democrats, no bloc": "Democrats who are not in a big ideological caucus. They tend to follow leadership.",
  "Freedom Caucus": "The House Freedom Caucus, the hard right. Will sink its own party's bills over spending or process.",
  "Republican Study Committee": "The conservative mainstream and the biggest Republican bloc. Membership here is estimated from voting records.",
  "Main Street Caucus": "Governing-wing Republicans, many from competitive seats, who want bills to pass. Membership here is estimated from voting records.",
  "Progressives": "The most liberal Senate Democrats by voting record.",
  "Mainstream Democrats": "The middle of the Senate Democrats; follows leadership.",
  "Moderate Democrats": "The least liberal Senate Democrats, many from purple states.",
  "Hard-right conservatives": "The most conservative Senate Republicans.",
  "Mainstream Republicans": "The bulk of the Senate Republican conference.",
  "Governing-wing Republicans": "The least conservative Senate Republicans, often deal-makers.",
};
// Real caucus rosters (House). Matched by last name and state; seats not on a roster are placed by voting record and flagged estimated.
const normN = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ").trim();
const ROSTER = {};
for (const k of ["Progressive Caucus", "Freedom Caucus", "Blue Dog Coalition"]) ROSTER[k] = CAUCUS[k].split(";").map((e) => e.split(","));
const onRoster = (m, k) => !m.placeholder && !m.custom && ROSTER[k].some(([l, st]) => st === m.st && (normN(m.last) === normN(l) || normN(m.last).endsWith(normN(l)) || normN(l).endsWith(normN(m.last))));
export const CAUCUS_CHAIR = CAUCUS.chairs;
function houseCaucus(ms) {
  const H = ms.filter((m) => m.ch === "H");
  for (const m of H) { m.caucus = []; m.cauEst = false; }
  for (const m of H) for (const k of Object.keys(ROSTER)) if (onRoster(m, k)) m.caucus.push(k);
  const Ds = H.filter((m) => m.p === "D" && !m.caucus.length), Rs = H.filter((m) => m.p === "R" && !m.caucus.length);
  const cpcLine = (() => { const xs = H.filter((m) => m.caucus.includes("Progressive Caucus")).map((m) => m.x).sort((a, b) => a - b); return xs[Math.floor(xs.length * 0.6)]; })();
  const dx = Ds.map((m) => m.x).sort((a, b) => a - b), ndLine = dx[Math.floor(dx.length * 0.22)];
  for (const m of Ds) { m.cauEst = true; m.caucus.push(m.placeholder && m.x < cpcLine ? "Progressive Caucus" : m.x >= ndLine ? "New Democrat Coalition" : "Democrats, no bloc"); }
  const rx = Rs.map((m) => m.x).sort((a, b) => a - b), msLine = rx[Math.floor(rx.length * 0.3)], fcLine = rx[Math.floor(rx.length * 0.96)];
  for (const m of Rs) { m.cauEst = true; m.caucus.push(m.placeholder && m.x > fcLine ? "Freedom Caucus" : m.x <= msLine ? "Main Street Caucus" : "Republican Study Committee"); }
  // Blue Dogs also sit in the New Dems; the bloc that drives their vote is the first one.
  for (const m of H) { if (m.caucus.includes("Blue Dog Coalition") && m.x < -0.15) m.caucus.push("New Democrat Coalition"); m.faction = m.caucus[0]; }
}
const PF = "Maya Daniel Priya Marcus Elena Jordan Aisha Tyler Sofia Caleb Naomi Andre Leah Mateo Hannah Darius Claire Omar Grace Wes Ines Malik Tessa Rafael Joy Colin Amara Dev Paige Luis Renee Kofi Brooke Tomas Nadia Reid Carmen Isaac Lena Xavier Bianca Hugo Simone Eli Farah Grant Yara Miles Tamsin Jonah Imani Rhys Corinne Anders Lucia Desmond".split(" ");
const PL = "Whitfield Navarro Okoye Brandt Castellano Pruitt Mbeki Halloran Vasquez Lindqvist Tran Abernathy Rosales Keating Dlamini Mercer Fontaine Osei Kowalczyk Barros Thackeray Nakamura Delacroix Hollis Ferreira Stanhope Ibarra Calloway Petrov Adeyemi Winslow Zamora Beckett Oyelaran Marchetti Sandoval Hargreaves Bui Lockhart Esparza Achterberg Bellweather Cardenas Drummond Eastlake Farrow Galanis Haverford Iwasaki Jessup Kilbride Lachance Montoya Nwosu Ostrander Pemberton Quintero Rasmussen Sokolov Tallchief".split(" ");
function buildMembers() {
  const ms = RAW.map((r, i) => ({ ...r, i }));
  // Placeholder newcomers (seats whose real 2026 winner is not published yet) each get a distinct invented name.
  for (const m of ms) m.g = GENDER[m.id] || (noise(m.id + "g") > 0 ? "F" : "M");
  ms.filter((m) => m.gen).forEach((m, k) => { m.first = m.sf = PF[(k * 7) % PF.length]; m.last = m.sl = PL[k % PL.length]; m.placeholder = true; });
  // Committee posts in the data are already set for the 120th Congress (Democrats chair).
  for (const m of ms) for (const c of m.comm || []) c.role = c.title || "";
  for (const ch of ["H", "S"]) {
    const q = {};
    for (const p of ["D", "R"]) { const xs = ms.filter((m) => m.ch === ch && m.p === p).map((m) => m.x).sort((a, b) => a - b); q[p] = p === "D" ? [xs[Math.floor(xs.length * 0.3)], xs[Math.floor(xs.length * 0.7)]] : [xs[Math.floor(xs.length * 0.3)], xs[Math.floor(xs.length * 0.8)]]; }
    for (const m of ms) if (m.ch === ch) m.faction = factionOf(m, q);
  }
  houseCaucus(ms);
  for (const m of ms) derive(m);
  return ms;
}
function derive(m) {
    m.mix = mixFor(m.dem);
    m.pmix = primaryMix(m.mix, m.p);
    const own = m.p === "D" ? m.dem : 100 - m.dem;           // their party's 2024 share at home
    m.own = own;
    m.vuln = clamp(1 - (own - 49) / 14, 0.12, 1);             // thin margin = listens to the district
    m.prisk = clamp((own - 52) / 22, 0.08, 0.85);             // safe seat = fears the primary
    m.signer = m.p === "R" && noise(m.id + "pledge") > -0.75; // most Republicans signed the anti-tax pledge
    m.seat = m.ch === "H" ? `${m.st}-${m.d || "AL"}` : m.st;
    m.seniority = YEAR - (m.since || YEAR);
    m.chair = (m.comm || []).find((c) => c.role === "Chair");
    m.base = { influence: Math.round(10 + m.seniority * 1.6 + (m.lead?.length ? 45 : 0) + (m.chair ? 22 : 0) + m.t.ambition * 10), cash: Math.round(300 + m.vuln * 1400 + m.seniority * 25 + m.t.ambition * 400) };
}
export const MEMBERS = buildMembers();
// A snapshot of the starting Congress, so a new career always starts from the real 2027 roster.
const ORIG = MEMBERS.map((m) => JSON.parse(JSON.stringify(m)));
export const memberById = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));
export const HOUSE = MEMBERS.filter((m) => m.ch === "H");
export const SENATE = MEMBERS.filter((m) => m.ch === "S");
// The President as a playable character. Not a member: never in a roll call.
export const PRES_M = { ...PRESIDENT, look: PRESIDENT.look, seat: "The White House", own: 50, dem: 50, vuln: 0.5, prisk: 0.1, signer: false, seniority: 0, chair: null, base: { influence: 100, cash: 3000 },
  t: { label: "vain", ambition: 0.9, loyalty: 0.3, ego: 0.95, ethics: 0.3, deal: 0.8 }, comm: [], lead: ["President of the United States"], faction: "The White House", caucus: ["The White House"] };
memberById.POTUS = PRES_M;
// Which job you hold: "H" House member, "S" senator, "P" President.
export const roleOf = (s) => s.role || (memberById[s.youId]?.ch === "S" ? "S" : "H");
const CH = (s) => (roleOf(s) === "S" ? SENATE : HOUSE);
// Is a senator on the ballot in 2028? Class 3 seats are; classes 1 and 2 are not.
export const upIn2028 = (m) => m.ch === "H" || m.cls === 3;
// Which Senate class is on the ballot at the end of a given term: 2028 class 3, 2030 class 1, 2032 class 2.
export const cycleClass = (term) => [3, 1, 2][((term || 1) - 1) % 3];
export const upThisTerm = (s, m) => m.ch === "H" || m.cls === cycleClass(s.term);
export const electionYear = (s) => 2028 + 2 * ((s.term || 1) - 1);
export const nameOf = (m, real) => (real ? `${m.first} ${m.last}` : `${m.sf} ${m.sl}`);
export const titleOf = (m) => (m.ch === "H" ? "Rep." : m.ch === "S" ? "Sen." : "President");

// ── Bills: every Fix the Deficit policy is a bill someone can carry ──
const LEFT = ["lp", "ll", "lol", "ool"], RIGHT = ["nar", "ffc", "ur", "ppr"];
const TAX_HIKES = new Set(["corp_rate", "top_rate", "all_rates", "niit", "cap_gains", "step_up", "ss_payroll_250k", "itemized", "vat", "carbon", "ftt", "gas_tax", "intl_corp", "wealth_tax", "irs", "carried_interest", "buyback_tax", "datacenter", "ss_rate"]);
const cache = {};
export function billInfo(pid, sponsorParty) {
  const k = pid + sponsorParty;
  if (cache[k]) return cache[k];
  const p = byId[pid];
  const scores = groupScores({ [pid]: p.levels.length - 1 > 0 ? 0 : 0 }, { sponsor: sponsorParty, years: 0 });
  const avg = (ids) => ids.reduce((a, g) => a + scores[g], 0) / ids.length;
  const dir = clamp((avg(LEFT) - avg(RIGHT)) / 0.7, -1, 1);                       // +1 = a liberal bill, -1 = a conservative one
  const tot = GROUPS.reduce((a, g) => a + g.share, 0);
  const pop = GROUPS.reduce((a, g) => a + g.share * scores[g.id], 0) / tot;
  const pres = PRESIDENT_STANCE[pid] ?? clamp(0.6 * scores.nar + 0.4 * scores.ffc, -1, 1);
  return (cache[k] = { pid, scores, dir, pop, pres, tax: TAX_HIKES.has(pid) && tenYearOf(pid, 0) > 0, bipartisan: !!p.bipartisan, mustPass: !!p.mustPass, sal: clamp(0.6 + 0.4 * (p.salience ?? 1), 0.5, 1.2), amendment: p.route === "amendment", reconcilable: !!p.reconcilable });
}

// ── The vote formula ──
// L = wC·C + wD·V·S·D + wP·R·P + wL·λ·Y + wX·A·X + wF·F + wG·G + wT·T + K + ε ; P(yes) = 1 / (1 + e^(-kL))
export const W = { C: 0.25, D: 0.2, P: 0.2, L: 0.15, X: 0.15, F: 0.1, G: 0.1, T: 0.1, k: 14, eps: 0.06 };
const dot = (mix, scores) => { let s = 0; for (const g in mix) s += mix[g] * scores[g]; return s; };
const factionLine = {};
function factionC(bill, sponsor, faction, ch) {
  const k = bill.pid + sponsor + faction + ch;
  if (factionLine[k] !== undefined) return factionLine[k];
  const ms = MEMBERS.filter((m) => m.ch === ch && m.faction === faction);
  return (factionLine[k] = clamp((ms.reduce((a, m) => a + conviction(m, bill), 0) / ms.length) * 1.4, -1, 1));
}
function conviction(m, bill) { return clamp(-m.x * bill.dir * 2.1 + 0.25 * bill.pop, -1, 1); }

// ctx: { sponsor: "D"|"R", kind: "passage"|"override", route, seed, deals: {memberId: K}, trust: {memberId: T} }
export function lean(m, pid, ctx) {
  const bill = billInfo(pid, ctx.sponsor);
  const own = m.p === ctx.sponsor;
  const C = conviction(m, bill);
  const D = clamp(dot(m.mix, bill.scores) * 1.8, -1, 1);
  const P = clamp(dot(m.pmix, bill.scores) * 1.8, -1, 1);
  const partisan = ctx.route === "reconciliation" ? -1.25 : bill.mustPass ? -0.1 : bill.bipartisan ? -0.2 : -1;
  const Y = own ? 1 : partisan;
  const lam = 0.45 + 0.75 * m.t.loyalty;
  const A = m.p === PP ? clamp(0.45 + 0.5 * Math.abs(m.x), 0.3, 0.95) : 0;
  const presS = clamp(bill.pres * PSIGN() + (ctx.wh || 0), -1, 1);
  const X = m.p === PP ? presS * A * (ctx.kind === "override" ? 2 : 1) : bill.bipartisan || bill.mustPass ? 0 : -bill.pres * PSIGN() * 0.3;
  const F = factionC(bill, ctx.sponsor, m.faction, m.ch);
  const pledge = bill.tax && m.signer ? -1 : 0;
  const gp = groupPull(m, pid, noise);
  const G = gp.G;
  const B = (ctx.boost?.[pid] || 0) + (m.p === PP ? Math.max(0, ctx.wh || 0) * 0.5 : 0) - (ctx.fil && m.ch === "S" && m.p === ctx.fil.p ? ctx.fil.w : 0) + (ctx.amends || []).reduce((a, x) => a + (x.p === m.p ? x.w : 0), 0);                           // public pressure after an event
  const T = ctx.trust?.[m.id] || 0;
  const K = ctx.deals?.[m.id] || 0;
  const eps = noise(`${ctx.seed}:${m.id}:${pid}:${ctx.kind || "p"}`) * W.eps * 2;
  const terms = { C: W.C * C, D: W.D * m.vuln * bill.sal * D, P: W.P * m.prisk * P, L: W.L * lam * Y, X: W.X * X, F: W.F * F, G: W.G * G + (pledge ? -0.22 : 0), T: W.T * T, K, B, eps };
  const L = Object.values(terms).reduce((a, b) => a + b, 0);
  return { L, p: sig(W.k * L), terms, raw: { C, D, P, Y, X, F, pledge, G }, groups: gp.who };
}
export const REASONS = {
  C: ["their own record points to yes", "their own record points to no"], D: ["their district likes it", "their district dislikes it"], P: ["their primary voters like it", "their primary voters would punish it"],
  L: ["party leaders want a yes", "party leaders are whipping against"], X: ["the President's position helps", "the President's position hurts"], F: ["their faction is for it", "their faction is against it"],
  G: ["groups they rely on back it", "groups they rely on oppose it"], B: ["public pressure after recent events", "public pressure against it"], T: ["they trust you", "they don't trust you"], K: ["you made a deal", ""],
};
export function reasons(l) {
  return Object.entries(l.terms).filter(([k, v]) => k !== "eps" && Math.abs(v) > 0.02).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([k, v]) => ({ k, v, text: REASONS[k][v > 0 ? 0 : 1] }));
}
// A roll call: each member's vote, decided by one seeded draw against their probability.
export function rollCall(chamber, pid, ctx, forced = {}) {
  const ms = chamber === "H" ? HOUSE : SENATE;
  const votes = {}; const tally = { yes: 0, no: 0, D: 0, R: 0 };
  for (const m of ms) {
    let v;
    if (forced[m.id] !== undefined) v = forced[m.id];
    else { const l = lean(m, pid, ctx); const r = rng(hash(`${ctx.seed}:roll:${m.id}:${pid}:${ctx.kind || "p"}`))(); v = r < l.p; }
    votes[m.id] = v;
    if (v) { tally.yes++; tally[m.p]++; } else tally.no++;
  }
  return { votes, ...tally, total: ms.length };
}
export const NEED = { H: { passage: 218, override: 290, amendment: 290 }, S: { passage: 60, reconciliation: 51, override: 67, amendment: 67 } };

// ── A new career ──
export const HOURS = 50;
export const ACTIONS = {
  meet: { label: "Meet a colleague", hours: 6 }, funds: { label: "Call time with donors", hours: 8 }, district: { label: "District events", hours: 8 },
  tv: { label: "Go on TV", hours: 4 }, committee: { label: "Committee work", hours: 8 }, whip: { label: "Whip a member", hours: 5 }, wh: { label: "Lobby the White House", hours: 8 }, cosponsor: { label: "Cosponsor a bill", hours: 2 }, introduce: { label: "Write and introduce a bill", hours: 12 },
  hold: { label: "Place a hold", hours: 2, role: "S" }, filibuster: { label: "Lead a talking filibuster", hours: 12, role: "S" },
  hearing: { label: "Oversight hearing", hours: 8, role: "HS" }, defend: { label: "Defend a cabinet member", hours: 4, role: "HS" },
  call: { label: "Call a member", hours: 3, role: "P" }, push: { label: "Use the bully pulpit", hours: 4, role: "P" }, threat: { label: "Threaten a veto", hours: 1, role: "P" },
  eo: { label: "Sign an executive order", hours: 6, role: "P" }, rally: { label: "Hold a rally", hours: 8, role: "P" }, fire: { label: "Fire a cabinet member", hours: 4, role: "P" },
  hire: { label: "Hire a better staffer", hours: 4, role: "HS" },
  rider: { label: "Add a rider", hours: 6 }, strip: { label: "Strip a rider", hours: 4 },
  sign: { label: "Sign", hours: 0, role: "P" }, veto: { label: "Veto", hours: 0, role: "P" }};
export function newCareer(youId, seed = Math.floor(Math.random() * 1e9), custom = null, diff = null) {
  if (youId === "POTUS") { resetWorld(); return newPresidency(seed, diff); }
  if (!memberById[youId]?.custom) resetWorld();
  const you = memberById[youId];
  const know = {};
  for (const m of MEMBERS) if (m.id !== youId) know[m.id] = m.ch === you.ch && (m.st === you.st || (m.comm || []).some((c) => (you.comm || []).some((d) => d.c === c.c))) ? 1 : 0;
  const s = {
    seed, week: 0, youId, hours: HOURS, cash: custom?.cash ?? Math.round(you.base.cash * 0.4), approval: 50 + Math.round((you.own - 50) * 0.5), baseApproval: 62,
    profile: you.lead?.length ? 60 : Math.round(8 + you.seniority * 1.5), clout: Math.round(you.base.influence), integrity: 70, legis: 0, loyalty: 0,
    know, rel: {}, owedToYou: {}, youOwe: [], promises: [], bills: [], laws: [], news: [], inbox: [], pending: null, log: [], n: 0,
    econ: { growth: 1.6, inflation: 3.4, jobs: 4.6 }, presApproval: 39, mood: 5.3, reconUsed: {}, over: false, result: null, votesCast: [], tookMoney: 0,
    rapport: 0, pres: [], staff: makeStaff(seed), diff: diff || { info: "normal", world: "normal" }, boost: {}, groups: {}, flags: {}, usedEvents: [], moments: [],
    role: you.ch === "S" ? "S" : "H", cab: freshCabinet(), noms: [], presHeat: 0.35, imp: [], term: 1, termStart: 0, edits: {}, pp: "R", career: [],
  };
  mpSeed(s);
  seedBills(s);
  if (you.ch === "S") pushInbox(s, { kind: "staff", from: "Your chief of staff", title: upIn2028(you) ? "You're on the ballot in 2028" : "You're not up until " + (you.cls === 1 ? 2030 : 2032), body: upIn2028(you) ? "Your seat is one of the 34 up in November 2028. Six years usually buys freedom; you don't have it." : "No election this Congress. That buys you room to take hard votes, but leadership, donors and the President still keep score. At the end of 2028 you'll get a verdict on your term." });
  pushInbox(s, { kind: "staff", from: "Your chief of staff", title: "Welcome to the 120th Congress", body: `You have ${HOURS} hours a week. Spend them on colleagues, your district, donors and bills. Votes come to the floor most weeks; I'll flag the ones that matter at home. The election is ${fmtDate(ELECTION_WEEK)}.` });
  return s;
}
const R = (s, tag) => rng(hash(`${s.seed}:${tag}:${s.week}:${s.n++}`));
function pushInbox(s, msg) { s.inbox.unshift({ id: `m${s.week}-${s.inbox.length}-${s.n++}`, week: s.week, done: false, ...msg }); }
function pushNews(s, text, tone = "") { s.news.unshift({ week: s.week, text, tone }); if (s.news.length > 120) s.news.pop(); }

// What each party's leaders want on the floor first.
const AGENDA_D = ["aca", "medicaid_restore", "war_powers", "tariff_repeal", "min_wage", "kids_online", "ratepayer", "drug_neg", "ctc", "stock_ban", "pardon_reform", "background_checks", "voting_rights", "price_gouging", "childcare", "corp_rate", "pbm", "permitting", "debt_limit", "codify_roe", "ethics"];
function seedBills(s) {
  const r = R(s, "seed");
  AGENDA_D.slice(0, 5).forEach((pid, i) => addBill(s, pid, pickSponsor(s, pid, "D", r), 1 + i * 2));
}
function pickSponsor(s, pid, party, r, ch = "H") {
  const bill = billInfo(pid, party), CHM = ch === "S" ? SENATE : HOUSE;
  const pool = CHM.filter((m) => m.p === party && m.id !== s.youId && conviction(m, bill) > 0.2);
  const list = pool.length ? pool : CHM.filter((m) => m.p === party);
  // senior, ambitious members carry the big bills
  const sorted = [...list].sort((a, b) => b.base.influence * (0.5 + r()) - a.base.influence * (0.5 + r()));
  return sorted[0].id;
}
export function addBill(s, pid, sponsorId, floorIn = 3) {
  if (s.bills.some((b) => b.pid === pid && !b.dead) || s.laws.includes(pid)) return null;
  const sp = memberById[sponsorId];
  const b = { id: `b${s.bills.length}`, pid, sponsor: sponsorId, party: sp.p, origin: sp.ch === "S" ? "S" : "H", stage: "committee", floorWeek: s.week + floorIn, intro: s.week, cos: [], deals: {}, asked: {}, yourVote: null, dead: false, hist: [] };
  s.bills.push(b);
  return b;
}
export const activeBills = (s) => s.bills.filter((b) => !b.dead && b.stage !== "law");
export const billCtx = (s, b, kind = "passage") => ({ sponsor: b.party, kind, route: b.route, seed: s.seed, deals: b.deals, boost: s.boost, wh: b.wh, fil: b.fil, amends: b.amends, trust: Object.fromEntries(Object.entries(s.rel).map(([id, v]) => [id, b.asked[id] ? v : 0])) });

// What you can see of a member's lean: the truth blurred by how well you know them.
const BLUR = [0.34, 0.2, 0.1, 0.04];
const INFO = { clear: 0.5, normal: 1, foggy: 1.6 };
const TURB = { calm: 0.5, normal: 1, turbulent: 1.8 };
export const DIFF = { info: { clear: "Clear: whip counts close to the truth", normal: "Normal", foggy: "Foggy: wide error bars" }, world: { calm: "Calm: fewer crises and betrayals", normal: "Normal", turbulent: "Turbulent: more shocks, scandals and rivals" } };
export function estimate(s, m, b) {
  const l = lean(m, b.pid, billCtx(s, b));
  if (m.id === s.youId) return { ...l, est: l.L, bucket: "you" };
  const k = s.know[m.id] || 0;
  const est = l.L + noise(`${s.seed}:est:${m.id}:${b.id}`) * BLUR[k] * INFO[s.diff?.info || "normal"] * (1.35 - 0.035 * (s.staff?.find((x) => x.role === "ld")?.skill || 10));
  const bucket = est > 0.22 ? "yes" : est > 0.06 ? "lean yes" : est > -0.06 ? "undecided" : est > -0.22 ? "lean no" : "no";
  return { ...l, est, bucket, know: k };
}
export function whipCount(s, b, chamber = "H") {
  const ms = chamber === "H" ? HOUSE : SENATE;
  const c = { yes: 0, "lean yes": 0, undecided: 0, "lean no": 0, no: 0 };
  for (const m of ms) { if (m.id === s.youId) continue; c[estimate(s, m, b).bucket]++; }
  return c;
}

// ── Your actions ──
export function can(s, act) { const a = ACTIONS[act]; return !s.over && s.hours >= a.hours && (!a.role || a.role.includes(roleOf(s))); }
function spend(s, act) { s.hours -= ACTIONS[act].hours; }
export function doAction(s0, act, arg = {}) {
  const s = structuredClone(s0);
  if (!can(s, act)) return s;
  const you = memberById[s.youId], r = R(s, act);
  spend(s, act);
  if (act === "meet") {
    const m = memberById[arg.id];
    const gain = 0.07 + 0.08 * r() + (m.p === you.p ? 0.03 : 0) + (m.t.label === "vain" ? s.profile / 800 : 0);
    s.rel[m.id] = clamp((s.rel[m.id] || 0) + gain, -1, 1);
    if ((s.know[m.id] || 0) < 3 && r() < 0.75) s.know[m.id] = (s.know[m.id] || 0) + 1;
    s.log.push(`Met with ${nameOf(m)}.`); s.flags.met = true;
    s.toast = { title: `Coffee with ${nameOf(m)}`, text: s.know[m.id] >= 2 ? `You get a real read on them: ${TRAIT_LABEL[m.t.label]}. ${TRAIT_DESC[m.t.label]}` : "A friendly first conversation. You'll need more time to really know them.", tone: "good" };
  }
  if (act === "funds") { const amt = Math.round((40 + s.profile * 0.9 + you.seniority * 2 + r() * 50) * (you.chair ? 1.4 : 1)); s.cash += amt; s.toast = { title: "Call time", text: `Four hours on the phone. You raised $${amt}K.`, tone: "good" }; }
  if (act === "district") { const g = (1.2 + r() * 1.3) * clamp(1 - (s.approval - 45) / 30, 0.1, 1); /* each visit matters less once people already like you */ s.approval = clamp(s.approval + g, 5, 95); s.baseApproval = clamp(s.baseApproval + g * 0.5, 5, 95); s.toast = { title: "Back home", text: `Town halls and ribbon cuttings. Approval at home is up ${g.toFixed(1)} points.`, tone: "good" }; }
  if (act === "tv") {
    const gaffe = r() < 0.08;
    s.profile = clamp(s.profile + (gaffe ? 1 : 2.5), 0, 100);
    if (gaffe) { s.approval -= 2; s.toast = { title: "A bad clip", text: "One answer came out wrong and it's all over social media. Approval at home is down 2.", tone: "bad" }; }
    else { s.baseApproval = clamp(s.baseApproval + 0.8, 5, 95); s.toast = { title: "On the air", text: "A solid hit. Your national profile and your standing with the base tick up.", tone: "good" }; }
  }
  if (act === "committee") { s.legis += 1; s.clout += 0.6; for (const b of s.bills) if (b.sponsor === s.youId && b.stage === "committee") b.floorWeek = Math.max(s.week + 1, b.floorWeek - 1); s.toast = { title: "Committee work", text: "Markups and hearings. Colleagues notice who does the reading. Any bill of yours moves a week closer to the floor.", tone: "good" }; }
  if (act === "cosponsor") {
    const b = s.bills.find((x) => x.id === arg.bill);
    if (b && !b.cos.includes(s.youId)) { s.flags.cos = true; b.cos.push(s.youId); s.rel[b.sponsor] = clamp((s.rel[b.sponsor] || 0) + 0.12, -1, 1); s.toast = { title: "Cosponsored", text: `Your name is on ${byId[b.pid].name}. ${nameOf(memberById[b.sponsor])} appreciates it.`, tone: "good" }; }
  }
  if (act === "introduce") {
    const b = addBill(s, arg.pid, s.youId, 5 + Math.round(4 * (1 - clamp(s.clout / 100, 0, 1))));
    if (b) { s.legis += 2; pushNews(s, `${titleOf(you)} ${nameOf(you)} introduces ${byId[arg.pid].name}.`); s.toast = { title: "Bill introduced", text: `${byId[arg.pid].name} is in committee. Leadership decides if it reaches the floor; your clout and committee work speed it up.`, tone: "good" }; }
    else s.hours += ACTIONS.introduce.hours;
  }
  if (act === "wh") {
    const b = s.bills.find((x) => x.id === arg.bill), info = billInfo(b.pid, b.party);
    const firm = Math.abs(PRESIDENT_STANCE[b.pid] ?? 0);                    // he barely moves where he has a fixed view
    const odds = clamp(0.25 + s.clout / 250 + s.profile / 300 + 0.3 * s.rapport + (you.p === "R" ? 0.2 : 0) - 0.25 * firm, 0.05, 0.85);
    const x = r();
    if (x < odds * 0.5) { b.wh = (b.wh || 0) + 0.3 * (1 - 0.7 * firm); s.rapport = clamp(s.rapport + 0.2, -1, 1); s.toast = { title: "The President is charmed", text: `The meeting runs long. He tells reporters ${byId[b.pid].name} "could be a very good bill."`, tone: "good" }; }
    else if (x < odds) { b.wh = (b.wh || 0) + 0.15 * (1 - 0.7 * firm); s.rapport = clamp(s.rapport + 0.08, -1, 1); s.toast = { title: "He's open to it", text: "No commitment, but his staff says he is listening.", tone: "good" }; }
    else if (x < odds + (1 - odds) * 0.7) s.toast = { title: "No commitment", text: you.p === "D" ? "You get fifteen minutes with a deputy. Building a name in Washington would get you further." : "He talks about other things. You leave with a photo.", tone: "" };
    else { b.wh = (b.wh || 0) - 0.1; s.rapport = clamp(s.rapport - 0.15, -1, 1); pushNews(s, `The President attacks ${byId[b.pid].name} after a meeting with ${nameOf(you)}.`, "bad"); s.toast = { title: "It blew up", text: "He posts about the meeting that night. His allies in Congress take note.", tone: "bad" }; }
    void info;
  }
  if (act === "hire") {
    const i = s.staff.findIndex((x) => x.role === arg.role), old = s.staff[i], cost = hireCost(old);
    if (s.cash < cost) { s.hours += ACTIONS.hire.hours; s.toast = { title: "Not enough money", text: `A better ${old.title.toLowerCase()} costs about $${cost}K a year.`, tone: "bad" }; return s; }
    const first = PF[Math.floor(r() * PF.length)], last = PL[Math.floor(r() * PL.length)];
    s.staff[i] = { ...old, first, last, name: `${first} ${last}`, skill: Math.min(20, old.skill + 2 + Math.floor(r() * 4)), loyalty: 8 + Math.floor(r() * 8), exp: 4 + Math.floor(r() * 14) };
    s.cash -= cost; for (const x of s.staff) if (x.role !== arg.role) x.loyalty = Math.max(1, x.loyalty - 1);
    s.toast = { title: `New ${old.title.toLowerCase()}`, text: `${old.name} is out; ${first} ${last} is in. Better at the job. The rest of the staff noticed how fast it happened.`, tone: "good" };
  }
  if (act === "rider" || act === "strip") {
    const mp = s.mp.find((x) => x.id === arg.mp), role = roleOf(s);
    const odds = clamp((role === "P" ? 0.45 + (s.presApproval - 40) / 60 : (you.p === "D" ? 0.45 : 0.15) + s.clout / 200 + (onComm(you, "HSAP") || onComm(you, "SSAP") ? 0.2 : 0)), 0.05, 0.9);
    if (r() < odds) {
      if (act === "rider") { mp.riders.push({ pid: arg.pid, p: role === "P" ? "R" : you.p, by: role === "P" ? "the President" : nameOf(you), you: true }); s.profile = clamp(s.profile + 2, 0, 100); s.baseApproval = clamp(s.baseApproval + 1.5, 5, 99); pushNews(s, `${role === "P" ? "The President" : nameOf(you)} gets ${byId[arg.pid].name} attached to ${mp.name.toLowerCase()}.`); s.toast = { title: "Rider attached", text: `${byId[arg.pid].name} now rides on ${mp.name.toLowerCase()}. Watch the Senate count: every rider costs votes on the other side.`, tone: "good" }; }
      else { const x = mp.riders.splice(mp.riders.findIndex((y) => y.pid === arg.pid), 1)[0]; pushNews(s, `${byId[x.pid].name} comes off ${mp.name.toLowerCase()}.`); s.toast = { title: "Rider stripped", text: `${byId[x.pid].name} is out. ${x.p === (role === "P" ? "R" : you.p) ? "Your own side is annoyed." : "The other side is furious."}`, tone: "good" }; if (role !== "P" && x.p === you.p) s.loyalty -= 1; }
    } else s.toast = { title: "Leadership said no", text: act === "rider" ? "The appropriators wouldn't take it. Build clout, or get a seat on Appropriations." : "The rider stays. Its backers had the votes in the room.", tone: "" };
  }
  if (act === "hold") {
    const b = s.bills.find((x) => x.id === arg.bill);
    b.floorWeek += 3; b.holds = (b.holds || 0) + 1; s.rel[b.sponsor] = clamp((s.rel[b.sponsor] || 0) - 0.15, -1, 1); s.profile = clamp(s.profile + 1.5, 0, 100);
    if (b.party === you.p) s.loyalty -= 1.5;
    pushNews(s, `${titleOf(you)} ${nameOf(you)} places a hold on ${byId[b.pid].name}.`);
    s.toast = { title: "Hold placed", text: `${byId[b.pid].name} is stuck for at least three more weeks. ${nameOf(memberById[b.sponsor])} knows it was you.`, tone: "" };
  }
  if (act === "filibuster") {
    const b = s.bills.find((x) => x.id === arg.bill);
    if (b.route === "reconciliation") { s.hours += ACTIONS.filibuster.hours; s.toast = { title: "Can't filibuster this", text: "It's moving under reconciliation: 51 votes, no filibuster.", tone: "bad" }; return s; }
    const hrs = Math.round(8 + r() * 14);
    b.fil = { p: you.p, w: 0.06 + s.profile / 1500 + s.clout / 3000 }; s.profile = clamp(s.profile + 6, 0, 100); s.baseApproval = clamp(s.baseApproval + 3, 5, 95);
    if (b.party === you.p) s.loyalty -= 3;
    pushNews(s, `${titleOf(you)} ${nameOf(you)} holds the Senate floor for ${hrs} hours against ${byId[b.pid].name}.`, "event");
    s.toast = { title: `${hrs} hours on your feet`, text: "Cable carries it live. Your side rallies; colleagues in your party feel the pressure to hold the line on cloture.", tone: "good" };
  }
  if (act === "hearing" || act === "defend") {
    const c = s.cab.find((x) => x.id === arg.id);
    if (act === "hearing") {
      const onPanel = (you.comm || []).some((k) => /Oversight|Judiciary|Armed|Homeland|Intelligence|Foreign|Energy|Health|Finance|Ways/i.test(k.n));
      c.heat = clamp(c.heat + 0.07 + s.profile / 1200 + (onPanel ? 0.04 : 0) + r() * 0.04, 0, 1); s.profile = clamp(s.profile + 3, 0, 100);
      s.rapport = clamp(s.rapport - 0.12, -1, 1); s.presHeat = clamp(s.presHeat + 0.015, 0, 1);
      s.baseApproval = clamp(s.baseApproval + (you.p === "D" ? 1.5 : -2.5), 5, 95);
      pushNews(s, `${nameOf(you)} grills ${cabName(c)} at an oversight hearing.`, "event");
      s.toast = { title: "Under oath", text: `${cabName(c)} stumbles through two answers. The clip runs all night.${onPanel ? " Your committee seat gave you the gavel time." : ""}`, tone: "good" };
    } else {
      c.heat = clamp(c.heat - 0.05, 0, 1); s.rapport = clamp(s.rapport + 0.12, -1, 1);
      s.baseApproval = clamp(s.baseApproval + (you.p === "R" ? 1 : -3), 5, 95); s.approval = clamp(s.approval - (you.vuln > 0.6 ? 1 : 0), 5, 95);
      s.toast = { title: "On TV for the team", text: `You defend ${cabName(c)} on three networks. The White House notices.`, tone: "good" };
    }
  }
  if (act === "call" || act === "push" || act === "threat" || act === "eo" || act === "rally" || act === "fire" || act === "sign" || act === "veto") presAction(s, act, arg, r);
  if (act === "whip") {
    const b = s.bills.find((x) => x.id === arg.bill), m = memberById[arg.id];
    const l = lean(m, b.pid, billCtx(s, b));
    b.asked[m.id] = true; s.flags.whipped = true;
    if (arg.favor && (s.owedToYou[m.id] || 0) > 0) {
      s.owedToYou[m.id]--; b.deals[m.id] = (b.deals[m.id] || 0) + 0.6;
      s.toast = { title: "Favor called in", text: `${nameOf(m)} owed you one. "Fine. We're even." They'll vote your way unless it would end their career.`, tone: "good" };
    } else {
      const rel = s.rel[m.id] || 0;
      const odds = clamp(0.3 + 0.5 * rel + (m.t.label === "dealmaker" ? 0.15 : 0) + (m.t.label === "believer" ? -0.2 : 0) + (m.t.label === "vain" ? s.profile / 300 : 0) + s.clout / 400 - Math.abs(l.L) * 0.8, 0.04, 0.9);
      if (r() < odds) {
        b.deals[m.id] = (b.deals[m.id] || 0) + 0.3;
        let ask = "";
        if (m.t.label === "dealmaker" || r() < 0.4) {
          const want = wantOf(s, m, r);
          if (want) { s.youOwe.push({ id: `f${s.week}${s.youOwe.length}`, to: m.id, pid: want, due: Math.min(s.week + 14, (s.termStart || 0) + ELECTION_WEEK - 2), status: "open", why: byId[b.pid].name }); ask = ` In return they want your vote for ${byId[want].name} when it comes up.`; }
        }
        s.toast = { title: "They're with you", text: `${nameOf(m)} moves toward your side on ${byId[b.pid].name}.${ask}`, tone: "good" };
      } else if (r() < 0.15 && m.t.ethics < 0.4) {
        s.rel[m.id] = rel - 0.1; s.approval -= 1; pushNews(s, `A member tells reporters about pressure from ${nameOf(you)} on ${byId[b.pid].name}.`, "bad");
        s.toast = { title: "It leaked", text: `${nameOf(m)} told a reporter about your pitch. It reads badly back home.`, tone: "bad" };
      } else s.toast = { title: "No sale", text: `${nameOf(m)} hears you out and doesn't move. ${rel < 0.2 ? "You barely know each other." : "Not on this one."}`, tone: "" };
    }
  }
  return s;
}
function wantOf(s, m, r) {
  const opts = POLICIES.filter((p) => !s.laws.includes(p.id) && p.route !== "amendment" && conviction(m, billInfo(p.id, m.p)) > 0.35 && !s.youOwe.some((f) => f.pid === p.id && f.status === "open"));
  return opts.length ? opts[Math.floor(r() * opts.length)].id : null;
}

// ── Inbox choices ──
export function answer(s0, msgId, choice) {
  const s = structuredClone(s0);
  const m = s.inbox.find((x) => x.id === msgId);
  if (!m || m.done) return s;
  m.done = true; m.choice = choice;
  const you = memberById[s.youId];
  if (m.kind === "lead") leaderRace(s, choice, m.comm);
  if (m.kind === "higher" && choice === 0) { const seat = memberById[m.seat]; s.runFor = m.seat; s.runForDem = seat.dem; s.runForCls = seat.cls; pushNews(s, `${nameOf(you)} announces a run for the Senate in ${you.st}.`, "event"); s.toast = { title: "You're running statewide", text: `The race is in November ${electionYear(s)}. Your House seat goes to someone else either way. Statewide approval, money and the national mood decide it.`, tone: "good" }; }
  if (m.kind === "markup") { const b = s.bills.find((x) => x.id === m.bill); const opts = m.oppose ? ["pill", "fix", "district", null] : ["fix", "district", "sweet", null]; if (b && !b.dead && opts[choice]) { b.amends = b.amends || []; const ok = offerAmend(s, b, opts[choice]); s.toast = { title: ok ? "Amendment adopted" : "Amendment rejected", text: ok ? `Your ${AMEND[opts[choice]].label} is in the bill.` : "The committee voted it down. You still get your markup vote.", tone: ok ? "good" : "" }; } }
  if (m.kind === "mpdesk") { const mp = s.mp.find((x) => x.id === m.mp); if (mp && mp.stage === "desk") { if (choice === 0) { mpSettle(s, mp, true); s.legacy += 1; } else { mp.blame = "pres"; s.vetoes++; const oh = mpVote(s, mp, "H", true), os = mpVote(s, mp, "S", true); const ov = oh.yes >= 290 && os.yes >= 67; mp.hist.push(`You veto it. Override: House ${oh.yes}, Senate ${os.yes}`); if (ov) { s.presApproval -= 1.5; s.clout -= 6; pushNews(s, `Congress overrides your veto of ${mp.name.toLowerCase()}.`, "bad"); } mpSettle(s, mp, ov); } } }
  if (m.kind === "confirm") { const n = s.noms.find((x) => x.id === m.nom); if (n) n.yourVote = choice === 0; }
  if (m.kind === "impeach") { const i = s.imp.find((x) => x.id === m.imp); if (i) i.yourVote = choice === 0; }
  if (m.kind === "nominate") { const c = s.cab.find((x) => x.id === m.post); if (c?.vacant && m.picks[choice]) nominate(s, c, m.picks[choice]); }
  if (m.kind === "pask") { if (choice === 0) { s.rel[m.who] = clamp((s.rel[m.who] || 0) + 0.25, -1, 1); s.owedToYou[m.who] = (s.owedToYou[m.who] || 0) + 1; s.clout -= 1; s.hours = Math.max(0, s.hours - 3); } else s.rel[m.who] = clamp((s.rel[m.who] || 0) - 0.1, -1, 1); }
  if (m.kind === "ask") {
    if (choice === 0) { s.rel[m.who] = clamp((s.rel[m.who] || 0) + 0.15, -1, 1); s.owedToYou[m.who] = (s.owedToYou[m.who] || 0) + 1; s.promises.push({ bill: m.bill, to: m.who, vote: true }); const b = s.bills.find((x) => x.id === m.bill); if (b) b.yourVote = true; }
    else s.rel[m.who] = clamp((s.rel[m.who] || 0) - 0.08, -1, 1);
  }
  if (m.kind === "group") {
    if (choice === 0) { s.cash += m.amount; s.tookMoney += m.amount; s.integrity -= 4; s.promises.push({ pid: m.pid, group: m.group, vote: m.want }); if (m.gid) gstate(s, m.gid).money += m.amount; }
    else { s.integrity += 2; s.baseApproval = clamp(s.baseApproval + 0.5, 5, 95); }
  }
  if (m.kind === "leader") { if (choice === 0) { s.loyalty += 1; const b = s.bills.find((x) => x.id === m.bill); if (b) b.yourVote = m.want; } }
  if (m.kind === "event") {
    if (choice === 0) { const gaffe = noise(`${s.seed}:ev:${m.id}`) > 0.8; s.profile = clamp(s.profile + 3, 0, 100); s.hours = Math.max(0, s.hours - 3); if (gaffe) { s.approval = clamp(s.approval - 2, 5, 95); s.toast = { title: "It came out wrong", text: "You got the airtime, and one line is being clipped out of context. Approval at home slips.", tone: "bad" }; } else { s.baseApproval = clamp(s.baseApproval + 1.5, 5, 95); s.toast = { title: "You led the coverage", text: "Your profile rises and your base liked what it heard. It cost you 3 hours.", tone: "good" }; } }
    else if (choice === 1) s.approval = clamp(s.approval + 0.5, 5, 95);
    else s.baseApproval = clamp(s.baseApproval - 0.8, 5, 95);
  }
  if (m.kind === "ethics") {
    if (choice === 0) { s.hours = Math.max(0, s.hours - 10); s.cash = Math.max(0, s.cash - 150); s.toast = { title: "You fight it", text: "Lawyers, documents, interviews. The complaint is dismissed after a few weeks, and the story fades.", tone: "good" }; }
    else if (choice === 1) { s.approval = clamp(s.approval - 5, 5, 95); s.integrity -= 8; s.moments.push({ week: s.week, text: "You ignored an ethics complaint and it stuck to you." }); s.toast = { title: "The story runs", text: "With no answer from you, the local paper runs it three days in a row. Approval at home drops 5.", tone: "bad" }; }
    else { const back = Math.min(s.cash, Math.round(s.tookMoney * 0.5)); s.cash -= back; s.tookMoney -= back; s.integrity += 10; s.approval = clamp(s.approval + 1, 5, 95); s.toast = { title: "You give it back", text: `You return $${back}K and say you got it wrong. Donors are annoyed; voters mostly respect it.`, tone: "good" }; }
  }
  if (m.kind === "local") { if (choice === 0) { s.hours = Math.max(0, s.hours - 8); s.approval = clamp(s.approval + 3, 5, 95); } else s.approval = clamp(s.approval - 2, 5, 95); }
  if (m.kind === "vote") { const b = s.bills.find((x) => x.id === m.bill); if (b) b.yourVote = choice === 0; }
  void you;
  return s;
}
export function setVote(s0, billId, v) { const s = structuredClone(s0); const b = s.bills.find((x) => x.id === billId); if (b) b.yourVote = v; return s; }

// ── The week ──
export function advance(s0) {
  let s = structuredClone(s0);
  if (s.over) return s;
  const you = memberById[s.youId];
  const events = [];
  // 0. Bills left on the President's desk: decided by instinct.
  for (const b of s.bills) if (b.stage === "desk") events.push(...desk(s, b, presView(s, b).signs, { bill: b.id, pid: b.pid, auto: true, stages: [] }));
  // 0b. Committees mark up what's due; must-pass deadlines.
  committeeWeek(s, R(s, "comm"));
  mpWeek(s, R(s, "mp"));
  // 1. Floor votes scheduled for this week.
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee" || b.floorWeek > s.week || !b.marked) continue;
    events.push(...floor(s, b));
  }
  // 2. Favors that came due.
  for (const f of s.youOwe) {
    if (f.status !== "open") continue;
    const cast = s.votesCast.find((v) => v.pid === f.pid);
    if (cast) { f.status = cast.vote ? "kept" : "broken"; }
    else if (s.week >= f.due) f.status = "expired";
    if (f.status === "kept") { s.rel[f.to] = clamp((s.rel[f.to] || 0) + 0.2, -1, 1); s.integrity += 2; s.clout += 1; }
    if (f.status === "broken") { const m = memberById[f.to]; s.rel[f.to] = clamp((s.rel[f.to] || 0) - (m.t.label === "grudge" ? 0.6 : 0.3), -1, 1); s.integrity -= 6; s.clout -= 2; pushNews(s, `${nameOf(m)} says ${nameOf(you)} broke a promise on ${byId[f.pid].name}.`, "bad"); }
  }
  s.week++; s.hours = HOURS;
  const r = R(s, "week");
  // 3. The world moves.
  if (s.week % 4 === 0) {
    s.econ.growth = clamp(s.econ.growth + (r() - 0.5) * 0.8, -2.5, 4); s.econ.inflation = clamp(s.econ.inflation + (r() - 0.52) * 0.5, 1, 7); s.econ.jobs = clamp(s.econ.jobs + (r() - 0.5) * 0.3 - (s.econ.growth - 1.5) * 0.05, 3.2, 8);
    s.presApproval = clamp(s.presApproval + (s.econ.growth - 1.5) * 0.6 - (s.econ.inflation - 3) * 0.8 + (r() - 0.5) * 2, 28, 55);
    // The generic ballot (mood: + = Democrats ahead, in points) tracks the President's popularity: voters punish the party in the White House when he is unpopular, plus a small out-party edge. It moves a tenth of the way to that target each month, so shocks fade.
    s.mood = clamp(s.mood + (moodTarget(s) - s.mood) * 0.12 + (r() - 0.5) * 0.8, -12, 12);
    if (r() < 0.5) pushNews(s, `Economy: growth ${s.econ.growth.toFixed(1)}%, inflation ${s.econ.inflation.toFixed(1)}%, unemployment ${s.econ.jobs.toFixed(1)}%. The President's approval is ${Math.round(s.presApproval)}%.`);
  }
  if (roleOf(s) === "P") s.approval = s.presApproval;
  else s.approval = clamp(s.approval + (50 + (you.own - 50) * 0.5 - s.approval) * 0.02, 5, 95);  // drifts back toward the seat's natural level
  // 4. Other members act: new bills, leadership scheduling.
  if (r() < 0.55) {
    const party = r() < 0.72 ? "D" : "R";
    const pool = party === "D" ? AGENDA_D.filter((p) => byId[p]) : POLICIES.filter((p) => (PRESIDENT_STANCE[p.id] || 0) > 0.4).map((p) => p.id);
    const pid = pool.find((p) => !s.bills.some((b) => b.pid === p && !b.dead) && !s.laws.includes(p)) || null;
    if (pid) { const b = addBill(s, pid, pickSponsor(s, pid, party, r, r() < (roleOf(s) === "S" ? 0.45 : 0.15) ? "S" : "H"), party === "D" ? 2 + Math.floor(r() * 4) : 6 + Math.floor(r() * 8)); if (b) pushNews(s, `${titleOf(memberById[b.sponsor])} ${nameOf(memberById[b.sponsor])} (${b.party}) introduces ${byId[pid].name}.`); }
  }
  // 4b. Events in the wider world, and characters acting on their own.
  for (const k in s.boost) { s.boost[k] *= 0.8; if (Math.abs(s.boost[k]) < 0.02) delete s.boost[k]; }
  worldEvent(s, r);
  execTick(s, r);
  if (roleOf(s) === "P") presWeek(s, r);
  else { others(s, r); whiteHouse(s, r); staffNotes(s, r); }
  (s.trend = s.trend || []).push({ w: s.week, a: Math.round(s.approval), b: Math.round(s.baseApproval), p: Math.round(s.presApproval), m: Math.round(s.mood * 10) / 10 });
  // 5. Your inbox.
  if (roleOf(s) !== "P") inbox(s, r);
  sceneWeek(s, R(s, "scene"));
  // 6. Primary and general.
  const rw = s.week - (s.termStart || 0);
  if (roleOf(s) === "P") { if (rw >= ELECTION_WEEK && !s.over) presVerdict(s, r); }
  else if (!upThisTerm(s, you) && !s.runFor) { if (rw >= ELECTION_WEEK && !s.over) termReview(s, r); }
  else { if (rw === PRIMARY_WEEK) primary(s, r); if (rw >= ELECTION_WEEK && !s.over) { if (s.runFor) runHigher(s, r); else general(s, r); } }
  s.events = events;
  return s;
}

function floor(s, b) {
  const role = roleOf(s), you = memberById[s.youId], p = byId[b.pid], info = billInfo(b.pid, b.party);
  const out = [], first = b.origin === "S" ? "S" : "H", second = first === "H" ? "S" : "H";
  // The majority only schedules what it wants; a minority bill needs real support to reach the floor.
  const ctx = billCtx(s, b);
  if (b.party === "R") {
    const pool = first === "H" ? HOUSE : SENATE, need = first === "H" ? 218 : 51;
    const support = pool.filter((m) => lean(m, b.pid, ctx).p > 0.5).length;
    if (support < need) { b.dead = true; b.stage = "died"; b.hist.push("Never scheduled: the majority would not bring it up."); pushNews(s, `${p.name} dies in committee. Democratic leaders won't schedule it.`); return out; }
  }
  if (info.reconcilable && b.party === "D" && !info.mustPass && !s.reconUsed[dateOf(s.week).getUTCFullYear()] && !info.bipartisan) { b.route = "reconciliation"; s.reconUsed[dateOf(s.week).getUTCFullYear()] = b.id; }
  const c2 = billCtx(s, b);
  // Your vote (members only): your choice, or your staff's call if you left it blank.
  const mine = role !== "P" ? lean(you, b.pid, c2) : null;
  const yv = role !== "P" ? b.yourVote ?? mine.L > 0 : null;
  const forced = role !== "P" ? { [s.youId]: yv } : {};
  const needOf = (ch) => (ch === "H" ? (info.amendment ? NEED.H.amendment : NEED.H.passage) : info.amendment ? NEED.S.amendment : b.route === "reconciliation" ? NEED.S.reconciliation : NEED.S.passage);
  const ev = { bill: b.id, pid: b.pid, yourVote: yv, auto: b.yourVote === null, stages: [], first };
  if (role !== "P") cast(s, b, yv, mine);
  for (const ch of [first, second]) {
    const rc = rollCall(ch, b.pid, c2, forced), need = needOf(ch);
    if (ch === "H") { ev.house = rc; ev.needH = need; } else { ev.senate = rc; ev.needS = need; }
    b.hist.push(ch === "H" ? `House: ${rc.yes}-${rc.no}` : `Senate: ${rc.yes}-${rc.no} (${need} needed)`);
    if (rc.yes < need) {
      b.dead = true; b.stage = "failed"; ev.result = ch === "S" && need === 60 ? "filibustered" : ch === "H" ? "failed-house" : "failed-senate";
      pushNews(s, ch === "S" && need === 60 ? `${p.name} is filibustered in the Senate, ${rc.yes}-${rc.no}.${b.fil ? " The talking filibuster held." : ""}` : `${p.name} fails in the ${ch === "H" ? "House" : "Senate"}, ${rc.yes}-${rc.no}.`, "bad");
      out.push(ev); settle(s, b, false); return out;
    }
  }
  if (info.amendment) { b.stage = "law"; ev.result = "states"; out.push(ev); return out; }
  // You are the President: it lands on your desk and waits for you.
  if (role === "P" && !info.mustPass) { b.stage = "desk"; b.deskWeek = s.week; ev.result = "desk"; out.push(ev);
    pushInbox(s, { kind: "staff", from: "Staff secretary", title: `On your desk: ${p.name}`, body: `It passed the House ${ev.house.yes}-${ev.house.no} and the Senate ${ev.senate.yes}-${ev.senate.no}. Sign it or veto it from the Bills tab before the week ends, or the decision defaults to your instinct.` });
    return out; }
  out.push(...desk(s, b, presView(s, b).signs, ev, forced));
  return out;
}
// Sign or veto. A veto goes to an override round where some of his party won't defy him twice.
function desk(s, b, signs, ev, forced = {}) {
  const p = byId[b.pid], out = [];
  ev.signs = signs;
  const tally = `${ev.house?.yes ?? "?"}-${ev.house?.no ?? "?"} and ${ev.senate?.yes ?? "?"}-${ev.senate?.no ?? "?"}`;
  if (signs) { enact(s, b); ev.result = "signed"; pushNews(s, `The President signs ${p.name}. Passed ${tally}.`, "good"); out.push(ev); settle(s, b, true); return out; }
  const oc = billCtx(s, b, "override");
  const oh = rollCall("H", b.pid, oc, forced), os = rollCall("S", b.pid, oc, forced);
  ev.over = { house: oh, senate: os };
  b.hist.push(`Vetoed. Override: House ${oh.yes}, Senate ${os.yes}`);
  if (oh.yes >= NEED.H.override && os.yes >= NEED.S.override) { enact(s, b); ev.result = "overridden"; pushNews(s, `Congress overrides the President's veto of ${p.name}.`, "good"); settle(s, b, true); if (roleOf(s) === "P") { s.presApproval -= 1.5; s.clout -= 6; } }
  else { b.dead = true; b.stage = "vetoed"; ev.result = "vetoed"; pushNews(s, `The President vetoes ${p.name}. The override falls short (${oh.yes} House, ${os.yes} Senate).`, "bad"); settle(s, b, false); }
  out.push(ev);
  return out;
}
function enact(s, b) { b.stage = "law"; s.laws.push(b.pid); if (b.sponsor === s.youId) { s.legis += 12; s.clout += 6; s.profile += 5; } else if (b.cos.includes(s.youId)) s.legis += 2; }
function settle(s, b, passed) { if (b.sponsor === s.youId && !passed) s.clout -= 1; const whipped = Object.keys(b.deals).length; if (whipped && passed) s.clout += Math.min(4, whipped); }
// How your own vote lands at home, with the base, and with your leaders.
function cast(s, b, yv, mine) {
  const you = memberById[s.youId], info = billInfo(b.pid, b.party), sign = yv ? 1 : -1;
  const d = mine.raw.D * sign * 3.2 * info.sal, pb = mine.raw.P * sign * 3.2 * info.sal;
  s.approval = clamp(s.approval + d, 5, 95); s.baseApproval = clamp(s.baseApproval + pb, 5, 95);
  const partyLine = (you.p === b.party) === yv || info.bipartisan;
  if (!partyLine) { s.loyalty -= 1; s.clout -= 0.5; }
  s.votesCast.push({ week: s.week, pid: b.pid, vote: yv, d, pb, partyLine });
  for (const g of IGROUPS) { const st = g.cares[b.pid]; if (!st) continue; const gs = gstate(s, g.id); gs.votes++; gs.score = clamp(gs.score + (st > 0 === yv ? 14 : -14), -100, 100); }
  for (const pr of s.promises) {
    if (pr.done) continue;
    if (pr.bill === b.id) { pr.done = true; if (pr.vote !== yv) { pr.broken = true; s.moments.push({ week: s.week, text: `You broke your word to ${nameOf(memberById[pr.to])} on ${byId[b.pid].name}.` }); s.rel[pr.to] = clamp((s.rel[pr.to] || 0) - 0.35, -1, 1); s.integrity -= 6; s.owedToYou[pr.to] = Math.max(0, (s.owedToYou[pr.to] || 0) - 1); pushNews(s, `${nameOf(memberById[pr.to])} is furious: ${nameOf(you)} promised a yes and voted no.`, "bad"); } }
    if (pr.pid === b.pid && pr.group) { pr.done = true; if (pr.vote !== yv) { s.integrity -= 3; pushNews(s, `${pr.group} says ${nameOf(you)} took its money and voted the other way.`, "bad"); } else { s.approval -= 1.5; pushNews(s, `Opponents note ${nameOf(you)} voted with ${pr.group} after taking its money.`, "bad"); } }
  }
}

function inbox(s, r) {
  const you = memberById[s.youId];
  // Votes coming to the floor in the next week: your staff's read.
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee" || b.floorWeek !== s.week || b.flagged) continue;
    b.flagged = true;
    const mine = lean(you, b.pid, billCtx(s, b));
    const dz = mine.raw.D, pz = mine.raw.P;
    pushInbox(s, { kind: "vote", bill: b.id, from: "Your legislative director", title: `On the floor this week: ${byId[b.pid].name}`,
      body: `${byId[b.pid].desc} At home: ${dz > 0.15 ? "popular" : dz < -0.15 ? "unpopular" : "mixed"}. With your primary voters: ${pz > 0.15 ? "popular" : pz < -0.15 ? "unpopular" : "mixed"}. ${(you.p === b.party) ? "Your leaders want a yes." : billInfo(b.pid, b.party).bipartisan ? "Both parties wrote it; you're free to vote your district." : "Your leaders want a no."}`,
      choices: ["Vote yes", "Vote no"] });
    if (you.p === b.party && r() < 0.45 && !billInfo(b.pid, b.party).bipartisan) pushInbox(s, { kind: "leader", bill: b.id, want: true, from: "The whip's office", title: `Leadership is counting on you: ${byId[b.pid].name}`, body: "This is a party priority. A yes is noted. A no is noted too, and it affects committee assignments.", choices: ["Commit to yes", "Make no promise"] });
  }
  if (r() < 0.45) {
    const pool = activeBills(s).filter((b) => b.stage === "committee" && b.sponsor !== s.youId && b.floorWeek > s.week && !s.inbox.some((m) => m.kind === "ask" && m.bill === b.id));
    if (pool.length) { const b = pool[Math.floor(r() * pool.length)], m = memberById[b.sponsor];
      pushInbox(s, { kind: "ask", bill: b.id, who: m.id, from: `${titleOf(m)} ${nameOf(m)}`, title: `Can I count on you for ${byId[b.pid].name}?`, body: `"I need your vote when this hits the floor. I won't forget it." Saying yes is a promise: they'll owe you a favor, and breaking it costs you.`, choices: ["Promise a yes", "Decline"] }); }
  }
  if (r() < 0.22) {
    const opts = [];
    for (const g of IGROUPS) { if (dependence(you, g, noise) < 0.15 && g.party !== "any") continue; if (s.promises.some((p) => p.group === g.name && !p.done)) continue;
      for (const [pid, st] of Object.entries(g.cares)) if (byId[pid] && !s.laws.includes(pid) && s.bills.some((b) => b.pid === pid && !b.dead && b.stage === "committee")) opts.push({ g, pid, want: st > 0 }); }
    if (opts.length) { const o = opts[Math.floor(r() * opts.length)], amount = Math.round(o.g.budget * (0.2 + r() * 0.3));
      pushInbox(s, { kind: "group", group: o.g.name, gid: o.g.id, pid: o.pid, want: o.want, amount, from: o.g.name, title: `$${amount}K for your campaign`, body: `Their PAC will back you if you vote ${o.want ? "yes" : "no"} on ${byId[o.pid].name}. ${o.g.note} Taking it fills your war chest, ties you to them, and hands opponents an attack line.`, choices: [`Take the $${amount}K`, "Turn it down"] }); }
  }
  if (r() < 0.2) pushInbox(s, { kind: "local", from: "Your district director", title: ["A plant closing back home", "Flooding in the district", "The base hospital may close", "A local school board fight goes viral"][Math.floor(r() * 4)], body: "People want to see you. Going costs 8 hours this week; skipping it will be noticed.", choices: ["Go home (8 hours)", "Send a statement"] });
  if (r() < 0.12) {
    const m = HOUSE[Math.floor(r() * HOUSE.length)];
    if (m.id !== s.youId && (s.know[m.id] || 0) < 3) { s.know[m.id] = (s.know[m.id] || 0) + 1; pushInbox(s, { kind: "staff", from: "Your chief of staff", title: `What I'm hearing about ${nameOf(m)}`, body: `Staff talk. ${TRAIT_LABEL[m.t.label]}: ${TRAIT_DESC[m.t.label]}`, done: true }); }
  }
}

function primary(s, r) {
  const you = memberById[s.youId];
  const fit = 1 - Math.min(1, Math.abs(you.x - (you.p === "D" ? -0.42 : 0.52)) * 1.6);
  const gp = groupElection(s, "primary");
  const strength = s.baseApproval + fit * 8 + Math.min(10, s.cash / 400) - (you.prisk > 0.5 ? 6 : 0) + gp.net - (s.rivals || 0) * 3;
  s.primaryGroups = gp;
  const challenged = strength < 60 || r() < 0.2;
  // Incumbents almost always win primaries; you only lose if your own party's voters have really turned on you.
  const share = clamp(60 + (strength - 55) * 0.75 + (r() - 0.5) * 8, 20, 92);
  s.primary = { challenged, share: challenged ? Math.round(share * 10) / 10 : 100, won: !challenged || share > 50 };
  if (challenged) pushNews(s, `${nameOf(you)} ${s.primary.won ? "survives" : "loses"} a primary challenge with ${s.primary.share}% of the vote.`, s.primary.won ? "good" : "bad");
  if (!s.primary.won) { s.over = true; s.result = { kind: "primary", ...s.primary }; }
  else pushInbox(s, { kind: "staff", from: "Your campaign manager", title: challenged ? `You won the primary with ${s.primary.share}%` : "No primary challenger filed", body: "Now the general election. Approval at home, the national mood and your war chest decide it.", done: true });
}
function general(s, r) {
  const you = memberById[s.youId];
  const env = you.p === "D" ? s.mood : -s.mood;                       // national swing toward your party, in points
  const lean2 = (you.own - 50) * 2;                                   // the seat's 2024 margin for your party
  const gg = groupElection(s, "general");
  const margin = lean2 + env * 0.9 + 3 + (s.approval - 50) * 0.45 + Math.min(4, s.cash / 900) + gg.net * 0.5 + (r() - 0.5) * 5 + (s.debateBonus || 0);
  // The whole House moves with the mood.
  let d = 0; for (const m of HOUSE) { const mm = (m.dem - 50) * 2 + s.mood * 0.9 + (m.p === "D" ? 3 : -3) + noise(`${s.seed}:gen:${m.id}`) * 5; if (m.id === s.youId ? (you.p === "D" ? margin > 0 : margin <= 0) : mm > 0) d++; }
  s.over = true;
  s.result = { kind: "general", margin: Math.round(margin * 10) / 10, won: margin > 0, houseD: d, env: Math.round(env * 10) / 10, groups: gg };
  pushNews(s, `Election night: ${nameOf(you)} ${margin > 0 ? "wins" : "loses"} by ${Math.abs(s.result.margin)} points. Democrats hold ${d} House seats.`, margin > 0 ? "good" : "bad");
}

// ── Rankings: every House member, you included ──
export function rankings(s) {
  const sponsored = {};
  for (const b of s.bills) if (b.stage === "law") sponsored[b.sponsor] = (sponsored[b.sponsor] || 0) + 1;
  const rows = CH(s).map((m) => {
    const me = m.id === s.youId;
    const influence = me ? s.clout : m.base.influence + (sponsored[m.id] || 0) * 6;
    const legis = me ? s.legis : (sponsored[m.id] || 0) * 12 + Math.round(m.seniority * 0.4 + (m.chair ? 6 : 0));
    const pop = me ? s.approval : Math.round(50 + (m.own - 50) * 0.5 + noise(m.id + "pop") * 6);
    const cash = me ? s.cash : m.base.cash;
    const integrity = me ? s.integrity : Math.round(45 + m.t.ethics * 50);
    const profile = me ? s.profile : Math.round(5 + m.seniority * 1.2 + (m.lead?.length ? 50 : 0) + m.t.ego * 20);
    const score = Math.round(influence * 1.2 + legis * 1.5 + (pop - 40) * 0.8 + Math.min(40, cash / 60) + integrity * 0.3 + profile * 0.5);
    return { m, me, influence: Math.round(influence), legis: Math.round(legis), pop: Math.round(pop), cash: Math.round(cash), integrity: Math.round(integrity), profile: Math.round(profile), score };
  });
  const rank = (key) => { const sorted = [...rows].sort((a, b) => b[key] - a[key]); sorted.forEach((x, i) => (x["r_" + key] = i + 1)); };
  ["score", "influence", "legis", "pop", "cash", "integrity", "profile"].forEach(rank);
  return rows;
}

// ── A newcomer you create takes over a seat ──
export const BACKGROUNDS = {
  teacher: { label: "Teacher", note: "Trusted on schools; small donor base.", approval: 3, cash: -100 },
  veteran: { label: "Veteran", note: "Trusted on defense; tested on everything else.", approval: 2, profile: 4 },
  prosecutor: { label: "Prosecutor", note: "Tough-on-crime credibility; the left is wary.", approval: 1, base: -2, clout: 3 },
  business: { label: "Business owner", note: "Money and credibility with donors; 'out of touch' attacks.", cash: 600, approval: -2 },
  organizer: { label: "Union organizer", note: "Volunteers and base energy; business donors stay away.", base: 5, cash: -150 },
  doctor: { label: "Doctor", note: "Credibility on health care.", approval: 2, profile: 2 },
  legislator: { label: "State legislator", note: "Knows how the game is played.", clout: 6 },
};
export function applyCustom(c) {
  if (!c) return;
  const m = memberById[c.seat];
  if (!m) return;
  Object.assign(m, { first: c.first, last: c.last, sf: c.first, sl: c.last, p: c.p, x: c.x, gen: true, custom: true, since: 2027, comm: [], lead: [], born: c.born || 1985 });
  m.t = { ...m.t, label: c.trait || "dealmaker" };
  m.pmix = primaryMix(m.mix, m.p);
  m.own = m.p === "D" ? m.dem : 100 - m.dem;
  m.vuln = clamp(1 - (m.own - 49) / 14, 0.12, 1); m.prisk = clamp((m.own - 52) / 22, 0.08, 0.85);
  m.signer = false; m.seniority = 0; m.chair = null;
  m.faction = m.p === "D" ? (m.x < -0.4 ? "Progressive Caucus" : m.x > -0.1 ? "Blue Dog Coalition" : "New Democrat Coalition") : (m.x > 0.62 ? "Freedom Caucus" : m.x > 0.4 ? "Republican Study Committee" : "Main Street Caucus");
  m.caucus = [m.faction]; m.cauEst = false;
  m.base = { influence: 8, cash: 400 };
  for (const k in factionLine) delete factionLine[k];
}
export function startCustom(c, seed, diff) {
  resetWorld();
  applyCustom(c);
  const s = newCareer(c.seat, seed, null, diff);
  const b = BACKGROUNDS[c.background] || {};
  s.custom = c;
  s.approval += b.approval || 0; s.baseApproval += b.base || 0; s.cash = Math.max(50, 400 + (b.cash || 0)); s.profile += b.profile || 0; s.clout += b.clout || 0;
  return s;
}
// Where a member sits in their chamber, left to right, as a percentile.
export function leftRank(m) { const ms = (m.ch === "H" ? HOUSE : SENATE); return Math.round((ms.filter((o) => o.x < m.x).length / ms.length) * 100); }
// Seats in arcs, left to right.
export function seatsFor(total) {
  const rows = total > 200 ? 10 : 5;
  const radii = Array.from({ length: rows }, (_, i) => 0.42 + 0.58 * (i / (rows - 1)));
  const sumR = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((total * r) / sumR));
  counts[rows - 1] += total - counts.reduce((a, b) => a + b, 0);
  const seats = [];
  radii.forEach((r, i) => { for (let k = 0; k < counts[i]; k++) { const a = Math.PI * (1 - k / (counts[i] - 1)); seats.push({ a, x: r * Math.cos(a), y: r * Math.sin(a) }); } });
  seats.sort((p, q) => q.a - p.a);
  return { seats, dotR: (Math.PI * sumR) / total / 2.4 };
}
export const seated = (ch) => [...(ch === "H" ? HOUSE : SENATE)].sort((a, b) => (a.p === b.p ? a.x - b.x : a.p === "D" ? -1 : 1));

// ── Interest groups: your standing with each, and what they do at election time ──
function gstate(s, gid) { return (s.groups[gid] = s.groups[gid] || { score: 0, votes: 0, money: 0 }); }
export function groupStanding(s) {
  const you = memberById[s.youId];
  return IGROUPS.map((g) => ({ g, dep: dependence(you, g, noise), ...gstate(s, g.id) })).filter((x) => x.dep > 0.05 || x.money > 0).sort((a, b) => b.dep - a.dep);
}
// Points added to or taken from your primary or general, group by group.
export function groupElection(s, which) {
  const you = memberById[s.youId]; let net = 0; const list = [];
  for (const g of IGROUPS) {
    const gs = s.groups[g.id]; if (!gs || !gs.votes) continue;
    const dep = dependence(you, g, noise);
    const applies = which === "primary" ? g.tactic === "primary" && (g.party === "any" || g.party === you.p) : g.tactic !== "primary" || g.party === "any";
    if (!applies || dep < 0.1) continue;
    const pts = Math.round((gs.score / 100) * g.power * dep * (which === "primary" ? 14 : 6) * 10) / 10;
    if (Math.abs(pts) >= 0.3) { net += pts; list.push({ name: g.name, pts }); }
  }
  return { net: Math.round(net * 10) / 10, list: list.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)) };
}

// ── The wider world: generated events ──
const EVENTS = [
  { id: "shooting", p: 0.02, title: "A mass shooting dominates the news", news: "A mass shooting at a shopping center leaves the country shaken. Calls for action on guns grow.", boost: { background_checks: 0.12, red_flag: 0.1 }, bill: "background_checks", party: "D", mood: 0.3 },
  { id: "scandal", p: 0.02, title: "A stock-trading scandal hits Congress", news: "Reporters find that several members traded stocks ahead of a committee announcement.", boost: { stock_ban: 0.15, ethics: 0.08 }, bill: "stock_ban", party: "D" },
  { id: "escalation", p: 0.018, title: "The Iran war escalates", news: "A strike on U.S. forces brings calls for more troops, and for Congress to rein the war in.", boost: { iran_supp: 0.1, war_powers: 0.06 }, bill: "iran_supp", party: "R", pres: -2, mood: 0.4 },
  { id: "ceasefire", p: 0.012, title: "A ceasefire with Iran takes hold", news: "Mediators announce a ceasefire. Gas prices ease and the President takes a victory lap.", pres: 4, mood: -0.8, infl: -0.3 },
  { id: "gas", p: 0.02, title: "Gas prices spike", news: "An attack on Gulf shipping sends gas prices up sharply before the summer.", pres: -3, mood: 0.6, infl: 0.5, boost: { gas_tax: -0.1, carbon: -0.1 } },
  { id: "recession", p: 0.01, title: "The economy stalls", news: "Two weak jobs reports in a row. Economists start using the word recession.", growth: -1.6, jobs: 0.7, pres: -4, mood: 1 },
  { id: "boom", p: 0.012, title: "A surprisingly strong economy", news: "Hiring surges and inflation cools. The White House claims credit.", growth: 1, jobs: -0.3, infl: -0.3, pres: 3, mood: -0.7 },
  { id: "drug", p: 0.018, title: "A common drug's price triples", news: "A widely used medication triples in price overnight. Patients go on TV.", boost: { drug_neg: 0.14, pbm: 0.1 }, bill: "drug_neg", party: "D" },
  { id: "ai", p: 0.015, title: "AI layoffs make headlines", news: "A major employer replaces thousands of workers with AI systems.", boost: { ai_rules: 0.14, datacenter: 0.06 }, bill: "ai_rules", party: "D" },
  { id: "court", p: 0.012, title: "The Supreme Court strikes down a law", news: "The Court rules 6 to 3 against a federal program. Both parties promise to respond.", boost: { court_expansion: 0.05, voting_rights: 0.06 }, mood: 0.2 },
  { id: "pardons", p: 0.02, title: "The President issues blanket pardons", news: "The President signs preemptive pardons for dozens of current and former officials.", boost: { pardon_reform: 0.14 }, bill: "pardon_reform", party: "D", pres: -2, mood: 0.4 },
  { id: "border", p: 0.015, title: "A surge at the border", news: "Border crossings jump. Governors of both parties ask Washington for help.", boost: { deport: 0.1, immigration: -0.06, ice_limits: -0.08 }, bill: "deport", party: "R", mood: -0.4 },
  { id: "storm", p: 0.02, title: "A major hurricane hits the Gulf Coast", news: "Houston and the Louisiana coast take a direct hit. Disaster aid is on everyone's mind.", boost: { infrastructure: 0.08 }, pres: -1 },
  { id: "power", p: 0.015, title: "Power bills jump", news: "Utilities blame the cost of serving new data centers. Ratepayers are furious.", boost: { ratepayer: 0.15, datacenter: 0.08 }, bill: "ratepayer", party: "D" },
];
function worldEvent(s, r) {
  const t = TURB[s.diff?.world || "normal"];
  for (const e of EVENTS) {
    if (s.usedEvents.includes(e.id) || r() > e.p * t) continue;
    s.usedEvents.push(e.id);
    pushNews(s, e.news, "event");
    for (const [pid, v] of Object.entries(e.boost || {})) if (byId[pid]) s.boost[pid] = (s.boost[pid] || 0) + v;
    if (e.pres) s.presApproval = clamp(s.presApproval + e.pres, 25, 60);
    if (e.mood) s.mood = clamp(s.mood + e.mood, -8, 10);
    if (e.growth) s.econ.growth = clamp(s.econ.growth + e.growth, -3, 4.5);
    if (e.jobs) s.econ.jobs = clamp(s.econ.jobs + e.jobs, 3, 9);
    if (e.infl) s.econ.inflation = clamp(s.econ.inflation + e.infl, 1, 8);
    let added = null;
    if (e.bill && byId[e.bill]) added = addBill(s, e.bill, pickSponsor(s, e.bill, e.party, r), 2 + Math.floor(r() * 3));
    pushInbox(s, { kind: "event", ev: e.id, from: "Breaking news", title: e.title, body: `${e.news}${added ? ` ${nameOf(memberById[added.sponsor])} is rushing ${byId[e.bill].name} to the floor, and members feel the pressure.` : e.boost ? " Members feel the pressure on related bills for the next few weeks." : ""} Reporters want your reaction.`, choices: ["Get in front of the cameras", "Put out a careful statement", "Stay out of it"] });
    return;                                        // one big story a week at most
  }
}

// ── Other characters act on their own ──
function others(s, r) {
  const you = memberById[s.youId], t = TURB[s.diff?.world || "normal"];
  // Leadership rewards and punishes.
  if (s.loyalty <= -4 && !s.flags.punished) { s.flags.punished = true; s.clout = Math.max(0, s.clout - 5); for (const b of s.bills) if (b.sponsor === s.youId && b.stage === "committee") b.floorWeek += 6;
    pushInbox(s, { kind: "staff", from: "The leader's office", title: "A message from leadership", body: "You've voted against the party too often. Your bills go to the back of the line and your committee requests are on hold. You can earn your way back.", done: true }); pushNews(s, `${nameOf(you)} is in the doghouse with party leaders.`, "bad"); s.moments.push({ week: s.week, text: "Leadership punished you for breaking with the party." }); }
  if (s.loyalty >= 5 && !s.flags.rewarded) { s.flags.rewarded = true; s.clout += 5; pushInbox(s, { kind: "staff", from: "The leader's office", title: "Leadership has noticed", body: "You've been there on the hard votes. You get a better committee slot and your bills move faster.", done: true }); for (const b of s.bills) if (b.sponsor === s.youId && b.stage === "committee") b.floorWeek = Math.max(s.week + 1, b.floorWeek - 3); s.moments.push({ week: s.week, text: "Leadership rewarded your loyalty with a better committee slot." }); }
  // A burned colleague gets even.
  const burned = Object.entries(s.rel).filter(([id, v]) => v < -0.25 && memberById[id]?.ch === "H");
  if (burned.length && r() < 0.1 * t) {
    const [id] = burned[Math.floor(r() * burned.length)], m = memberById[id];
    const kind = m.p === you.p && r() < 0.5 ? "primary" : r() < 0.5 ? "leak" : "block";
    if (kind === "primary" && s.week - (s.termStart || 0) < PRIMARY_WEEK) { s.rivals = (s.rivals || 0) + 1; s.baseApproval = clamp(s.baseApproval - 2, 5, 95); pushNews(s, `${nameOf(m)} is quietly helping a primary challenger to ${nameOf(you)}, people close to both say.`, "bad"); s.moments.push({ week: s.week, text: `${nameOf(m)} backed a primary challenger against you.` }); }
    else if (kind === "leak") { s.approval = clamp(s.approval - 2, 5, 95); s.integrity -= 3; pushNews(s, `An unnamed colleague describes ${nameOf(you)} as "someone whose word means nothing." The quote travels.`, "bad"); s.moments.push({ week: s.week, text: `${nameOf(m)} trashed you to reporters.` }); }
    else { const mine = s.bills.find((b) => b.sponsor === s.youId && b.stage === "committee"); if (mine) { mine.floorWeek += 3; pushNews(s, `${nameOf(m)} puts a hold on ${byId[mine.pid].name}.`, "bad"); } }
    pushInbox(s, { kind: "staff", from: "Your chief of staff", title: `${nameOf(m)} is working against you`, body: "They haven't forgotten. Repairing it would take real time together, or a favor they want.", done: true });
  }
  // An ally helps without being asked.
  const allies = Object.entries(s.rel).filter(([id, v]) => v > 0.4 && memberById[id]?.ch === "H");
  if (allies.length && r() < 0.12) {
    const [id] = allies[Math.floor(r() * allies.length)], m = memberById[id];
    const mine = s.bills.find((b) => b.sponsor === s.youId && b.stage === "committee" && !b.cos.includes(id));
    if (mine) { mine.cos.push(id); mine.deals[id] = (mine.deals[id] || 0) + 0.3; const friends = CH(s).filter((o) => o.faction === m.faction && o.p === m.p && o.id !== id).slice(0, 4 + Math.round(m.base.influence / 20)); for (const o of friends) mine.deals[o.id] = (mine.deals[o.id] || 0) + 0.08;
      pushInbox(s, { kind: "staff", from: `${titleOf(m)} ${nameOf(m)}`, title: `I signed on to ${byId[mine.pid].name}`, body: `"Put my name on it. I've told a few of my people to take a look."`, done: true }); }
    else if ((s.know[id] || 0) >= 2) { const b = activeBills(s).find((x) => x.stage === "committee"); if (b) pushInbox(s, { kind: "staff", from: `${titleOf(m)} ${nameOf(m)}`, title: "A heads-up", body: `"${byId[b.pid].name} is ${rollCall("H", b.pid, billCtx(s, b)).yes >= 218 ? "going to pass" : "short of votes"}. Thought you'd want to know before you commit."`, done: true }); }
  }
  // An ambitious colleague takes the credit, or the cameras.
  if (r() < 0.04 * t) { const mine = s.bills.find((b) => b.sponsor === s.youId && b.stage === "committee"); const rival = CH(s).filter((m) => m.p === you.p && m.st === you.st && m.id !== you.id && m.t.ambition > 0.6)[0];
    if (mine && rival) { s.profile = Math.max(0, s.profile - 2); s.rel[rival.id] = clamp((s.rel[rival.id] || 0) - 0.1, -1, 1); pushNews(s, `${nameOf(rival)} holds a press conference on ${byId[mine.pid].name}, without ${nameOf(you)}.`, "bad"); } }
  // An ethics complaint if you have taken a lot and your integrity is thin.
  if (!s.flags.ethics && s.tookMoney > 600 && s.integrity < 55 && r() < 0.15 * t) { s.flags.ethics = true;
    pushInbox(s, { kind: "ethics", from: "The Office of Congressional Ethics", title: "A complaint has been filed against you", body: "A watchdog group says your votes tracked your donors too closely. Fighting it takes time and money. Ignoring it lets the story run.", choices: ["Fight it (10 hours, $150K)", "Ignore it", "Return the money and apologize"] }); pushNews(s, `A watchdog files an ethics complaint against ${nameOf(you)}.`, "bad"); }
}
// What you would have gained by always voting your district, and the votes that mattered most.
export function afterAction(s) {
  const you = memberById[s.youId];
  const votes = [...s.votesCast].map((v) => ({ ...v, name: byId[v.pid].name }));
  const hurt = votes.filter((v) => v.d < -0.3).sort((a, b) => a.d - b.d).slice(0, 3);
  const helped = votes.filter((v) => v.d > 0.3).sort((a, b) => b.d - a.d).slice(0, 3);
  const lost = votes.filter((v) => v.d < 0).reduce((a, v) => a - 2 * v.d, 0) * 0.45 * 0.5;
  const yours = s.bills.filter((b) => b.sponsor === s.youId);
  const kept = s.youOwe.filter((f) => f.status === "kept").length, broken = s.youOwe.filter((f) => f.status === "broken").length + s.promises.filter((p) => p.done && p.broken).length;
  const friends = Object.entries(s.rel).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, v]) => v > 0.2).map(([id]) => nameOf(memberById[id]));
  const enemies = Object.entries(s.rel).sort((a, b) => a[1] - b[1]).slice(0, 2).filter(([, v]) => v < -0.15).map(([id]) => nameOf(memberById[id]));
  const lines = [];
  if (s.result?.kind === "general") lines.push(`The seat started at ${you.own >= 50 ? "+" : ""}${((you.own - 50) * 2).toFixed(0)} for your party. The national mood moved it ${s.result.env >= 0 ? "+" : ""}${s.result.env}, and your own standing did the rest.`);
  if (hurt.length) lines.push(`Votes that cost you most at home: ${hurt.map((v) => `${v.vote ? "yes" : "no"} on ${v.name} (${v.d.toFixed(1)})`).join("; ")}.`);
  if (helped.length) lines.push(`Votes that helped most: ${helped.map((v) => `${v.vote ? "yes" : "no"} on ${v.name} (+${v.d.toFixed(1)})`).join("; ")}.`);
  if (lost > 0.5 && s.result?.kind === "general") lines.push(`Had you voted your district every time, the margin would have been about ${lost.toFixed(1)} points better${!s.result.won && lost > -s.result.margin ? ", enough to win" : ""}. Those votes bought you standing with your party and your base.`);
  if (yours.length) lines.push(`You wrote ${yours.length} bill${yours.length > 1 ? "s" : ""}; ${yours.filter((b) => b.stage === "law").length} became law.`);
  if (kept + broken) lines.push(`You kept ${kept} promise${kept === 1 ? "" : "s"} and broke ${broken}.`);
  if (friends.length) lines.push(`Your closest allies: ${friends.join(" and ")}.`);
  if (enemies.length) lines.push(`You made enemies of ${enemies.join(" and ")}.`);
  const gl = (s.result?.groups?.list || s.primaryGroups?.list || []).slice(0, 3);
  if (gl.length) lines.push(`Groups that moved your race: ${gl.map((g) => `${g.name} (${g.pts > 0 ? "+" : ""}${g.pts})`).join("; ")}.`);
  for (const m of s.moments.slice(-3)) lines.push(m.text);
  return lines;
}

// The groups a member leans on most.
export function memberGroups(m) { return IGROUPS.map((g) => ({ g, dep: dependence(m, g, noise) })).filter((x) => x.dep > 0.3).sort((a, b) => b.dep - a.dep).slice(0, 3); }
// First steps for a new player; each ticks off when done.
export function firstSteps(s) {
  return [
    { done: s.inbox.some((m) => m.done && m.choices), text: "Answer a message in your inbox" },
    { done: !!s.flags.met, text: "Meet a colleague (Chamber tab, click any seat)" },
    { done: !!s.flags.board, text: "Open a whip board (Bills tab)" },
    { done: !!s.flags.whipped || !!s.flags.cos, text: "Whip a member or cosponsor a bill" },
    { done: s.week > 0, text: "End the week" },
  ];
}
export function flag(s0, k) { if (s0.flags[k]) return s0; const s = structuredClone(s0); s.flags[k] = true; return s; }

// Where the President stands on a bill: his own view, plus what lobbying and your rapport have moved.
export function presView(s, b) {
  const info = billInfo(b.pid, b.party);
  const score = info.pres * PSIGN() + (b.wh || 0) + (b.sponsor === s.youId ? 0.15 * s.rapport : 0);
  const bar = b.party !== PP && !info.bipartisan ? 0.1 : -0.05;
  return { score, signs: info.mustPass || info.amendment || score >= bar, gap: score - bar, firm: Math.abs(PRESIDENT_STANCE[b.pid] ?? 0) > 0.6 };
}
export const RAPPORT = (r) => (r <= -0.3 ? "Hostile" : r < -0.05 ? "Cold" : r < 0.15 ? "He barely knows you" : r < 0.45 ? "Friendly" : "Charmed");

// ── The President: reactions, non sequiturs and sudden reversals ──
const P_LOVE = ["calls it \"a beautiful bill, maybe the best ever written\"", "says he will sign it \"so fast your head will spin\"", "takes credit for the idea"];
const P_HATE = ["calls it \"a disaster, a total disaster\"", "says whoever wrote it \"should be ashamed\"", "promises a veto \"on day one, maybe sooner\""];
const P_MEH = ["says he \"hasn't read it, but people are saying things\"", "says he \"could go either way, we'll see what happens\"", "says he will decide \"in two weeks\""];
const P_ODD = ["Then he spends ten minutes on the White House ballroom.", "He adds that the bill should be named after him.", "He also says the Senate \"should be bigger, much bigger, or maybe smaller.\"", "He closes by floating a military parade for his birthday.", "He then rates the Speaker's suit a six out of ten.", "He ends with a long story about a golf course in Scotland."];
function presPost(s, text, pid) { s.pres.unshift({ week: s.week, text, pid }); if (s.pres.length > 40) s.pres.pop(); }
function whiteHouse(s, r) {
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee" || b.presSaid) continue;
    b.presSaid = true;
    const v = presView(s, b), pick = (a) => a[Math.floor(r() * a.length)];
    const line = v.score > 0.3 ? pick(P_LOVE) : v.score < -0.2 ? pick(P_HATE) : pick(P_MEH);
    presPost(s, `On ${byId[b.pid].name}, the President ${line}.${r() < 0.35 ? " " + pick(P_ODD) : ""}`, b.pid);
  }
  // Executive orders: he acts without Congress, and members feel it.
  if (r() < 0.05) { const opts = POLICIES.filter((p) => (PRESIDENT_STANCE[p.id] || 0) > 0.5 && !s.laws.includes(p.id)); const p = opts[Math.floor(r() * opts.length)];
    if (p) { s.boost[p.id] = (s.boost[p.id] || 0) + 0.06; s.eo = (s.eo || 0) + 1; presPost(s, `EXECUTIVE ORDER: the President signs an order pushing ${p.name} without Congress. Lawsuits are expected.`, p.id); pushNews(s, `The President acts alone on ${p.name}. Democrats call it an end run around Congress.`, "event"); } }
  // A sudden reversal: he flips on a bill, and his party scrambles to follow.
  const live = s.bills.filter((b) => !b.dead && b.stage === "committee" && !b.flipped && !billInfo(b.pid, b.party).mustPass);
  if (live.length && r() < 0.07 * TURB[s.diff?.world || "normal"]) {
    const b = live[Math.floor(r() * live.length)], v = presView(s, b), up = v.score < 0;
    b.flipped = true; b.wh = (b.wh || 0) + (up ? 0.45 : -0.45);
    const why = up ? ["after a phone call with a donor", "after seeing a poll on TV", "after a senator praised him at dinner"] : ["after a cable segment criticized it", "after an aide told him Democrats would get the credit", "for reasons nobody in the building can explain"];
    presPost(s, `REVERSAL: the President now ${up ? "supports" : "opposes"} ${byId[b.pid].name}, ${why[Math.floor(r() * why.length)]}.`, b.pid);
    pushNews(s, `The President reverses himself on ${byId[b.pid].name}. Republicans scramble to adjust.`, "event");
    pushInbox(s, { kind: "staff", from: `${s.staff[0].name}, chief of staff`, title: `He flipped on ${byId[b.pid].name}`, body: `The President ${up ? "came out for it" : "turned against it"} overnight. Every Republican count on that bill just changed. Look at the whip board again.`, done: true });
  }
}

// ── Your staff ──
const STAFF_ROLES = [["chief", "Chief of staff", "Runs the office; hears things."], ["ld", "Legislative director", "Counts votes and reads the bills."], ["comms", "Communications director", "Press, TV and damage control."], ["district", "District director", "Your eyes and ears back home."], ["poll", "Pollster", "Tells you what voters think."]];
function makeStaff(seed) {
  return STAFF_ROLES.map(([role, title, note], i) => { const r = rng(hash(`${seed}:staff:${role}`)); const first = PF[Math.floor(r() * PF.length)], last = PL[(Math.floor(r() * 20) + 40 + i) % PL.length];
    return { id: `staff-${role}`, role, title, note, first, last, name: `${first} ${last}`, skill: 8 + Math.floor(r() * 9), loyalty: 9 + Math.floor(r() * 10), exp: 2 + Math.floor(r() * 18) }; });
}
function staffNotes(s, r) {
  const you = memberById[s.youId], st = Object.fromEntries(s.staff.map((x) => [x.role, x]));
  const note = (who, title, body) => pushInbox(s, { kind: "staff", from: `${who.name}, ${who.title.toLowerCase()}`, title, body, done: true });
  if (s.week % 4 === 1) { const err = (20 - st.poll.skill) * 0.35, a = Math.round(s.approval + (r() - 0.5) * err * 2), env = you.p === "D" ? s.mood : -s.mood;
    note(st.poll, `New poll: ${a}% approve of you at home`, `Margin of error about ${Math.round(3 + err)} points. The national mood is ${env >= 0 ? "with" : "against"} your party by ${Math.abs(env).toFixed(1)}. The President is at ${Math.round(s.presApproval)}%. ${s.baseApproval < 55 ? "Your own party's voters are restless; watch for a primary." : "Your base is with you."}`); }
  const mine = s.bills.find((b) => b.sponsor === s.youId && b.stage === "committee");
  if (mine && r() < 0.5) { const c = whipCount(s, mine), yes = c.yes + c["lean yes"]; note(st.ld, `Count on your bill: ${yes} yes or leaning yes`, `${byId[mine.pid].name} needs 218. ${c.undecided} undecided. ${yes >= 218 ? "We're there if it holds." : `We're ${218 - yes} short; the fence-sitters are on the whip board.`} My confidence in this count is ${st.ld.skill >= 14 ? "high" : st.ld.skill >= 10 ? "fair" : "shaky"}.`); }
  if (r() < 0.28) { const ms = CH(s).filter((m) => m.id !== s.youId && m.p === you.p); const m = ms[Math.floor(r() * ms.length)];
    const items = [`${nameOf(m)} is telling people they want a leadership post. They're collecting favors.`, `${nameOf(m)} is in trouble at home. They'll be looking for votes that play well in the district.`, `Word is ${nameOf(m)} and the leadership aren't speaking. That bloc could be in play.`, `A lobbyist bought drinks for half of the ${m.faction.toLowerCase()} last night. Expect movement on something.`, `The whip's office is keeping a list of who has been unreliable. ${s.loyalty < 0 ? "You're on it." : "You're not on it."}`];
    note(st.chief, "What I'm hearing", items[Math.floor(r() * items.length)]); }
  if (r() < 0.2) { const items = [`A local paper ran a ${s.approval >= 50 ? "friendly" : "rough"} profile of you. ${s.profile < 20 ? "Nationally, nobody knows who you are yet." : "National bookers are starting to call."}`, `A clip of you from committee is getting passed around. ${s.integrity >= 60 ? "It helps." : "The comments are not kind."}`, "Three reporters asked the same question today: where are you on the President's latest? We need an answer ready."];
    note(st.comms, "Press check", items[Math.floor(r() * items.length)]); }
  if (r() < 0.18) { const items = ["The county party chairs want more of your time. They notice who shows up.", "Casework is up. People remember a fixed benefits check longer than any vote.", "A plant manager in the district asked where you are on tariffs. Jobs there depend on it."];
    note(st.district, "From back home", items[Math.floor(r() * items.length)]); }
}

// ── Attributes, Football Manager style: 1 to 20 ──
const to20 = (x) => Math.max(1, Math.min(20, Math.round(1 + x * 19)));
export function attrs(m) {
  const n = (k) => (noise(m.id + k) + 1) / 2;
  return { Negotiation: to20(m.t.deal * 0.7 + n("neg") * 0.3), Media: to20(m.t.ego * 0.6 + n("med") * 0.4), Fundraising: to20(Math.min(1, m.base.cash / 2200) * 0.6 + n("fun") * 0.4), Policy: to20((m.t.label === "wonk" ? 0.5 : 0.2) + Math.min(0.4, m.seniority / 50) + n("pol") * 0.3),
    Loyalty: to20(m.t.loyalty), Ambition: to20(m.t.ambition), Integrity: to20(m.t.ethics), Influence: to20(Math.min(1, m.base.influence / 110)) };
}
export function yourAttrs(s) {
  const you = memberById[s.youId], a = attrs(you);
  return { ...a, Media: to20(s.profile / 100), Fundraising: to20(Math.min(1, s.cash / 2500)), Integrity: to20(s.integrity / 100), Influence: to20(Math.min(1, s.clout / 110)), Loyalty: to20(0.5 + s.loyalty / 16) };
}

// ── Leadership, caucuses and committees ──
export function leadership(ch, p) {
  const ms = MEMBERS.filter((m) => m.ch === ch && m.p === p);
  const top = ms.filter((m) => m.lead?.length);
  const chairs = ms.filter((m) => !m.lead?.length && (m.comm || []).some((c) => c.c.length <= 4 && (c.role === "Chair" || c.role === "Ranking Member")));
  const used = new Set([...top, ...chairs].map((m) => m.id));
  const rest = ms.filter((m) => !used.has(m.id)).sort((a, b) => b.base.influence - a.base.influence);
  return { top, chairs, influential: rest.slice(0, 12), others: Math.max(0, rest.length - 12) };
}
export function caucuses(ch) {
  const ms = ch === "H" ? HOUSE : SENATE, maj = ms.filter((m) => m.p === "D").length, need = ch === "H" ? 218 : 51, margin = maj - need;
  const names = [...new Set(ms.map((m) => m.faction))];
  const rows = names.map((f) => { const g = ms.filter((m) => m.faction === f), p = g[0].p, mean = g.reduce((a, m) => a + m.x, 0) / g.length;
    const ch0 = CAUCUS.chairs[f], chair = ch0 && ms.find((m) => m.st === ch0[1] && normN(m.last) === normN(ch0[0]));
    const spread = Math.sqrt(g.reduce((a, m) => a + (m.x - mean) ** 2, 0) / g.length), leader = chair || [...g].sort((a, b) => b.base.influence - a.base.influence)[0];
    const posts = g.filter((m) => m.lead?.length || m.chair).length, veto = p === "D" && g.length > margin;
    const power = Math.round(Math.min(100, (g.length / ms.length) * 110 + (veto ? 25 : 0) + posts * 1.5 + (1 - Math.min(1, spread * 4)) * 10));
    return { name: f, p, size: g.length, mean, chair: !!chair, roster: ch === "H" && !!ROSTER[f], estimated: g.filter((m) => m.cauEst).length, cohesion: Math.round((1 - Math.min(1, spread * 4)) * 100), leader, posts, veto, power, note: FACTION_NOTE[f] }; });
  return { rows: rows.sort((a, b) => a.mean - b.mean), margin, need, maj };
}
// House blocs: how they actually get along, from how they behave in fights over rules, spending and leadership.
const CREL = { "Progressive Caucus|New Democrat Coalition": "Uneasy partners", "Progressive Caucus|Blue Dog Coalition": "Rivals", "New Democrat Coalition|Blue Dog Coalition": "Allies",
  "Democrats, no bloc|Progressive Caucus": "Allies", "Democrats, no bloc|New Democrat Coalition": "Allies", "Democrats, no bloc|Blue Dog Coalition": "Uneasy partners",
  "Freedom Caucus|Republican Study Committee": "Uneasy partners", "Freedom Caucus|Main Street Caucus": "Rivals", "Republican Study Committee|Main Street Caucus": "Uneasy partners",
  "Blue Dog Coalition|Main Street Caucus": "Can do business", "New Democrat Coalition|Main Street Caucus": "Can do business", "Blue Dog Coalition|Republican Study Committee": "Opponents",
  "New Democrat Coalition|Republican Study Committee": "Opponents", "Democrats, no bloc|Main Street Caucus": "Opponents", "Progressive Caucus|Main Street Caucus": "Opponents",
  "Democrats, no bloc|Republican Study Committee": "Enemies", "Progressive Caucus|Republican Study Committee": "Enemies", "Blue Dog Coalition|Freedom Caucus": "Opponents",
  "New Democrat Coalition|Freedom Caucus": "Enemies", "Progressive Caucus|Freedom Caucus": "Enemies", "Democrats, no bloc|Freedom Caucus": "Enemies" };
export const caucusRelation = (a, b) => { const k = CREL[a.name + "|" + b.name] || CREL[b.name + "|" + a.name]; if (k) return k;  const d = Math.abs(a.mean - b.mean); return a.p === b.p ? (d < 0.2 ? "Allies" : d < 0.35 ? "Uneasy partners" : "Rivals") : d < 0.45 ? "Can do business" : d < 0.8 ? "Opponents" : "Enemies"; };
export function committees(ch) {
  const map = {};
  for (const m of MEMBERS) if (m.ch === ch) for (const c of m.comm || []) { if (c.c.length > 4) continue; const k = (map[c.c] = map[c.c] || { c: c.c, n: c.n, members: [], chair: null, ranking: null }); k.members.push(m); if (c.role === "Chair") k.chair = m; if (c.role === "Ranking Member") k.ranking = m; }
  return Object.values(map).sort((a, b) => a.n.localeCompare(b.n));
}
export function relations(s) {
  return MEMBERS.filter((m) => m.id !== s.youId && ((s.know[m.id] || 0) > 0 || s.rel[m.id] || s.owedToYou[m.id])).map((m) => ({ m, rel: s.rel[m.id] || 0, know: s.know[m.id] || 0, owes: s.owedToYou[m.id] || 0, youOwe: s.youOwe.filter((f) => f.to === m.id && f.status === "open").length })).sort((a, b) => b.rel - a.rel || b.know - a.know);
}

// Who is close to whom, among the other characters. Built from things that really bind members:
// the same caucus, the same state delegation, the same committee, and how close their voting records are.
const bondCache = {};
export function bonds(m) {
  if (bondCache[m.id]) return bondCache[m.id];
  const pool = MEMBERS.filter((o) => o.id !== m.id && o.ch === m.ch);
  const shareComm = (o) => (m.comm || []).filter((c) => c.c.length <= 4 && (o.comm || []).some((d) => d.c === c.c)).length;
  const score = (o) => (o.p === m.p ? 0.6 : -0.6) + (o.faction === m.faction ? 0.5 : 0) + (o.st === m.st ? 0.45 : 0) + 0.15 * shareComm(o) - 1.4 * Math.abs(o.x - m.x) + 0.25 * noise(m.id < o.id ? m.id + o.id : o.id + m.id);
  const why = (o) => o.st === m.st && o.p === m.p ? `same ${o.st} delegation` : o.faction === m.faction ? `both ${m.faction}` : shareComm(o) ? "serve on a committee together" : o.p !== m.p ? "cross-party friendship" : "vote alike";
  const whyNot = (o) => o.p === m.p ? (o.faction !== m.faction ? `${o.faction} vs ${m.faction}` : "old feud") : o.st === m.st ? `rivals in ${o.st}` : "opposite ends of the chamber";
  const ranked = pool.map((o) => ({ o, v: score(o) })).sort((a, b) => b.v - a.v);
  const friends = ranked.slice(0, 4).map(({ o }) => ({ m: o, why: why(o) }));
  const sameP = ranked.filter(({ o }) => o.p === m.p).slice(-1).map(({ o }) => ({ m: o, why: whyNot(o) }));
  const other = ranked.filter(({ o }) => o.p !== m.p && (o.st === m.st || Math.abs(o.x - m.x) > 1)).slice(-1).map(({ o }) => ({ m: o, why: whyNot(o) }));
  return (bondCache[m.id] = { friends, rivals: [...sameP, ...other] });
}
export const caucusOf = (m) => (m.caucus || [m.faction]);

// ════════ The executive branch ════════
function freshCabinet() { return CABINET.map((c) => ({ id: c.id, post: c.post, short: c.short, first: c.first, last: c.last, sf: c.sf, sl: c.sl, born: c.born, tone: c.tone, heat: c.heat, loyal: c.loyal, need: c.need, area: c.area, note: c.note, vacant: false, since: 0, imp: false })); }
export const cabName = (c, real) => (c.vacant ? `the acting ${c.short} chief` : real ? `${c.first} ${c.last}` : `${c.sf} ${c.sl}`);
const HEAT_WHY = ["a watchdog report on travel spending", "leaked texts with a donor", "a whistleblower complaint", "a contract that went to a friend", "testimony that didn't match the record", "a fired inspector general", "a botched emergency response"];
function vacate(s, c, how) {
  c.vacant = true; c.since = s.week; c.heat = 0.2; c.imp = false;
  pushNews(s, `${c.post} ${c.first} ${c.last} ${how === "fired" ? "is fired" : how === "removed" ? "is removed from office by the Senate" : "resigns"}. A deputy takes over as acting ${c.short} chief.`, "event");
  if (roleOf(s) === "P" && c.need) {
    const r = R(s, "bench"), used = new Set(s.noms.map((n) => n.last).concat(s.cab.map((x) => x.last)));
    const picks = BENCH.filter((b) => !used.has(b[1])).sort(() => r() - 0.5).slice(0, 3);
    pushInbox(s, { kind: "nominate", from: `${s.cab.find((x) => x.id === "cos")?.first || "Susie"} ${s.cab.find((x) => x.id === "cos")?.last || "Wiles"}, chief of staff`, title: `Who do you want at ${c.short}?`, post: c.id,
      body: `The Senate has to confirm whoever you pick, and Democrats run it with ${SENATE.filter((m) => m.p === "D").length} seats. A loyalist is satisfying. A confirmable pick actually gets the job.`,
      picks, choices: picks.map(([f, l, cont]) => `${f} ${l} (${cont > 0.55 ? "a brawl to confirm" : cont > 0.35 ? "a fight" : "confirmable"})`) });
  } else if (c.need) s.vacQ = [...(s.vacQ || []), { post: c.id, week: s.week + 2 }];
}
function nominate(s, c, pick) {
  const [first, last, cont, loyal] = pick;
  const n = { id: `n${s.week}${s.noms.length}`, post: c.id, first, last, cont, loyal, vote: s.week + 4, done: false };
  s.noms.push(n);
  pushNews(s, `The President nominates ${first} ${last} for ${c.post}. ${cont > 0.5 ? "Democrats vow a fight." : "Senators sound open to it."}`);
  if (roleOf(s) === "S") pushInbox(s, { kind: "confirm", nom: n.id, from: "Your legislative director", title: `Confirmation vote: ${first} ${last} for ${c.short}`, body: `The vote is ${fmtDate(n.vote)}. ${cont > 0.5 ? "A loyalist with a thin record for the job." : "Qualified on paper, close to the President in practice."} How do you vote?`, choices: ["Vote to confirm", "Vote no"] });
}
function confirmVote(s, n) {
  const you = memberById[s.youId]; let yes = 0; const votes = {};
  for (const m of SENATE) {
    const p = m.p === "R" ? sig(8 * (0.7 - n.cont * 0.6 - (s.presApproval < 35 ? 0.15 : 0) + (s.rel[m.id] || 0) * (roleOf(s) === "P" ? 0.3 : 0)))
      : sig(8 * (-0.25 + (0.45 - n.cont) * 1.2 + (m.x + 0.25) * 0.6 + (roleOf(s) === "P" ? (s.rel[m.id] || 0) * 0.3 : 0)));
    const v = m.id === s.youId && n.yourVote !== undefined ? n.yourVote : m.id === s.youId ? you.p === "R" : noise(`${s.seed}:cf:${n.id}:${m.id}`) * 0.5 + 0.5 < p;
    votes[m.id] = v; if (v) yes++;
  }
  return { yes, no: 100 - yes, votes, ok: yes >= 51 || yes === 50 };    // the Vice President breaks a tie
}
function chamberVote(s, ms, fn, tag, forced) { let yes = 0; for (const m of ms) { const v = forced?.[m.id] ?? (noise(`${s.seed}:${tag}:${m.id}`) * 0.5 + 0.5 < fn(m)); if (v) yes++; } return { yes, no: ms.length - yes }; }
function execTick(s, r) {
  const role = roleOf(s), you = memberById[s.youId];
  // Scandal heat rises and falls; oversight and leaks push it up.
  for (const c of s.cab) {
    if (c.vacant) continue;
    const before = c.heat;
    c.heat = clamp(c.heat + (r() - 0.5) * 0.035 + (r() < 0.025 ? 0.12 : 0), 0, 1);
    if (before < 0.7 && c.heat >= 0.7) pushNews(s, `${c.post} ${cabName(c)} is under fire over ${HEAT_WHY[Math.floor(r() * HEAT_WHY.length)]}.`, "event");
    if (c.heat > 0.88 && r() < 0.1) vacate(s, c, "resigns");
    else if (r() < 0.004) vacate(s, c, "resigns");
    else if (role !== "P" && c.heat > 0.8 && c.loyal < 0.8 && r() < 0.06) vacate(s, c, "fired");
  }
  // Open posts get a nominee; the Senate votes a month later.
  for (const v of s.vacQ || []) if (v.week <= s.week && !v.done) { v.done = true; const c = s.cab.find((x) => x.id === v.post); if (!c.vacant) continue;
    const used = new Set(s.noms.map((n) => n.last).concat(s.cab.map((x) => x.last))); const pool = BENCH.filter((b) => !used.has(b[1]));
    const pick = pool.sort((a, b) => b[3] - a[3] + (r() - 0.5) * 0.3)[0]; if (pick) nominate(s, c, pick); }
  for (const n of s.noms) if (!n.done && n.vote <= s.week) {
    n.done = true; const c = s.cab.find((x) => x.id === n.post), v = confirmVote(s, n); n.result = v;
    if (v.ok) { Object.assign(c, { first: n.first, last: n.last, sf: swapPair(n.first, n.last)[0], sl: swapPair(n.first, n.last)[1], vacant: false, tone: undefined, heat: 0.15 + n.cont * 0.4, loyal: n.loyal, note: "Confirmed this Congress.", since: s.week }); pushNews(s, `The Senate confirms ${n.first} ${n.last} as ${c.post}, ${v.yes}-${v.no}.`, "good"); if (role === "P") { s.clout += 3; s.legacy = (s.legacy || 0) + 1; } }
    else { pushNews(s, `The Senate rejects ${n.first} ${n.last} for ${c.post}, ${v.yes}-${v.no}.`, "bad"); if (role === "P") { s.presApproval -= 0.8; s.clout -= 4; vacate(s, c, "still"); c.vacant = true; } else s.vacQ.push({ post: c.id, week: s.week + 2 }); }
    if (role === "S") { const mine = v.votes[s.youId]; s.rapport = clamp(s.rapport + (mine ? 0.1 : -0.08), -1, 1); s.baseApproval = clamp(s.baseApproval + ((mine ? 1 : -1) * (you.p === "R" ? 1 : -1)) * 1.2, 5, 95); }
  }
  // Impeachment: the House needs a majority; the Senate needs 67 to remove.
  const hot = s.cab.find((c) => !c.vacant && !c.imp && c.heat >= 0.92);
  if (hot && HOUSE.filter((m) => m.p !== PP).length >= 218) {
    hot.imp = true; s.imp.push({ id: `i${s.week}`, who: hot.id, stage: "house", week: s.week + 3 });
    pushNews(s, `House Democrats file articles of impeachment against ${hot.post} ${cabName(hot)}.`, "event");
    if (role === "H") pushInbox(s, { kind: "impeach", imp: `i${s.week}`, from: "Your legislative director", title: `Impeach ${cabName(hot)}?`, body: `The floor vote is ${fmtDate(s.week + 3)}. ${you.p === "D" ? "Leadership wants every Democrat. Your swing-seat colleagues are nervous." : "Your party will vote no. A yes would make national news."}`, choices: ["Vote to impeach", "Vote no"] });
  }
  if (s.presHeat >= 0.9 && s.presApproval < 36 && HOUSE.filter((m) => m.p !== PP).length >= 218 && !s.imp.some((i) => i.who === "POTUS")) {
    s.imp.push({ id: `i${s.week}p`, who: "POTUS", stage: "house", week: s.week + 4 });
    pushNews(s, "House Democrats introduce articles of impeachment against the President.", "event");
    if (role === "H") pushInbox(s, { kind: "impeach", imp: `i${s.week}p`, from: "Your legislative director", title: "Impeach the President?", body: `The floor vote is ${fmtDate(s.week + 4)}. This will define your career either way.`, choices: ["Vote to impeach", "Vote no"] });
    if (role === "P") pushInbox(s, { kind: "staff", from: "White House Counsel", title: "They're coming for you", body: "House Democrats filed articles of impeachment. The House will pass them. Removal takes 67 senators, so the fight is for Republican senators: keep them close and keep your numbers up." });
  }
  for (const i of s.imp) {
    if (i.done || i.week > s.week) continue;
    const c = s.cab.find((x) => x.id === i.who), heat = i.who === "POTUS" ? s.presHeat : c.heat, pres = i.who === "POTUS";
    const who = pres ? "the President" : `${c.post} ${cabName(c)}`;
    if (i.stage === "house") {
      const v = chamberVote(s, HOUSE, (m) => (m.p === "D" ? sig(9 * (0.35 + (heat - 0.9) - m.vuln * 0.4)) : sig(9 * (-0.75 + (heat - 0.9) * 2))), `imp${i.id}`, i.yourVote !== undefined ? { [s.youId]: i.yourVote } : null);
      i.house = v;
      if (v.yes >= 218) { i.stage = "senate"; i.week = s.week + 3; pushNews(s, `The House impeaches ${who}, ${v.yes}-${v.no}. A Senate trial follows.`, "event");
        if (role === "S") pushInbox(s, { kind: "impeach", imp: i.id, from: "Your legislative director", title: `Trial vote: convict ${pres ? "the President" : cabName(c)}?`, body: `Removal takes 67. The verdict is ${fmtDate(i.week)}.`, choices: ["Vote to convict", "Vote to acquit"] }); }
      else { i.done = true; pushNews(s, `The impeachment of ${who} fails in the House, ${v.yes}-${v.no}.`, "good"); if (pres) s.presHeat -= 0.2; else c.heat -= 0.2; }
    } else {
      const v = chamberVote(s, SENATE, (m) => (m.p === "D" ? sig(9 * 0.55) : sig(9 * (-0.8 + (pres ? (40 - s.presApproval) / 30 : (heat - 0.9) * 2) + (0.4 - m.x) * 0.5))), `trial${i.id}`, i.yourVote !== undefined && role === "S" ? { [s.youId]: i.yourVote } : null);
      i.senate = v; i.done = true;
      if (v.yes >= 67) {
        pushNews(s, `The Senate convicts ${who}, ${v.yes}-${v.no}.`, "bad");
        if (pres) { if (role === "P") { s.over = true; s.result = { kind: "removed", won: false, votes: v.yes }; } else { s.presApproval = 45; s.presHeat = 0.2; pushNews(s, "Vice President JD Vance is sworn in as President.", "event"); } }
        else vacate(s, c, "removed");
      } else { pushNews(s, `The Senate acquits ${who}, ${v.yes}-${v.no}. Conviction needed 67.`, pres ? "event" : ""); if (pres) s.presHeat -= 0.25; else c.heat = clamp(c.heat - 0.25, 0, 1); }
    }
  }
  // The President's own scandal meter.
  s.presHeat = clamp(s.presHeat + 0.003 + (s.presApproval < 38 ? 0.002 : -0.002) + (r() < 0.03 ? 0.05 : 0) + (r() - 0.5) * 0.01, 0, 1);
  // He keeps score of how you vote, and says so.
  if (role !== "P") {
    const last = s.votesCast.filter((v) => v.week === s.week - 1);
    for (const v of last) {
      const st = (PRESIDENT_STANCE[v.pid] ?? 0) * PSIGN(); if (Math.abs(st) < 0.5) continue;
      const withHim = (st > 0) === v.vote;
      if (you.p === PP && !withHim && s.week - (s.lastAttack ?? -99) > 8 && r() < 0.35 + Math.abs(st) * 0.2 - Math.max(0, s.rapport) * 0.4) { s.lastAttack = s.week; s.baseApproval = clamp(s.baseApproval - 3, 5, 95); s.rivals = (s.rivals || 0) + 0.5; s.rapport = clamp(s.rapport - 0.2, -1, 1); presPost(s, `The President attacks ${nameOf(you)} by name: "${titleOf(you)} ${you.sl}" is "a RINO who should be primaried" after the vote on ${byId[v.pid].name}.`, v.pid); pushNews(s, `The President calls for a primary challenge to ${nameOf(you)}.`, "bad"); }
      else if (you.p === PP && withHim && s.rapport > 0.15 && r() < 0.18 && !s.endorsed) { s.endorsed = true; s.baseApproval = clamp(s.baseApproval + 5, 5, 95); presPost(s, `"Complete and Total Endorsement" for ${titleOf(you)} ${you.sl}, the President posts after the vote on ${byId[v.pid].name}.`, v.pid); pushNews(s, `The President endorses ${nameOf(you)}.`, "good"); }
      else if (you.p !== PP && !withHim && r() < 0.12) { s.baseApproval = clamp(s.baseApproval + 2, 5, 95); s.profile = clamp(s.profile + 2, 0, 100); presPost(s, `The President mocks ${titleOf(you)} ${you.sl} over ${byId[v.pid].name}. Your fundraising email goes out within the hour.`, v.pid); s.cash += 60; }
    }
  }
}
export const swapPair = (f, l) => { const o = (w) => (w.match(/^[^aeiouAEIOU]*/) || [""])[0], a = o(f), b = o(l); return a && b && a.toLowerCase() !== b.toLowerCase() ? [b + f.slice(a.length), (a + l.slice(b.length)).replace(/^./, (x) => x.toUpperCase())] : [f, l]; };

// ════════ Playing the President ════════
function newPresidency(seed, diff) {
  const know = {};
  for (const m of MEMBERS) know[m.id] = m.lead?.length ? 1 : 0;
  const s = {
    seed, week: 0, youId: "POTUS", role: "P", hours: HOURS, cash: 0, approval: 39, baseApproval: 84, profile: 100, clout: 60, integrity: 50, legis: 0, loyalty: 0,
    know, rel: {}, owedToYou: {}, youOwe: [], promises: [], bills: [], laws: [], news: [], inbox: [], pending: null, log: [], n: 0,
    econ: { growth: 1.6, inflation: 3.4, jobs: 4.6 }, presApproval: 39, mood: 5.3, reconUsed: {}, over: false, result: null, votesCast: [], tookMoney: 0,
    rapport: 0, pres: [], staff: makeStaff(seed), diff: diff || { info: "normal", world: "normal" }, boost: {}, groups: {}, flags: {}, usedEvents: [], moments: [],
    cab: freshCabinet(), noms: [], presHeat: 0.35, imp: [], eos: [], legacy: 0, vetoes: 0, signed: 0, term: 1, termStart: 0, edits: {}, pp: "R", career: [],
  };
  mpSeed(s);
  for (const m of MEMBERS) if (m.p === "R") s.rel[m.id] = clamp(0.1 + 0.3 * (m.t.label === "follower" ? 1 : 0) + 0.2 * m.x - (m.vuln > 0.7 ? 0.1 : 0), -1, 1);
  seedBills(s);
  pushInbox(s, { kind: "staff", from: "Susie Wiles, chief of staff", title: "Democrats run Congress now", body: `They hold ${HOUSE.filter((m) => m.p === "D").length} House seats and ${SENATE.filter((m) => m.p === "D").length} in the Senate. Their bills will land on your desk; you can sign or veto. They can override with 290 and 67, so every Republican you keep matters. You can't run again, so this is about your approval, your legacy and whether your party keeps the White House in November 2028.` });
  return s;
}
function presAction(s, act, arg, r) {
  const b = arg.bill ? s.bills.find((x) => x.id === arg.bill) : null;
  if (act === "call") {
    const m = memberById[arg.id], l = lean(m, b.pid, billCtx(s, b));
    const want = presView(s, b).score >= 0;                                   // which way he is pushing
    const odds = clamp(0.3 + (m.p === "R" ? 0.25 : -0.12) + (m.t.label === "follower" ? 0.2 : m.t.label === "vain" ? 0.1 : 0) + (s.presApproval - 40) / 80 + (s.rel[m.id] || 0) * 0.4 - (m.p === "R" ? 0 : 0.2 * (1 - m.vuln)), 0.05, 0.9);
    b.asked[m.id] = true; s.know[m.id] = Math.max(1, s.know[m.id] || 0);
    if (r() < odds) { b.deals[m.id] = (b.deals[m.id] || 0) + (want ? 1 : -1) * (m.p === "R" ? 0.45 : 0.3); s.rel[m.id] = clamp((s.rel[m.id] || 0) + 0.08, -1, 1); s.toast = { title: `${nameOf(m)} is with you`, text: `"Whatever you need, Mr. President." They were ${l.p > 0.5 ? "leaning yes" : "leaning no"}; they've moved your way.`, tone: "good" }; }
    else { s.rel[m.id] = clamp((s.rel[m.id] || 0) - 0.04, -1, 1); s.toast = { title: "Polite, but no", text: `${nameOf(m)} thanks you for the call and says they have to do what's right for ${m.seat}.`, tone: "" }; }
  }
  if (act === "push") { const info = billInfo(b.pid, b.party); b.wh = (b.wh || 0) + 0.3; s.presApproval = clamp(s.presApproval + info.pop * 1.4, 20, 70); presPost(s, `The President pushes ${byId[b.pid].name} in a prime-time address.`, b.pid); s.toast = { title: "Prime time", text: `Your party hears you. ${info.pop > 0 ? "The public likes the idea." : "It's not popular, and the polls notice."}`, tone: info.pop > 0 ? "good" : "" }; }
  if (act === "threat") { b.wh = (b.wh || 0) - 0.5; b.threat = true; presPost(s, `VETO THREAT: the President says ${byId[b.pid].name} "will never become law."`, b.pid); s.toast = { title: "Veto threat issued", text: "Republicans now have cover to vote no, and to sustain a veto.", tone: "" }; }
  if (act === "eo") {
    if ((s.eos || []).some((e) => e.pid === arg.pid) || s.laws.includes(arg.pid)) { s.hours += ACTIONS.eo.hours; return; }
    const info = billInfo(arg.pid, "R"); s.boost[arg.pid] = (s.boost[arg.pid] || 0) + 0.06; s.presApproval = clamp(s.presApproval + info.pop * 1.2, 20, 70); s.presHeat = clamp(s.presHeat + 0.01, 0, 1);
    const court = r() < 0.45 ? s.week + 4 + Math.floor(r() * 10) : null; s.eos.push({ pid: arg.pid, week: s.week, court, alive: true }); s.legacy += 1;
    presPost(s, `EXECUTIVE ORDER: ${byId[arg.pid].name}, signed in the Oval Office with a big pen.`, arg.pid); pushNews(s, `The President acts alone on ${byId[arg.pid].name}. Lawsuits are expected.`, "event");
    s.toast = { title: "Signed", text: `It takes effect now. ${court ? "Your lawyers expect a court fight." : "Your lawyers think it holds."}`, tone: "good" };
  }
  if (act === "rally") { s.rallyW = [...(s.rallyW || []).filter((w) => w > s.week - 8), s.week]; const tired = 1 / s.rallyW.length; s.rallies = (s.rallies || 0) + 1; const g = (0.6 + r() * 1.1) * tired; s.presApproval = clamp(s.presApproval + g, 20, 70); s.baseApproval = clamp(s.baseApproval + 1.5, 5, 99); s.mood -= 0.1; s.toast = { title: "The crowd goes wild", text: `Ninety minutes, half of it off-script. Approval ticks up ${g.toFixed(1)}.`, tone: "good" }; }
  if (act === "fire") { const c = s.cab.find((x) => x.id === arg.id); const hot = c.heat > 0.6; vacate(s, c, "fired"); s.presApproval = clamp(s.presApproval + (hot ? 0.6 : -1), 20, 70); s.presHeat = clamp(s.presHeat - (hot ? 0.05 : 0), 0, 1); s.toast = { title: "You're fired", text: hot ? "It drains a scandal before it reaches you." : "Washington reads it as chaos.", tone: hot ? "good" : "bad" }; }
}
// Sign or veto a bill on your desk. Returns the state with roll call events to show.
export function decide(s0, billId, signs) {
  const s = structuredClone(s0); const b = s.bills.find((x) => x.id === billId);
  if (!b || b.stage !== "desk") return s;
  const info = billInfo(b.pid, b.party);
  s.events = desk(s, b, signs, { bill: b.id, pid: b.pid, auto: false, stages: [] });
  if (signs) { s.signed++; s.presApproval = clamp(s.presApproval + info.pop * 1.5 + (b.party === "D" ? 0.3 : 0), 20, 70); s.baseApproval = clamp(s.baseApproval - (b.party === "D" && info.dir > 0 ? 3 : 0), 5, 99); s.legacy += b.party === "R" ? 2 : 1; }
  else { s.vetoes++; s.presApproval = clamp(s.presApproval - info.pop * 1.2, 20, 70); s.baseApproval = clamp(s.baseApproval + (info.dir > 0 ? 1.5 : -1), 5, 99); }
  return s;
}
const ASKS = ["wants you to headline a fundraiser in their district", "wants a federal grant for a bridge back home", "wants you to stay out of their primary", "wants a seat on Air Force One for the next trip home", "wants your endorsement before filing day"];
function presWeek(s, r) {
  for (const e of s.eos) if (e.alive && e.court === s.week) { e.alive = false; s.presApproval -= 0.8; s.presHeat = clamp(s.presHeat + 0.03, 0, 1); s.legacy -= 1; pushNews(s, `A federal judge blocks the President's order on ${byId[e.pid].name}.`, "bad"); presPost(s, `The President calls the judge who blocked his order on ${byId[e.pid].name} "a total disgrace."`, e.pid); }
  s.presApproval = clamp(s.presApproval + (40 + (s.econ.growth - 1.6) * 2 - (s.econ.inflation - 3) * 2 - s.presApproval) * 0.05, 20, 70);   // pulled back toward the fundamentals
  s.baseApproval = clamp(s.baseApproval + (s.presApproval - 39) * 0.02 + (84 - s.baseApproval) * 0.03, 5, 99);
  s.clout = clamp(s.clout + (s.presApproval - 40) * 0.05, 0, 100);
  // Members ask for things.
  if (r() < 0.5) { const pool = MEMBERS.filter((m) => m.p === "R" || m.vuln > 0.8); const m = pool[Math.floor(r() * pool.length)];
    pushInbox(s, { kind: "pask", who: m.id, from: `${titleOf(m)} ${nameOf(m)} (${m.p}-${m.seat})`, title: `${nameOf(m)} ${ASKS[Math.floor(r() * ASKS.length)]}`, body: m.p === "R" ? "It costs you a little. They'll remember it on the next close vote." : "A Democrat from a seat you won. Helping them is odd, but a friend across the aisle is worth a lot on an override.", choices: ["Do it", "Say no"] }); }
  // Your chief of staff on the next floor vote.
  const nx = s.bills.filter((b) => !b.dead && b.stage === "committee").sort((a, b) => a.floorWeek - b.floorWeek)[0];
  if (nx && nx.floorWeek === s.week + 1) { const v = presView(s, nx), w = whipCount(s, nx, nx.origin || "H");
    pushInbox(s, { kind: "staff", from: "Legislative affairs", title: `Next week: ${byId[nx.pid].name}`, body: `${v.signs ? "You lean toward signing it." : "Your instinct is a veto."} Our count in the ${nx.origin === "S" ? "Senate" : "House"}: about ${w.yes} yes, ${w.no} no. ${!v.signs ? `To make a veto stick, keep Republicans below ${nx.origin === "S" ? "67" : "290"} on an override.` : ""}`, done: true }); }
  if (s.week % 4 === 0) pushInbox(s, { kind: "staff", from: "Your pollster", title: `You're at ${Math.round(s.presApproval)}%`, body: `Republicans: ${Math.round(s.baseApproval)}% approve. ${s.presApproval < 38 ? "Below 38 your party starts running away from you." : s.presApproval > 45 ? "Members want you in their districts again." : "Stable, not strong."}`, done: true });
}
function presVerdict(s, r) {
  const map = presMap(s, true); s.lastPres = map;
  const won = map.winner === PP, margin = map.nat * (PP === "D" ? 1 : -1);
  s.over = true;
  s.result = { kind: "pres", won, margin: Math.round(margin * 10) / 10, ev: map.ev, approval: Math.round(s.presApproval), laws: s.laws.length, vetoes: s.vetoes, eos: (s.eos || []).filter((e) => e.alive).length, legacy: s.legacy };
  pushNews(s, `Election night 2028: the Republican nominee ${won ? "wins" : "loses"}, ${map.ev.R} electoral votes to ${map.ev.D}.`, won ? "good" : "bad");
}
// Senators who aren't on the 2028 ballot: a verdict on the term instead of an election.
function termReview(s, r) {
  const score = s.clout * 0.4 + s.legis * 0.6 + s.profile * 0.3 + (s.baseApproval - 50) * 0.5 + s.integrity * 0.2 + (r() - 0.5) * 6;
  s.over = true;
  s.result = { kind: "term", won: true, score: Math.round(score), next: memberById[s.youId].cls === 1 ? 2030 : 2032 };
  pushNews(s, `The 120th Congress ends. ${nameOf(memberById[s.youId])} heads toward ${s.result.next} with a ${score > 70 ? "strong" : score > 45 ? "mixed" : "weak"} record.`);
}
export { POLICIES, PRESIDENT_STANCE };

// ════════ Committees and amendments ════════
// Which committee a bill goes to, by chamber. Rough jurisdiction by policy.
const JUR = [
  [["corp_rate", "top_rate", "all_rates", "niit", "cap_gains", "step_up", "itemized", "vat", "ftt", "gas_tax", "intl_corp", "wealth_tax", "irs", "carried_interest", "buyback_tax", "home_sale", "no_tax_ss", "ctc", "ss_payroll_250k", "ss_progressive", "ss_rate", "ss_age", "chained_cpi", "tariffs_up", "tariff_repeal", "partb", "medicare_adv", "site_neutral", "debt_limit", "aca", "medicaid_restore", "medicaid_cap"], "HSWM", "SSFI"],
  [["public_option", "m4a", "pbm", "health_extenders", "drug_neg", "kids_online", "ai_rules", "datacenter", "ratepayer", "price_gouging", "carbon"], "HSIF", "SSHR"],
  [["clean_energy", "permitting"], "HSIF", "SSEG"],
  [["defense_up", "defense_cut", "iran_supp"], "HSAS", "SSAS"], [["ukraine", "nato_exit", "foreign_aid", "war_powers"], "HSFA", "SSFR"],
  [["deport", "immigration", "ice_limits", "background_checks", "aw_ban", "red_flag", "carry_reciprocity", "codify_roe", "abortion_15wk", "police", "sentencing", "marijuana", "pardon_reform", "term_limits", "court_expansion", "gender_care", "dei"], "HSJU", "SSJU"],
  [["voter_id", "save_act", "voting_rights", "stock_ban", "ethics"], "HSHA", "SSRA"],
  [["school_choice", "community_college", "student_debt", "childcare", "min_wage"], "HSED", "SSHR"],
  [["infrastructure", "highways"], "HSPW", "SSEV"], [["ndd_grants"], "HSAP", "SSAP"], [["va_means"], "HSVR", "SSVA"],
];
export function commFor(pid, ch) { const row = JUR.find(([ids]) => ids.includes(pid)); return row ? (ch === "S" ? row[2] : row[1]) : ch === "S" ? "SSGA" : "HSGO"; }
const COMM_NAME = {}; for (const m of MEMBERS) for (const c of m.comm || []) COMM_NAME[c.c] = c.n;
export const commName = (code) => COMM_NAME[code] || "the committee";
export const commMembers = (code) => MEMBERS.filter((m) => (m.comm || []).some((c) => c.c === code));
export const commChair = (code) => MEMBERS.find((m) => (m.comm || []).some((c) => c.c === code && c.role === "Chair"));
const onComm = (m, code) => (m.comm || []).some((c) => c.c === code);
const AMEND = {
  district: { label: "an amendment for your district", w: 0 }, fix: { label: "a bipartisan fix", w: 0.07 }, pill: { label: "a poison pill", w: 0.08 }, sweet: { label: "a sweetener for wavering members", w: 0.05 },
};
// Before markup: if you sit on the committee, your staff asks what you want to do.
function preMarkup(s, b) {
  if (b.preAsked || roleOf(s) === "P") return; b.preAsked = true;
  const you = memberById[s.youId], code = b.comm;
  if (!onComm(you, code)) return;
  const l = lean(you, b.pid, billCtx(s, b)), oppose = l.L < 0;
  pushInbox(s, { kind: "markup", bill: b.id, from: "Your committee staff", title: `Markup in ${commName(code)}: ${byId[b.pid].name}`,
    body: `${commName(code)} marks it up ${fmtDate(Math.max(s.week + 1, b.floorWeek - 2))}. You sit on the committee, so you can try to change it. ${oppose ? "You're leaning against it." : "You're leaning for it."}`,
    choices: oppose ? ["Offer a poison pill", "Offer a bipartisan fix", "Offer a district amendment", "Just vote"] : ["Offer a bipartisan fix", "Offer a district amendment", "Offer a sweetener for wavering members", "Just vote"], oppose });
}
function offerAmend(s, b, kind) {
  const you = memberById[s.youId], members = commMembers(b.comm);
  const maj = "D";
  const odds = clamp((you.p === maj ? 0.72 : 0.3) + s.clout / 300 + (kind === "pill" && you.p !== b.party ? -0.1 : 0), 0.1, 0.92);
  const r = R(s, "amend"), ok = r() < odds, name = AMEND[kind].label;
  if (ok) {
    if (kind === "fix") b.amends.push({ kind, by: s.youId, p: b.party === "D" ? "R" : "D", w: AMEND.fix.w });
    if (kind === "sweet") b.amends.push({ kind, by: s.youId, p: b.party, w: AMEND.sweet.w });
    if (kind === "pill") b.amends.push({ kind, by: s.youId, p: b.party, w: -AMEND.pill.w });
    if (kind === "district") { s.approval = clamp(s.approval + 1.5, 5, 95); s.legis += 2; }
    if (kind === "fix") { s.clout += 1.5; s.baseApproval = clamp(s.baseApproval - 1, 5, 95); s.rel[b.sponsor] = clamp((s.rel[b.sponsor] || 0) + 0.08, -1, 1); }
    if (kind === "pill") { s.rel[b.sponsor] = clamp((s.rel[b.sponsor] || 0) - 0.2, -1, 1); s.baseApproval = clamp(s.baseApproval + 1.5, 5, 95); }
    s.legis += 1;
    pushNews(s, `${commName(b.comm)} adopts ${name} from ${titleOf(you)} ${nameOf(you)} to ${byId[b.pid].name}.`);
  } else pushNews(s, `${commName(b.comm)} rejects ${name} from ${nameOf(you)} on ${byId[b.pid].name}.`);
  return ok;
}
// Markup: the chair decides whether to hold one, then the committee votes. Others offer amendments too.
function markup(s, b, r) {
  b.marked = true;
  const code = b.comm, members = commMembers(code), chair = commChair(code);
  if (members.length < 5) { b.hist.push("Discharged to the floor without a markup."); return true; }
  const ctx = billCtx(s, b);
  if (chair && chair.id !== s.youId && lean(chair, b.pid, ctx).p < 0.25 && !(b.sponsor === s.youId && (s.rel[chair.id] || 0) > 0.2) && !billInfo(b.pid, b.party).mustPass) {
    b.dead = true; b.stage = "died"; b.hist.push(`${commName(code)}: the chair never held a markup.`);
    pushNews(s, `${byId[b.pid].name} dies in ${commName(code)}. Chair ${nameOf(chair)} won't hold a markup.`);
    if (b.sponsor === s.youId) pushInbox(s, { kind: "staff", from: "Your legislative director", title: `${nameOf(chair)} buried your bill`, body: `The chair of ${commName(code)} won't mark it up. Next time, build a relationship with the chair first: meet with them, and do the committee work.` });
    return false;
  }
  // Other members' amendments.
  if (r() < 0.4) { const pill = r() < 0.45, by = members.filter((m) => (pill ? m.p !== b.party : m.p === b.party) && m.id !== s.youId)[Math.floor(r() * 8)] || members[0];
    b.amends.push({ kind: pill ? "pill" : "sweet", by: by.id, p: b.party, w: pill ? -0.06 : 0.05 });
    pushNews(s, `${commName(code)} adopts ${pill ? "a poison-pill amendment" : "a sweetener"} from ${nameOf(by)} to ${byId[b.pid].name}.`); }
  const c2 = billCtx(s, b);
  // Rosters still reflect the old Congress; in the 120th the Democratic majority holds the majority of every committee, so each party's vote is scaled to its new ratio.
  const tally = { D: [0, 0], R: [0, 0] };
  for (const m of members) { const v = m.id === s.youId ? (b.yourVote ?? lean(m, b.pid, c2).L > 0) : rng(hash(`${s.seed}:mk:${m.id}:${b.id}`))() < lean(m, b.pid, c2).p; tally[m.p][0] += v ? 1 : 0; tally[m.p][1]++; }
  const ch = code[0] === "S" ? SENATE : HOUSE, dShare = ch.filter((m) => m.p === "D").length / ch.length, N = members.length, seatsD = Math.ceil(N * dShare) + (N % 2 === 0 ? 1 : 0), seatsR = N - seatsD;
  const yes = Math.round((tally.D[1] ? tally.D[0] / tally.D[1] : 0) * seatsD + (tally.R[1] ? tally.R[0] / tally.R[1] : 0) * seatsR), no = N - yes;
  b.markup = { yes, no };
  if (yes <= no) { b.dead = true; b.stage = "failed"; b.hist.push(`${commName(code)}: voted down ${yes}-${no}.`); pushNews(s, `${commName(code)} votes down ${byId[b.pid].name}, ${yes}-${no}.`, "bad"); settle(s, b, false); return false; }
  b.hist.push(`${commName(code)}: reported ${yes}-${no}${b.amends.length ? `, ${b.amends.length} amendment${b.amends.length > 1 ? "s" : ""}` : ""}.`);
  return true;
}
function committeeWeek(s, r) {
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee") continue;
    b.comm = b.comm || commFor(b.pid, b.origin === "S" ? "S" : "H"); b.amends = b.amends || [];
    if (!b.marked && b.floorWeek - s.week <= 3) preMarkup(s, b);
    if (!b.marked && b.floorWeek - s.week <= 1) markup(s, b, r);
  }
}

// ════════ Must-pass: government funding and the debt limit ════════
// In-game deadlines: the stopgap runs out early in 2027, then each new fiscal year; the debt limit X-date is an estimate.
const MP_DEFS = [
  { kind: "funding", week: 4, name: "Stopgap funding bill" }, { kind: "debt", week: 32, name: "Debt limit increase" },
  { kind: "funding", week: 38, name: "Fiscal 2028 funding bill" }, { kind: "funding", week: 90, name: "Fiscal 2029 stopgap" },
];
const D_RIDERS = { funding: ["aca", "ice_limits", "war_powers", "tariff_repeal", "medicaid_restore", "pardon_reform"], debt: [] };
const R_RIDERS = { funding: ["deport", "save_act", "ndd_grants"], debt: ["ndd_grants", "medicaid_cap"] };
function mpSeed(s) { const o = s.termStart || 0, y = 2 * ((s.term || 1) - 1);
  s.mp = MP_DEFS.map((d, i) => ({ id: `mp${s.term || 1}-${i}`, ...d, name: d.name.replace(/\d{4}/, (x) => String(+x + y)), deadline: d.week + o, open: d.week + o - 6, riders: [], stage: "waiting", hist: [], lapsed: 0, yourVote: null })); }
const riderL = (s, m, rd) => lean(m, rd.pid, { sponsor: rd.p, kind: "passage", seed: s.seed, boost: s.boost, deals: {}, trust: {} }).L;
function mpLean(s, m, mp, over = false) {
  const base = mp.kind === "funding" ? 0.28 : m.p === "D" ? 0.3 : 0.12;
  const rs = mp.riders.length ? mp.riders.reduce((a, rd) => a + riderL(s, m, rd), 0) / mp.riders.length : 0;
  return base + 0.55 * rs + (over && m.p === "R" ? -0.12 : 0) + (mp.lapsed ? 0.06 * mp.lapsed : 0) + ((mp.deals || {})[m.id] || 0);
}
export function mpCount(s, mp, ch) { const ms = ch === "H" ? HOUSE : SENATE; let yes = 0; for (const m of ms) if (sig(14 * mpLean(s, m, mp)) > 0.5) yes++; return { yes, no: ms.length - yes }; }
function mpVote(s, mp, ch, over = false) {
  const ms = ch === "H" ? HOUSE : SENATE; let yes = 0; const votes = {};
  for (const m of ms) { const v = m.id === s.youId && roleOf(s) !== "P" ? (mp.yourVote ?? mpLean(s, m, mp) > 0) : rng(hash(`${s.seed}:mp:${mp.id}:${s.week}:${m.id}:${over}`))() < sig(14 * mpLean(s, m, mp, over)); votes[m.id] = v; if (v) yes++; }
  return { yes, no: ms.length - yes, votes };
}
export const mpPresSigns = (s, mp) => !mp.riders.some((rd) => (PRESIDENT_STANCE[rd.pid] ?? 0) * PSIGN() <= -0.6 && rd.p !== PP);
function mpWeek(s, r) {
  const role = roleOf(s), you = memberById[s.youId];
  for (const mp of s.mp || []) {
    if (mp.stage === "law") continue;
    if (mp.stage === "waiting" && s.week >= mp.open) {
      mp.stage = "open";
      for (const pid of D_RIDERS[mp.kind].filter((p) => !s.laws.includes(p)).sort(() => r() - 0.5).slice(0, 2)) mp.riders.push({ pid, p: "D", by: "Democratic leaders" });
      pushNews(s, `${mp.name}: the deadline is ${fmtDate(mp.deadline)}. ${mp.riders.length ? `Democrats attach ${mp.riders.map((x) => byId[x.pid].name).join(" and ")}.` : "Democrats want it clean."}`, "event");
      if (role !== "P") pushInbox(s, { kind: "staff", from: "Your legislative director", title: `${mp.name} due ${fmtDate(mp.deadline)}`, body: mp.kind === "funding" ? "Miss it and the government shuts down. Riders are the fight: each side tries to attach policy the other has to swallow. You can add or strip riders from the Bills tab." : "Miss the X-date and the Treasury can't pay every bill. Republicans want spending cuts attached; Democrats want it clean.", done: true });
      if (role === "P") pushInbox(s, { kind: "staff", from: "OMB", title: `${mp.name} due ${fmtDate(mp.deadline)}`, body: `Democrats attached ${mp.riders.map((x) => byId[x.pid].name).join(", ") || "nothing yet"}. You can demand riders of your own or demand theirs come off. If it reaches you with a rider you can't accept, you can veto, and own the shutdown.`, done: true });
      continue;
    }
    if (mp.stage === "desk") { const m = s.inbox.find((x) => x.kind === "mpdesk" && x.mp === mp.id && !x.done); if (m && m.week < s.week) { m.done = true; m.choice = mpPresSigns(s, mp) ? 0 : 1; if (m.choice === 0) mpSettle(s, mp, true); else { mp.blame = "pres"; s.vetoes++; mpSettle(s, mp, false); } } continue; }
    if (mp.stage !== "open" && mp.stage !== "lapsed") continue;
    // The President demands a rider of his own (when you aren't him).
    if (role !== "P" && !mp.presAsked && mp.riders.length && r() < 0.35) { mp.presAsked = true; const pid = R_RIDERS[mp.kind].find((p) => !mp.riders.some((x) => x.pid === p)); if (pid) { presPost(s, `The President says he won't sign ${mp.name.toLowerCase()} without ${byId[pid].name}.`, pid); mp.demand = pid; } }
    // Leaders trade riders away when the Senate count is short.
    const sc = mpCount(s, mp, "S");
    if (sc.yes < 60 && !mp.lock) { const d = mp.riders.findIndex((x) => x.p === "D"); if (d >= 0 && r() < 0.4) { const x = mp.riders.splice(d, 1)[0]; pushNews(s, `To win Republican votes, Democratic leaders drop ${byId[x.pid].name} from ${mp.name.toLowerCase()}.`); }
      else if (d < 0 && mp.kind === "debt" && r() < 0.3) { const pid = R_RIDERS.debt.find((p) => !mp.riders.some((x) => x.pid === p)); if (pid) { mp.riders.push({ pid, p: "R", by: "Senate deal" }); pushNews(s, `Senate deal: ${mp.name.toLowerCase()} now carries ${byId[pid].name}.`); } } }
    if (mp.lock && s.week >= mp.lock) mp.lock = null;
    if (s.week < mp.deadline - 1 && mp.stage === "open") continue;
    // The vote.
    const h = mpVote(s, mp, "H"), sn = mpVote(s, mp, "S");
    mp.hist.push(`${fmtDate(s.week)}: House ${h.yes}-${h.no}, Senate ${sn.yes}-${sn.no}`);
    if (role !== "P" && roleOf(s) !== "P") { const mine = (role === "S" ? sn : h).votes[s.youId]; (s.mpVotes = s.mpVotes || []).push({ week: s.week, mp: mp.id, vote: mine }); if (!mine && you.vuln > 0.6) s.approval = clamp(s.approval - 1, 5, 95); }
    let passed = h.yes >= 218 && sn.yes >= 60, signed = false;
    if (passed) {
      if (role === "P") { mp.stage = "desk"; pushInbox(s, { kind: "mpdesk", mp: mp.id, from: "Staff secretary", title: `${mp.name} is on your desk`, body: `Riders: ${mp.riders.map((x) => byId[x.pid].name).join(", ") || "none, it's clean"}. Sign it, or veto it and own what happens next.`, choices: ["Sign it", "Veto it"] }); continue; }
      signed = mpPresSigns(s, mp);
      if (!signed) { const oh = mpVote(s, mp, "H", true), os = mpVote(s, mp, "S", true); mp.hist.push(`Vetoed. Override: House ${oh.yes}, Senate ${os.yes}`); signed = oh.yes >= 290 && os.yes >= 67; presPost(s, `VETO: the President rejects ${mp.name.toLowerCase()} over ${mp.riders.filter((x) => (PRESIDENT_STANCE[x.pid] ?? 0) <= -0.6).map((x) => byId[x.pid].name).join(" and ")}.`); mp.blame = signed ? null : "pres"; }
    } else mp.blame = h.yes < 218 ? "house" : mp.riders.some((x) => x.p === "D") ? "dems" : "gop";
    mpSettle(s, mp, passed && signed);
  }
}
function mpSettle(s, mp, ok) {
  if (ok) { mp.stage = "law"; for (const x of mp.riders) if (!s.laws.includes(x.pid)) s.laws.push(x.pid);
    pushNews(s, `${mp.name} becomes law${mp.riders.length ? `, carrying ${mp.riders.map((x) => byId[x.pid].name).join(" and ")}` : ", clean"}.${mp.lapsed ? ` The ${mp.kind === "funding" ? "shutdown" : "default crisis"} ends after ${mp.lapsed} week${mp.lapsed > 1 ? "s" : ""}.` : ""}`, "good"); return; }
  mp.stage = "lapsed"; mp.lapsed++;
  const blame = mp.blame === "pres" ? 0.25 : mp.blame === "gop" ? 0.15 : -0.15;      // + = voters blame Republicans
  s.mood = clamp(s.mood + blame, -6, 9); s.presApproval = clamp(s.presApproval - (mp.kind === "debt" ? 2 : 0.5) - (mp.blame === "pres" ? 0.4 : 0), 20, 70);
  s.approval = clamp(s.approval - (mp.kind === "debt" ? 1.5 : 0.3), 5, 95);
  if (mp.kind === "debt" && mp.lapsed === 1) { s.econ.growth -= 1.2; s.econ.jobs += 0.4; }
  if (mp.riders.length && mp.lapsed > 1) { const x = mp.riders.pop(); pushNews(s, `Under pressure, ${mp.name.toLowerCase()} loses ${byId[x.pid].name}.`); }
  mp.deadline = s.week + 2;
  pushNews(s, mp.kind === "funding" ? `The government shuts down. Week ${mp.lapsed}. ${mp.blame === "pres" ? "Polls blame the President." : mp.blame === "dems" ? "Republicans blame Democrats' riders." : "Both parties point fingers."}` : `The Treasury hits the debt limit. Markets fall; payments are delayed.`, "bad");
}
export function setMpVote(s0, id, v) { const s = structuredClone(s0); const mp = s.mp.find((x) => x.id === id); if (mp) mp.yourVote = v; return s; }
export const AMEND_LABEL = { district: "District amendment", fix: "Bipartisan fix", pill: "Poison pill", sweet: "Sweetener" };

// ════════ Careers past 2028 ════════
const senFaction = (m) => (m.p === "D" ? (m.x < -0.45 ? "Progressives" : m.x < -0.25 ? "Mainstream Democrats" : "Moderate Democrats") : m.x > 0.6 ? "Hard-right conservatives" : m.x > 0.35 ? "Mainstream Republicans" : "Governing-wing Republicans");
function regroup() { houseCaucus(MEMBERS); for (const m of SENATE) if (!m.faction || m.fictional || !m.caucus || m.caucus.length === 0 || HOUSE_FACTIONS.has(m.faction)) { m.faction = senFaction(m); m.caucus = [m.faction]; } }
const HOUSE_FACTIONS = new Set(["Progressive Caucus", "New Democrat Coalition", "Blue Dog Coalition", "Democrats, no bloc", "Freedom Caucus", "Republican Study Committee", "Main Street Caucus"]);
function clearCaches() { for (const k in cache) delete cache[k]; for (const k in factionLine) delete factionLine[k]; for (const k in bondCache) delete bondCache[k]; }
function rebuildChambers() { HOUSE.length = 0; SENATE.length = 0; for (const m of MEMBERS) (m.ch === "H" ? HOUSE : SENATE).push(m); }
export function resetWorld() {
  MEMBERS.forEach((m, i) => { for (const k of Object.keys(m)) delete m[k]; Object.assign(m, JSON.parse(JSON.stringify(ORIG[i]))); });
  PP = "R"; YEAR = 2027; applyPres(null); rebuildChambers(); clearCaches();
}
// Re-apply a saved career's changes to the world (after a reload).
function applyPres(s) {
  const P = s?.presRec; if (!P) { Object.assign(PRES_M, { first: PRESIDENT.first, last: PRESIDENT.last, sf: PRESIDENT.sf, sl: PRESIDENT.sl, p: "R", born: PRESIDENT.born, look: PRESIDENT.look, g: "M", fictional: false }); return; }
  Object.assign(PRES_M, { first: P.first, last: P.last, sf: P.first, sl: P.last, p: P.p, born: P.born, g: P.g, look: { skin: (P.first.length * 7 + P.last.length * 3) % 6 }, fictional: true });
}
export function restore(s) {
  applyPres(s);
  if (!s?.edits || !Object.keys(s.edits).length) return;
  resetWorld(); PP = s.pp || "R"; YEAR = 2027 + 2 * ((s.term || 1) - 1);
  for (const [id, rec] of Object.entries(s.edits)) { const m = memberById[id]; if (!m) continue; for (const k of Object.keys(m)) delete m[k]; Object.assign(m, JSON.parse(JSON.stringify(rec))); }
  rebuildChambers(); regroup(); clearCaches();
}
const keep = (s, m) => { s.edits[m.id] = JSON.parse(JSON.stringify(m)); };
const TRAITS_JS = ["dealmaker", "believer", "grudge", "vain", "loyalist", "follower", "wonk", "showhorse"];
// A fictional newcomer who wins a seat in a future election.
function newcomer(s, m, party, year) {
  const r = rng(hash(`${s.seed}:new:${m.id}:${year}`)), used = new Set(MEMBERS.map((x) => x.last));
  const first = PF[Math.floor(r() * PF.length)]; let last = PL[Math.floor(r() * PL.length)]; for (let i = 0; used.has(last) && i < 20; i++) last = PL[Math.floor(r() * PL.length)];
  const lean = party === "D" ? m.dem : 100 - m.dem, x = party === "D" ? -(0.18 + clamp((lean - 50) / 60, 0, 0.4) + r() * 0.12) : 0.3 + clamp((lean - 50) / 60, 0, 0.35) + r() * 0.12;
  const t = { ambition: 0.2 + r() * 0.7, loyalty: 0.2 + r() * 0.7, ego: 0.2 + r() * 0.7, ethics: 0.2 + r() * 0.7, deal: 0.2 + r() * 0.7 }; t.label = TRAITS_JS[Math.floor(r() * TRAITS_JS.length)];
  const comm = (m.comm || []).map((c) => ({ ...c, role: "", title: "" }));
  const keepKeys = { ch: m.ch, st: m.st, d: m.d, dem: m.dem, id: m.id, cls: m.cls };
  for (const k of Object.keys(m)) delete m[k];
  Object.assign(m, keepKeys, { first, last, sf: first, sl: last, p: party, x: Math.round(x * 1000) / 1000, y: 0, born: 1975 + Math.floor(r() * 18), since: year + 1, comm, lead: [], t, g: r() < 0.45 ? "F" : "M", fictional: true, est: true, new: true });
  derive(m); keep(s, m);
  for (const k of ["rel", "know", "owedToYou"]) delete s[k][m.id];
}
function flipTitles(ch, newMaj) {
  for (const m of MEMBERS) {
    if (m.ch !== ch) continue;
    for (const c of m.comm || []) if (c.c[0] === ch) { if (c.role === "Chair" && m.p !== newMaj) c.role = c.title = "Ranking Member"; else if (c.role === "Ranking Member" && m.p === newMaj) c.role = c.title = "Chair"; }
    m.lead = (m.lead || []).map((t) => t.replace("Majority", "\0").replace("Minority", "Majority").replace("\0", "Minority").replace(" (expected)", "").replace(" (contested)", ""));
    if (ch === "H" && m.lead[0] === "Speaker of the House") m.lead = ["House Minority Leader"];
    if (ch === "H" && m.p === newMaj && /Republican Leader|Democratic Leader/.test(m.lead[0] || "")) m.lead = ["Speaker of the House"];
    derive(m);
  }
}
// The election at the end of a term reshapes Washington: seats flip, members retire, the White House can change hands.
function electWorld(s) {
  const r = rng(hash(`${s.seed}:world:${s.term}`)), year = electionYear(s), cls = cycleClass(s.term), out = { flips: { H: 0, S: 0 }, retire: 0 };
  s.lastSenate = senateMap(s, true);
  const before = { H: HOUSE.filter((m) => m.p === "D").length >= 218 ? "D" : "R", S: SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R" };
  for (const m of [...MEMBERS]) {
    if (m.id === s.youId) continue;
    if (m.ch === "S" && m.cls !== cls) continue;
    const inc = m.p === "D" ? 1 : -1, n = noise(`${s.seed}:el${s.term}:${m.id}`);
    const margin = (m.dem - 50) * 2 + s.mood * (m.ch === "H" ? 0.9 : 0.8) + inc * (m.ch === "H" ? 4 : 4) + n * (m.ch === "H" ? 5 : 6);
    const winner = margin > 0 ? "D" : "R";
    const retires = noise(`${s.seed}:ret${s.term}:${m.id}`) < -0.86 || (YEAR + 1 - (m.born || 1960) > 82);
    if (winner !== m.p) { out.flips[m.ch]++; newcomer(s, m, winner, year); }
    else if (retires) { out.retire++; newcomer(s, m, m.p, year); }
  }
  // The White House, every four years.
  let presMsg = "";
  if (s.term % 2 === 1) {
    const map = presMap(s, true); s.lastPres = map;
    const winner = map.winner;
    presMsg = `${winner === "D" ? "A Democrat" : "A Republican"} wins the White House, ${Math.max(map.ev.D, map.ev.R)} electoral votes to ${Math.min(map.ev.D, map.ev.R)}${winner === PP ? ", keeping it for the President's party" : ""}.`;
    if (winner !== PP) { PP = winner; s.presApproval = 52; } else s.presApproval = 48;
    s.presHeat = 0.2; s.rapport = 0; s.pres = [];
    // A new (fictional) President and cabinet: the real one is term-limited.
    const pick = (k) => [PF[Math.floor(rng(hash(`${s.seed}:pn:${year}:${k}`))() * PF.length)], PL[Math.floor(rng(hash(`${s.seed}:pl:${year}:${k}`))() * PL.length)]];
    const [pf, pl] = pick("pres"); s.presRec = { first: pf, last: pl, p: PP, born: 1960 + Math.floor(r() * 18), g: r() < 0.4 ? "F" : "M", since: year + 1 }; applyPres(s);
    s.cab = s.cab.map((c, i) => { const [f, l] = pick(c.id + i); return { ...c, first: f, last: l, sf: f, sl: l, born: 1955 + Math.floor(r() * 25), tone: undefined, vacant: false, heat: 0.15, loyal: 0.7, note: `Appointed in ${year + 1}. A fictional member of the new administration.`, imp: false }; });
    s.newPres = { party: PP, year };
  } else s.presApproval = clamp(s.presApproval - 1, 25, 60);
  s.pp = PP;
  // A midterm or new-term mood: voters drift against whoever holds the White House.
  s.mood = s.mood * 0.3 + (PP === "R" ? 2 : -2);
  YEAR += 2;
  for (const m of MEMBERS) { derive(m); }
  rebuildChambers(); regroup();
  const after = { H: HOUSE.filter((m) => m.p === "D").length >= 218 ? "D" : "R", S: SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R" };
  for (const ch of ["H", "S"]) if (after[ch] !== before[ch]) flipTitles(ch, after[ch]);
  for (const m of MEMBERS) if (m.ch && (m.lead?.length || (m.comm || []).some((c) => c.role))) keep(s, m);
  clearCaches();
  return { ...out, presMsg, house: HOUSE.filter((m) => m.p === "D").length, senate: SENATE.filter((m) => m.p === "D").length, after };
}
export const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
export const canContinue = (s) => s.over && s.result && s.result.won && (s.result.kind === "general" || s.result.kind === "term" || s.result.kind === "higher") && roleOf(s) !== "P";
export function nextCongress(s0) {
  const s = structuredClone(s0);
  if (!canContinue(s)) return s;
  s.career.push({ congress: 119 + s.term, year: electionYear(s), kind: s.result.kind, margin: s.result.margin, role: roleOf(s), laws: s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law").length });
  const w = electWorld(s);
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.debateBonus = 0; s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null; s.primary = null; s.rivals = 0; s.endorsed = false;
  s.bills = []; s.youOwe = []; s.promises = []; s.flags.punished = s.flags.rewarded = false; s.inbox = s.inbox.filter((m) => !m.done).slice(0, 0); s.trend = [];
  s.noms = s.noms.filter((n) => !n.done); s.imp = s.imp.filter((i) => !i.done); s.runFor = null;
  s.clout += 4; s.profile = clamp(s.profile + 3, 0, 100); s.approval = clamp(s.approval * 0.6 + 52 * 0.4, 5, 95);
  const you = memberById[s.youId]; derive(you); keep(s, you);
  seedBills(s); mpSeed(s);
  const congress = 119 + s.term, hMaj = w.after.H, sMaj = w.after.S;
  pushNews(s, `The ${ord(congress)} Congress convenes. ${w.presMsg} Democrats hold ${w.house} House seats and ${w.senate} Senate seats. ${w.flips.H + w.flips.S} seats changed parties and ${w.retire} members retired.`, "event");
  pushInbox(s, { kind: "staff", from: `${s.staff[0].name}, chief of staff`, title: `Welcome to the ${ord(congress)} Congress`, done: true,
    body: `${w.presMsg} ${hMaj === "D" ? "Democrats" : "Republicans"} run the House and ${sMaj === "D" ? "Democrats" : "Republicans"} run the Senate. You're ${you.p === (you.ch === "H" ? hMaj : sMaj) ? "in the majority" : "in the minority"}. You have more seniority and more clout than two years ago. New members won this year are fictional; everyone else is who was there.` });
  // Leadership races and committee posts.
  const myComm = (you.comm || []).find((c) => c.c[0] === you.ch);
  pushInbox(s, { kind: "lead", from: "Your chief of staff", title: "Leadership elections are this week", comm: myComm?.c || null,
    body: `Your caucus votes on its leaders, and the Steering Committee picks committee posts. You can run for whip, go for the top spot${myComm ? ` on ${myComm.n}` : ""}, or sit it out. Losing a race costs you something with whoever won.`,
    choices: ["Run for party whip", myComm ? `Seek the top spot on ${myComm.n}` : "Ask for a better committee", "Sit it out"] });
  // A shot at higher office: a Senate seat in your state on the next ballot.
  if (you.ch === "H") { const seat = SENATE.find((m) => m.st === you.st && m.cls === cycleClass(s.term));
    if (seat) pushInbox(s, { kind: "higher", seat: seat.id, from: "Your campaign manager", title: `A Senate seat in ${you.st} is up in ${electionYear(s)}`,
      body: `${titleOf(seat)} ${nameOf(seat)} (${seat.p}) holds it. ${seat.p === you.p ? "Challenging your own party's senator means a primary." : "A statewide race against an incumbent."} Running means giving up your House seat.`, choices: [`Run for Senate in ${electionYear(s)}`, "Stay in the House"] }); }
  return s;
}
function leaderRace(s, choice, commCode) {
  const you = memberById[s.youId], r = R(s, "lead"), maj = (you.ch === "H" ? HOUSE.filter((m) => m.p === "D").length >= 218 : SENATE.filter((m) => m.p === "D").length >= 51) ? "D" : "R";
  const party = (you.ch === "H" ? HOUSE : SENATE).filter((m) => m.p === you.p && m.id !== you.id);
  const avgRel = party.reduce((a, m) => a + (s.rel[m.id] || 0), 0) / party.length;
  if (choice === 0) {
    const odds = clamp(0.08 + s.clout / 180 + avgRel * 3 + s.loyalty * 0.025 + you.seniority * 0.01, 0.03, 0.8);
    const title = `${you.ch === "H" ? "House" : "Senate"} ${you.p === maj ? "Majority" : "Minority"} Whip`;
    if (r() < odds) { const old = party.find((m) => (m.lead || []).some((t) => /Whip/.test(t))); if (old) { old.lead = []; derive(old); keep(s, old); s.rel[old.id] = clamp((s.rel[old.id] || 0) - 0.4, -1, 1); }
      you.lead = [title]; derive(you); keep(s, you); s.clout += 15; s.profile = clamp(s.profile + 10, 0, 100); pushNews(s, `${nameOf(you)} is elected ${title}.`, "good"); s.toast = { title: `You're the whip`, text: "You count the votes now, and members come to you. Your clout jumps.", tone: "good" }; }
    else { s.clout -= 2; s.loyalty -= 1; s.toast = { title: "You lost the whip race", text: "You came up short. The winner remembers who ran against them.", tone: "bad" }; }
  } else if (choice === 1 && commCode) {
    const odds = clamp(0.15 + you.seniority * 0.035 + s.clout / 220 + s.loyalty * 0.03, 0.05, 0.85), top = you.p === maj ? "Chair" : "Ranking Member";
    if (r() < odds) { const old = MEMBERS.find((m) => m.p === you.p && (m.comm || []).some((c) => c.c === commCode && c.role === top)); if (old) { for (const c of old.comm) if (c.c === commCode) c.role = c.title = ""; derive(old); keep(s, old); s.rel[old.id] = clamp((s.rel[old.id] || 0) - 0.3, -1, 1); }
      for (const c of you.comm) if (c.c === commCode) c.role = c.title = top; derive(you); keep(s, you); s.clout += 10; clearCaches();
      pushNews(s, `${nameOf(you)} becomes ${top.toLowerCase()} of ${commName(commCode)}.`, "good"); s.toast = { title: `${top} of ${commName(commCode)}`, text: top === "Chair" ? "You decide what gets a markup now. Bills in your committee live or die by you." : "You lead your party on the committee and speak for it in markups.", tone: "good" }; }
    else s.toast = { title: "Passed over", text: "Steering went with someone more senior. Next time.", tone: "" };
  }
}
// A House member running statewide for the Senate.
function runHigher(s, r) {
  const you = memberById[s.youId], seat = memberById[s.runFor];
  const env = you.p === "D" ? s.mood : -s.mood, lean = (you.p === "D" ? seat.dem : 100 - seat.dem) - 50;
  const inc = seat.p === you.p ? 0 : 4;
  const margin = lean * 2 + env * 0.9 + (s.approval - 50) * 0.25 + (s.profile - 30) * 0.08 + Math.min(5, s.cash / 1000) - inc + (r() - 0.5) * 7;
  s.over = true;
  if (margin > 0) {
    const yourOld = { ch: you.ch, st: you.st, d: you.d, dem: you.dem };
    // You take the Senate seat; your House seat gets a fictional successor of your party.
    Object.assign(seat, yourOld); seat.ch = "H"; newcomer(s, seat, you.p, electionYear(s));
    Object.assign(you, { ch: "S", d: undefined, dem: s.runForDem, cls: s.runForCls }); you.comm = []; you.lead = []; derive(you); keep(s, you);
    rebuildChambers(); regroup(); clearCaches();
    s.role = "S"; s.result = { kind: "higher", won: true, margin: Math.round(margin * 10) / 10 };
    pushNews(s, `${nameOf(you)} wins the Senate race in ${you.st} by ${Math.abs(s.result.margin)} points.`, "good");
  } else { s.result = { kind: "higher", won: false, margin: Math.round(margin * 10) / 10 }; pushNews(s, `${nameOf(you)} loses the Senate race in ${you.st}.`, "bad"); }
}
// Hiring: replace a staffer with a better (and pricier) one.
export const hireCost = (x) => 60 + 12 * Math.min(20, x.skill + 4);

// ════════ The electoral map ════════
export const EV = { AL: 9, AK: 3, AZ: 11, AR: 6, CA: 54, CO: 10, CT: 7, DE: 3, DC: 3, FL: 30, GA: 16, HI: 4, ID: 4, IL: 19, IN: 11, IA: 6, KS: 6, KY: 8, LA: 8, ME: 4, MD: 10, MA: 11, MI: 15, MN: 10, MS: 6, MO: 10, MT: 4, NE: 5, NV: 6, NH: 4, NJ: 14, NM: 5, NY: 28, NC: 16, ND: 3, OH: 17, OK: 7, OR: 8, PA: 19, RI: 4, SC: 9, SD: 3, TN: 11, TX: 40, UT: 6, VT: 3, VA: 13, WA: 12, WV: 4, WI: 10, WY: 3 };
// Each state's 2024 Democratic share of the two-party presidential vote (from the senators' records; DC added).
export const STATE_DEM = (() => { const o = { DC: 92 }; for (const m of ORIG) if (m.ch === "S") o[m.st] = m.dem; return o; })();
const NAT_2024 = -1.5;                                   // Trump won the national vote by about 1.5 points
const phi = (z) => 1 / (1 + Math.exp(-1.7 * z));
// The national presidential margin for Democrats: the generic ballot plus the economy, which helps or hurts the party in power.
export function nationalPres(s) { return s.mood * 0.85 - PSIGN() * ((s.econ.growth - 1.6) * 1.2 - (s.econ.inflation - 3) * 1.0); }
// final: draw the actual result with state-level error; otherwise a forecast with win probabilities.
export function presMap(s, final = false, year = electionYear(s)) {
  const nat = nationalPres(s), states = {}; const ev = { D: 0, R: 0 };
  for (const st of Object.keys(EV)) {
    const base = (STATE_DEM[st] - 50) * 2 + (nat - NAT_2024);
    const m = final ? base + noise(`${s.seed}:pres:${year}:${st}`) * 4 + noise(`${s.seed}:presnat:${year}`) * 2 : base;
    const pD = final ? (m > 0 ? 1 : 0) : phi(m / 5);
    states[st] = { m: Math.round(m * 10) / 10, pD, w: m > 0 ? "D" : "R", ev: EV[st] };
    ev[m > 0 ? "D" : "R"] += EV[st];
  }
  return { year, nat: Math.round(nat * 10) / 10, states, ev, winner: ev.D >= 270 ? "D" : "R", final };
}
// Senate races on the next ballot: forecast or result per state.
export function senateMap(s, final = false) {
  const cls = cycleClass(s.term), states = {};
  for (const m of SENATE.filter((x) => x.cls === cls)) {
    const inc = m.p === "D" ? 1 : -1, base = (m.dem - 50) * 2 + s.mood * 0.8 + inc * 4;
    const mm = final ? base + noise(`${s.seed}:el${s.term}:${m.id}`) * 6 : base;
    states[m.st] = { m: Math.round(mm * 10) / 10, pD: final ? (mm > 0 ? 1 : 0) : phi(mm / 6), w: mm > 0 ? "D" : "R", holder: m.p, who: m.id };
  }
  return { states, cls };
}
export function houseMap() {
  const states = {};
  for (const m of HOUSE) { const x = (states[m.st] = states[m.st] || { D: 0, R: 0 }); x[m.p]++; }
  for (const st in states) { const x = states[st]; x.pD = x.D / (x.D + x.R); }
  return { states };
}

// ════════ Scenes: hearings, interviews, meetings, debates ════════
// The engine only decides when a scene happens and what it does to you; scenes.js stages it.
const SCENE_DUE = 2;   // weeks before your staff handles it for you
function pushScene(s, type, ctx, title, from) {
  if (s.inbox.some((m) => m.kind === "scene" && !m.done && m.scene.type === type)) return null;
  const COOL = { tv: 7, hearing: 9, leader: 6, briefing: 4, oval: 5, debate: 0 }; s.sceneAt = s.sceneAt || {};
  if (s.week - (s.sceneAt[type] ?? -99) < COOL[type]) return null; s.sceneAt[type] = s.week;
  const msg = { kind: "scene", scene: { type, ...ctx }, from, title, body: "", due: s.week + SCENE_DUE };
  pushInbox(s, msg); return s.inbox[0];
}
function sceneWeek(s, r) {
  const role = roleOf(s), you = memberById[s.youId], rw = s.week - (s.termStart || 0);
  // Staff handles scenes you never played.
  for (const m of s.inbox) if (m.kind === "scene" && !m.done && s.week >= m.due) { m.done = true; m.skipped = true; }
  if (role === "P") {
    if (s.week % 5 === 2) pushScene(s, "briefing", { week: s.week }, "Press briefing: the press corps is waiting", "Press office");
    const desk = s.bills.find((b) => b.stage === "committee" && b.floorWeek - s.week === 2 && !presView(s, b).signs && b.party !== PP);
    if (desk && r() < 0.5) { const m = HOUSE.filter((x) => x.p === PP && x.vuln > 0.55).sort((a, b) => b.vuln - a.vuln)[Math.floor(r() * 5)]; if (m) pushScene(s, "oval", { bill: desk.id, who: m.id }, `Oval Office: ${nameOf(m)} on ${byId[desk.pid].name}`, "Legislative affairs"); }
    return;
  }
  // A TV booking after a vote that broke with your party, or now and then.
  const last = s.votesCast.filter((v) => v.week === s.week - 1);
  const off = last.find((v) => !v.partyLine);
  if ((off && r() < 0.6) || (!off && last.length && r() < 0.12)) { const v = off || last[0]; pushScene(s, "tv", { pid: v.pid, vote: v.vote, off: !!off }, `Cable interview tonight about ${byId[v.pid].name}`, "Your communications director"); }
  // A hearing with a cabinet officer under fire, if your party runs oversight or you sit on the panel.
  const hot = s.cab.find((c) => !c.vacant && c.heat >= 0.55 && c.id !== "vp");
  if (hot && r() < 0.08) pushScene(s, "hearing", { cab: hot.id, mine: you.p !== PP }, `Hearing: ${hot.post} ${cabName(hot)} testifies`, "Committee staff");
  // Leadership leans on you before a party vote you might not take.
  const b = s.bills.find((x) => x.stage === "committee" && x.party === you.p && x.floorWeek - s.week === 1 && x.yourVote === null);
  if (b && lean(you, b.pid, billCtx(s, b)).L < 0.3 && r() < 0.6) { const boss = MEMBERS.find((m) => m.ch === you.ch && m.p === you.p && /Whip|Leader|Speaker/.test(m.lead?.[0] || "")) || null; if (boss && boss.id !== s.youId) pushScene(s, "leader", { bill: b.id, boss: boss.id }, `The whip wants a word about ${byId[b.pid].name}`, "The whip's office"); }
  // The debate before your general election.
  if (upThisTerm(s, you) && rw === ELECTION_WEEK - 5) { const opp = `${PF[Math.floor(r() * PF.length)]} ${PL[Math.floor(r() * PL.length)]}`; pushScene(s, "debate", { opp, ch: s.runFor ? "S" : you.ch }, `Debate night against ${opp}`, "Your campaign manager"); }
}
export function prepScene(s0, id) { const s = structuredClone(s0); const m = s.inbox.find((x) => x.id === id); if (m && !m.prep && s.hours >= 4) { m.prep = true; s.hours -= 4; } return s; }
// Apply a played scene. out: { score (-6..6), base, swing, profile, rel: {id: d}, tags }
export function finishScene(s0, id, out) {
  const s = structuredClone(s0); const m = s.inbox.find((x) => x.id === id); if (!m || m.done) return s;
  m.done = true; m.result = { score: out.score, headline: out.headline };
  const sc = m.scene, role = roleOf(s), you = memberById[s.youId], k = clamp(out.score / 6, -1, 1);
  s.baseApproval = clamp(s.baseApproval + (out.base || 0), 5, 99);
  s.approval = clamp(s.approval + (out.swing || 0), 5, 95);
  s.profile = clamp(s.profile + (out.profile || 0), 0, 100);
  for (const [mid, d] of Object.entries(out.rel || {})) s.rel[mid] = clamp((s.rel[mid] || 0) + d, -1, 1);
  if (role === "P") { s.presApproval = clamp(s.presApproval + k * 1.5 + (out.swing || 0) * 0.3, 20, 70); }
  if (sc.type === "hearing") { const c = s.cab.find((x) => x.id === sc.cab); if (c) c.heat = clamp(c.heat + (sc.mine ? 0.08 * k + 0.03 : -0.06 * Math.max(0, k)), 0, 1); }
  if (sc.type === "leader") { const b = s.bills.find((x) => x.id === sc.bill); if (b && out.tags?.includes("deal")) { b.yourVote = true; s.loyalty += 2; s.clout += 2; } if (out.tags?.includes("refuse")) { s.loyalty -= 2; if (b) b.yourVote = false; } }
  if (sc.type === "debate") s.debateBonus = k * 3.5;
  if (sc.type === "oval") { const b = s.bills.find((x) => x.id === sc.bill); if (b && out.tags?.includes("won")) { b.deals[sc.who] = (b.deals[sc.who] || 0) - 0.5; s.know[sc.who] = Math.max(2, s.know[sc.who] || 0); } }
  pushNews(s, out.headline, out.score >= 2 ? "good" : out.score <= -2 ? "bad" : "");
  s.moments.push({ week: s.week, text: out.headline });
  return s;
}
export function sceneCtx() { return { PP, cycleClass }; }
