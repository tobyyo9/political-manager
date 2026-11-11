// Political Manager simulation engine. No screen code in here: the world, the
// members, the vote formula and the weekly loop. Everything random comes from a
// seed, so the same seed and the same choices replay the same history.
import RAW from "./data/members.json";
import GENDER from "./data/gender.json";
import CAUCUS from "./data/caucuses.json";
import TIES from "./data/ties.json";
import RECORD from "./data/record.json";
import { ORGS, orgById } from "./orgs.js";
import { GROUPS } from "./shared/data/typology.js";
import { POLICIES } from "./shared/data/policies.js";
import { PRESIDENT_STANCE } from "./shared/data/president.js";
import { groupScores, byId, tenYearOf } from "./shared/engine.js";
import { IGROUPS, groupById, groupPull, dependence } from "./groups.js";
import { CABINET, BENCH, PRESIDENT } from "./exec.js";
import { VOICES, voiceOf as voiceOf0, line as vline, presRiff, memberStory, OUTLETS, isLoud, nickname, react, billRef } from "./voices.js";
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
  "Progressive wing": "Senate Democrats aligned with Sanders and Warren: Medicare for All, taxes on the rich, skeptical of corporate money. An informal wing; the Senate has no formal ideological caucuses.",
  "Senate Democrats": "The bulk of the Democratic caucus. Follows the leader on most votes.",
  "Moderate Democrats": "Democrats from purple and red states who cut deals and break with the party on taxes, energy and the border. An informal grouping.",
  "MAGA wing": "Republicans closest to the President, or to his base: hard on the border, skeptical of foreign aid, ready to fight. An informal wing.",
  "Senate Republicans": "The bulk of the Republican conference. Follows the leader on most votes.",
  "Institutionalists": "Republicans who defend the Senate's rules and norms, work across the aisle on spending, and sometimes cross the President."
};
// Real caucus rosters (House). Matched by last name and state; seats not on a roster are placed by voting record and flagged estimated.
const normN = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ").trim();
const ROSTER = {};
for (const k of ["Progressive Caucus", "Freedom Caucus", "Blue Dog Coalition"]) ROSTER[k] = CAUCUS[k].split(";").map((e) => e.split(","));
const onRoster = (m, k) => !m.placeholder && !m.custom && ROSTER[k].some(([l, st]) => st === m.st && (normN(m.last) === normN(l) || normN(m.last).endsWith(normN(l)) || normN(l).endsWith(normN(m.last))));
export const CAUCUS_CHAIR = CAUCUS.chairs;
// The Senate has no formal caucuses like the House. Well-known members are placed in the informal wing the press uses for them; everyone else is mainstream.
const WINGS = { "Progressive wing": "Sanders VT,Warren MA,Markey MA,Merkley OR,Van Hollen MD,Welch VT,El-Sayed MI,Flanagan MN,Jackson ME",
  "Moderate Democrats": "Fetterman PA,Cortez Masto NV,Rosen NV,Hassan NH,Kelly AZ,Coons DE,Warner VA,Kaine VA,King ME,Hickenlooper CO,Bennet CO,Pappas NH,Cooper NC,Peltola AK,Colom MS,Turek IA,Hamilton KS,Andrews SC,Slotkin MI",
  "MAGA wing": "Lee UT,Johnson WI,Scott FL,Blackburn TN,Moreno OH,Banks IN,Schmitt MO,Moore AL,Cruz TX,Hawley MO,Hagerty TN,Lummis WY,Sheehy MT,Paul KY",
  "Institutionalists": "Murkowski AK,Grassley IA,Capito WV,Young IN,Cassidy LA,Moran KS,Curtis UT,Rounds SD,Boozman AR,Wicker MS,Thune SD" };
const WING_OF = {}; for (const [w, list] of Object.entries(WINGS)) for (const e of list.split(",")) WING_OF[e] = w;
function senateWings(ms) { for (const m of ms) if (m.ch === "S") { const w = WING_OF[`${m.last} ${m.st}`]; m.faction = w || (m.p === "D" ? "Senate Democrats" : "Senate Republicans"); m.cauEst = !w; m.caucus = [m.faction]; } }
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
  for (const m of ms) m.g = m.g || GENDER[m.id] || (noise(m.id + "g") > 0 ? "F" : "M");
  ms.filter((m) => m.gen).forEach((m, k) => { m.first = m.sf = PF[(k * 7) % PF.length]; m.last = m.sl = PL[k % PL.length]; m.placeholder = true; });
  // Committee posts in the data are already set for the 120th Congress (Democrats chair).
  for (const m of ms) for (const c of m.comm || []) c.role = c.title || "";
  for (const ch of ["H", "S"]) {
    const q = {};
    for (const p of ["D", "R"]) { const xs = ms.filter((m) => m.ch === ch && m.p === p).map((m) => m.x).sort((a, b) => a - b); q[p] = p === "D" ? [xs[Math.floor(xs.length * 0.3)], xs[Math.floor(xs.length * 0.7)]] : [xs[Math.floor(xs.length * 0.3)], xs[Math.floor(xs.length * 0.8)]]; }
    for (const m of ms) if (m.ch === ch) m.faction = factionOf(m, q);
  }
  houseCaucus(ms);
  senateWings(ms);
  for (const m of ms) m.fund = fundOf(m);
  for (const m of ms) derive(m);
  return ms;
}
// Where a member's money comes from (estimated from role, ideology and committees; a few known pledges are set by hand).
const NO_CORP_PAC = new Set(["Sanders VT", "Warren MA", "Ocasio-Cortez NY", "Tlaib MI", "Pressley MA", "Omar MN", "Khanna CA", "Jayapal WA", "Casar TX", "Hawley MO"]);
const MONEY_COMM = { HSWM: ["chamber", "pharma"], HSBA: ["chamber"], HSIF: ["pharma", "tech", "energy"], HSAP: ["defense", "chamber"], HSAS: ["defense"], HSAG: ["chamber"], HSPW: ["chamber"],
  SSFI: ["chamber", "pharma"], SSBK: ["chamber"], SSCM: ["tech"], SSAP: ["defense", "chamber"], SSAS: ["defense"], SSHR: ["pharma"], SSEG: ["energy"] };
const ENERGY_ST = new Set(["TX", "OK", "WV", "ND", "WY", "LA", "AK", "NM", "PA"]);
function fundOf(m) {
  const h = noise(m.id + "fund"), left = m.p === "D" && (m.faction === "Progressive Caucus" || m.faction === "Progressive wing"), right = m.p === "R" && (m.faction === "Freedom Caucus" || m.faction === "MAGA wing");
  let pac = m.ch === "H" ? 0.38 : 0.16, large = m.ch === "H" ? 0.4 : 0.54, small = m.ch === "H" ? 0.22 : 0.3;
  if (left) { small += 0.25; pac -= 0.17; } else if (m.p === "D" && /Moderate|Blue Dog|New Democrat/.test(m.faction || "")) pac += 0.08;
  if (right) { small += 0.17; pac -= 0.1; } else if (/Main Street|Institutionalists/.test(m.faction || "")) pac += 0.08;
  const posts = (m.comm || []).filter((c) => /Chair|Ranking/.test(c.role || c.title || "")).length + (m.lead?.length ? 1 : 0);
  pac += posts * 0.07; small += h * 0.08; large -= h * 0.04;
  const pledge = NO_CORP_PAC.has(`${m.last} ${m.st}`);
  if (pledge) { small += pac - 0.03 + large * 0.4; large *= 0.6; pac = 0.03; }
  const tot = pac + large + small; pac /= tot; large /= tot; small /= tot;
  const sec = new Set(); for (const c of m.comm || []) for (const g of MONEY_COMM[c.c] || []) sec.add(g);
  if (ENERGY_ST.has(m.st) && m.p === "R") sec.add("energy");
  if (pledge) sec.clear();
  if (m.p === "D") sec.add("labor"); else sec.add("lowtax");
  return { pac: Math.round(pac * 100) / 100, large: Math.round(large * 100) / 100, small: Math.round(small * 100) / 100, sectors: [...sec].slice(0, 4), pledge };
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
// Real crossover votes from 2025-26 (src/data/record.json): a member who broke with their party on an issue tends to again.
const REC = {}; for (const [ch, last, st, pid, v] of RECORD.votes) { const m = MEMBERS.find((x) => x.ch === ch && x.last === last && x.st === st); if (m) (REC[m.id] = REC[m.id] || {})[pid] = v; }
export const recordOf = (id) => REC[id] || {};
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
  const X = m.p === PP ? presS * A * (ctx.kind === "override" ? 2 : 1) : bill.bipartisan || bill.mustPass ? 0 : -bill.pres * PSIGN() * 0.6;
  const F = factionC(bill, ctx.sponsor, m.faction, m.ch);
  const pledge = bill.tax && m.signer ? -1 : 0;
  const gp = groupPull(m, pid, noise);
  const G = gp.G;
  const B = (ctx.boost?.[pid] || 0) + (m.p === PP ? Math.max(0, ctx.wh || 0) * 0.5 : 0) - (ctx.fil && m.ch === "S" && m.p === ctx.fil.p ? ctx.fil.w : 0) + (ctx.amends || []).reduce((a, x) => a + (x.p === m.p ? x.w : 0), 0);                           // public pressure after an event
  const T = ctx.trust?.[m.id] || 0;
  const K = ctx.deals?.[m.id] || 0;
  const eps = noise(`${ctx.seed}:${m.id}:${pid}:${ctx.kind || "p"}`) * W.eps * 2;
  const Rv = (REC[m.id]?.[pid] || 0) * (memberById[m.id] === m && !m.fictional ? 0.8 : 0);
  const terms = { R: Rv, C: W.C * C, D: W.D * m.vuln * bill.sal * D, P: W.P * m.prisk * P, L: W.L * lam * Y, X: W.X * X, F: W.F * F, G: W.G * G + (pledge ? -0.22 : 0), T: W.T * T, K, B, eps };
  const L = Object.values(terms).reduce((a, b) => a + b, 0);
  return { L, p: sig(W.k * L), terms, raw: { C, D, P, Y, X, F, pledge, G }, groups: gp.who };
}
export const REASONS = {
  R: ["they broke with their party on this before", "they broke with their party against this before"],
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
  pacs: { label: "Corporate PAC fundraiser", hours: 6, role: "HS" }, smalldollar: { label: "Small-dollar email blast", hours: 3, role: "HS" },
  petition: { label: "File a discharge petition", hours: 6, role: "H" }, signpet: { label: "Sign a discharge petition", hours: 1, role: "H" }, privileged: { label: "Force a privileged vote", hours: 4, role: "HS" },
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
  mpSeed(s); courtSeed(s); earnSeed(s);
  startRelations(s, you);
  s.money = { small: Math.round(s.cash * you.fund.small), large: Math.round(s.cash * you.fund.large), pac: Math.round(s.cash * you.fund.pac) }; s.pledge = !!you.fund.pledge; s.ties = {};
  for (const g of you.fund.sectors) if (!["labor", "lowtax"].includes(g) && !s.pledge) s.ties[g] = Math.round(s.cash * you.fund.pac / Math.max(1, you.fund.sectors.length));
  seedBills(s);
  if (you.ch === "S") pushInbox(s, { kind: "staff", from: "Your chief of staff", title: upIn2028(you) ? "You're on the ballot in 2028" : "You're not up until " + (you.cls === 1 ? 2030 : 2032), body: upIn2028(you) ? "Your seat is one of the 34 up in November 2028. Six years usually buys freedom; you don't have it." : "No election this Congress. That buys you room to take hard votes, but leadership, donors and the President still keep score. At the end of 2028 you'll get a verdict on your term." });
  pushInbox(s, { kind: "staff", from: "Your chief of staff", title: "Welcome to the 120th Congress", body: `You have ${HOURS} hours a week. Spend them on colleagues, your district, donors and bills. Votes come to the floor most weeks; I'll flag the ones that matter at home. The election is ${fmtDate(ELECTION_WEEK)}.` });
  return s;
}
const R = (s, tag) => rng(hash(`${s.seed}:${tag}:${s.week}:${s.n++}`));
function pushInbox(s, msg) { if (aboutPres(msg.body) || aboutPres(msg.title) || /White House|Situation Room|Staff secretary/.test(msg.from || "")) msg = { ...msg, title: presPron(msg.title), body: presPron(msg.body) }; s.inbox.unshift({ id: `m${s.week}-${s.inbox.length}-${s.n++}`, week: s.week, done: false, ...msg }); }
// The President's pronouns: the real one is a man; a fictional successor may be a woman.
const PRON = { he: "she", He: "She", him: "her", Him: "Her", his: "her", His: "Her", himself: "herself", Himself: "Herself" };
export const presPron = (t) => (PRES_M.g !== "F" || !t ? t : t.replace(/\b(he|He|him|Him|his|His|himself|Himself)\b/g, (w) => PRON[w]));
const aboutPres = (t) => /\bPresident\b|White House/.test(t || "");
const pName = (p) => (p === "D" ? "Democrats" : "Republicans");
function pushNews(s, text, tone = "") { if (aboutPres(text)) text = presPron(text); s.news.unshift({ week: s.week, text, tone }); if (s.news.length > 120) s.news.pop(); }

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
  if (act === "petition") { const b = s.bills.find((x) => x.id === arg.bill); if (b && canPetition(s, b)) { newPetition(s, b, s.youId); defyLeaders(s, 2); s.profile = clamp(s.profile + 3, 0, 100);
    pushNews(s, `${nameOf(you)} files a discharge petition to force a vote on ${byId[b.pid].name}.`, "event");
    s.toast = { title: "Petition filed", text: `It needs 218 signatures. ${you.p === houseMaj() ? "You just went around your own leadership, and they noticed." : "Your party will mostly sign. The fight is for majority members willing to defy their leaders; whip them from the Bills tab."}`, tone: "good" }; } else s.hours += ACTIONS.petition.hours; }
  if (act === "signpet") { const p = (s.petitions || []).find((x) => x.id === arg.id); if (p && !p.sigs[s.youId] && p.status === "open") { p.sigs[s.youId] = 1; p.n++; defyLeaders(s, 1); s.profile = clamp(s.profile + 1, 0, 100); s.toast = { title: "You signed", text: `Signature ${p.n} of 218.`, tone: "good" }; } else s.hours += 1; }
  if (act === "privileged") { const b = s.bills.find((x) => x.id === arg.bill); if (b && PRIVILEGED[b.pid] && !b.dead && b.stage === "committee" && !b.privileged) { b.privileged = b.discharged = b.marked = true; b.floorWeek = s.week + 2; s.profile = clamp(s.profile + 2, 0, 100);
    pushNews(s, `${nameOf(you)} uses ${PRIVILEGED[b.pid]} to force a vote on ${byId[b.pid].name}. Leaders can't stop it.`, "event");
    s.toast = { title: "You forced a vote", text: `Under ${PRIVILEGED[b.pid]}, the vote comes in about two weeks${you.ch === "S" ? ", and it needs only 51 in the Senate: no filibuster" : ""}. Everyone has to go on the record.`, tone: "good" }; } else s.hours += ACTIONS.privileged.hours; }
  if (act === "funds") { const amt = Math.round((40 + s.profile * 0.9 + you.seniority * 2 + r() * 50) * (you.chair ? 1.4 : 1)); s.cash += amt; addMoney(s, "large", amt); s.toast = { title: "Call time", text: `Four hours on the phone. You raised $${amt}K.`, tone: "good" }; }
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
    if (x < odds * 0.5) { b.wh = (b.wh || 0) + 0.3 * (1 - 0.7 * firm); s.rapport = clamp(s.rapport + 0.2, -1, 1); s.toast = { title: "The President is charmed", text: presPron(`The meeting runs long. He tells reporters ${byId[b.pid].name} "could be a very good bill."`), tone: "good" }; }
    else if (x < odds) { b.wh = (b.wh || 0) + 0.15 * (1 - 0.7 * firm); s.rapport = clamp(s.rapport + 0.08, -1, 1); s.toast = { title: presPron("He's open to it"), text: presPron("No commitment, but his staff says he is listening."), tone: "good" }; }
    else if (x < odds + (1 - odds) * 0.7) s.toast = { title: "No commitment", text: you.p === "D" ? "You get fifteen minutes with a deputy. Building a name in Washington would get you further." : presPron("He talks about other things. You leave with a photo."), tone: "" };
    else { b.wh = (b.wh || 0) - 0.1; s.rapport = clamp(s.rapport - 0.15, -1, 1); pushNews(s, `The President attacks ${byId[b.pid].name} after a meeting with ${nameOf(you)}.`, "bad"); s.toast = { title: "It blew up", text: presPron("He posts about the meeting that night. His allies in Congress take note."), tone: "bad" }; }
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
  if (act === "pacs") {
    if (s.pledge) { s.hours += ACTIONS.pacs.hours; s.toast = { title: "You took the pledge", text: "No corporate PAC money. That's the point.", tone: "" }; return s; }
    const sec = you.fund?.sectors.filter((g) => g !== "labor" && g !== "lowtax") || [], g = sec.length ? sec[Math.floor(r() * sec.length)] : "chamber";
    const amt = Math.round((90 + s.clout * 2.2 + (you.chair ? 120 : 0) + (you.lead?.length ? 150 : 0) + r() * 60));
    s.cash += amt; addMoney(s, "pac", amt); s.ties = s.ties || {}; s.ties[g] = (s.ties[g] || 0) + amt;
    const left = you.p === "D" && /Progressive/.test(you.faction || ""), pop = you.p === "R" && /Freedom|MAGA/.test(you.faction || "");
    if (left || pop) s.baseApproval = clamp(s.baseApproval - 2.5, 5, 95);
    pushNews(s, `${titleOf(you)} ${nameOf(you)} holds a fundraiser with ${groupById[g]?.name || "industry"} PACs.`);
    s.toast = { title: `$${amt}K from the ${groupById[g]?.model || "industry"} crowd`, text: `Big checks, fast. ${groupById[g]?.name || "They"} will remember it, and they'll call when their bills come up.${left || pop ? " Your base noticed who was in the room." : ""}`, tone: "good" };
  }
  if (act === "smalldollar") {
    const v = voiceOf(you), loud = v === "firebrand" || v === "showboat" || v === "devotee";
    const amt = Math.round((15 + s.profile * 1.3 + Math.max(0, s.baseApproval - 55) * 1.6) * (loud ? 1.5 : 1) * (0.8 + r() * 0.4));
    s.cash += amt; addMoney(s, "small", amt); s.baseApproval = clamp(s.baseApproval + 0.6, 5, 95);
    s.toast = { title: `$${amt}K from ${Math.round(amt * 1000 / 34).toLocaleString()} donors`, text: `An average gift of about $34. ${amt < 60 ? "A bigger national profile would raise more." : "Your list is working."} Nobody on it will ask you for a favor.`, tone: "good" };
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
        for (const t of realTies(m.id)) if (t.k !== "feud" && memberById[t.id]?.ch === m.ch) b.deals[t.id] = (b.deals[t.id] || 0) + 0.08;   // close friends tend to move together
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
  if (m.kind === "donor") donorAnswer(s, m, choice);
  if (m.kind === ATTACK_KEY) answerAttack(s, m, choice);
  if (["crisis", "crisisreact", "pardon", "pardonreact", "scotusnom", "scotusvote", "blueslip", "ruling"].includes(m.kind)) answerWorld(s, m, choice);
  if (m.kind === "moneyscandal") answerScandal(s, m, choice);
  if (m.kind === "orgmeet" || m.kind === "orgoffer" || m.kind === "foreign") answerOrg(s, m, choice);
  if (m.kind === "fundask" || m.kind === "potask") answerMoney(s, m, choice);
  if (m.kind === "petask" && choice === 0) { const p = (s.petitions || []).find((x) => x.id === m.pet); if (p && !p.sigs[s.youId] && p.status === "open") { p.sigs[s.youId] = 1; p.n++; defyLeaders(s, 1); s.profile = clamp(s.profile + 1, 0, 100); } }
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
  donorWeek(s, R(s, "donor"));
  campaignWeek(s, R(s, "camp"));
  moneyWeek(s, R(s, "money"));
  if (roleOf(s) !== "P" || s.week % 2 === 0) petitionWeek(s, R(s, "pet"));
  courtWeek(s, R(s, "court"));
  crisisWeek(s, R(s, "crisis"));
  pardonWeek(s, R(s, "pardon"));
  sotuWeek(s, R(s, "sotu"));
  earnWeek(s, R(s, "earn"));
  orgWeek(s, R(s, "org"));
  foreignWeek(s, R(s, "foreign"));
  wireWeek(s, R(s, "wire"));
  { const rr = R(s, "react"); for (const ev of events.slice(0, 2)) voteReactions(s, ev, rr); }
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
  if (b.party === "R" && !b.discharged) {
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
  const needOf = (ch) => (ch === "H" ? (info.amendment ? NEED.H.amendment : NEED.H.passage) : info.amendment ? NEED.S.amendment : b.route === "reconciliation" || b.privileged ? NEED.S.reconciliation : NEED.S.passage);
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
function enact(s, b) { b.stage = "law"; s.laws.push(b.pid); docketLaw(s, b.pid, rng(hash(`${s.seed}:dock:${b.id}`))); if (b.sponsor === s.youId) { s.legis += 12; s.clout += 6; s.profile += 5; } else if (b.cos.includes(s.youId)) s.legis += 2; }
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
  const strength = s.baseApproval + fit * 8 + Math.min(10, s.cash / 400) - (you.prisk > 0.5 ? 6 : 0) + gp.net - (s.rivals || 0) * 3 - (memberById[s.youId].p === "D" && memberById[s.youId].prisk > 0.4 ? Math.max(0, moneyMix(s).pac - 0.45) * 20 : 0) + (s.pledge ? 3 : 0);
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
  electionNight(s);
  const you = memberById[s.youId];
  const env = you.p === "D" ? s.mood : -s.mood;                       // national swing toward your party, in points
  const lean2 = (you.own - 50) * 2;                                   // the seat's 2024 margin for your party
  const gg = groupElection(s, "general");
  const margin = projMargin(s) + (r() - 0.5) * 5; void lean2;
  // The whole House moves with the mood.
  let d = 0; for (const m of HOUSE) { const mm = (m.dem - 50) * 2 + s.mood * 0.9 + (m.p === "D" ? 3 : -3) + noise(`${s.seed}:gen:${m.id}`) * 5 + aidPts(s, m); if (m.id === s.youId ? (you.p === "D" ? margin > 0 : margin <= 0) : mm > 0) d++; }
  s.over = true;
  s.result = { kind: "general", margin: Math.round(margin * 10) / 10, won: margin > 0, houseD: d, env: Math.round(env * 10) / 10, groups: gg, opp: s.opp ? { name: `${s.opp.first} ${s.opp.last}`, raised: Math.round(s.opp.raised) } : null, spent: Math.round(s.camp?.spent || 0) };
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
  if (m.ch === "S") m.faction = senFaction(m);
  m.caucus = [m.faction]; m.cauEst = false;
  m.fund = fundOf(m);
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
export const RAPPORT = (r) => (r <= -0.3 ? "Hostile" : r < -0.05 ? "Cold" : r < 0.15 ? presPron("He barely knows you") : r < 0.45 ? "Friendly" : "Charmed");

// ── The President: reactions, non sequiturs and sudden reversals ──
const P_LOVE = ["calls it \"a beautiful bill, maybe the best ever written\"", "says he will sign it \"so fast your head will spin\"", "takes credit for the idea"];
const P_HATE = ["calls it \"a disaster, a total disaster\"", "says whoever wrote it \"should be ashamed\"", "promises a veto \"on day one, maybe sooner\""];
const P_MEH = ["says he \"hasn't read it, but people are saying things\"", "says he \"could go either way, we'll see what happens\"", "says he will decide \"in two weeks\""];
const P_ODD = ["Then he spends ten minutes on the White House ballroom.", "He adds that the bill should be named after him.", "He also says the Senate \"should be bigger, much bigger, or maybe smaller.\"", "He closes by floating a military parade for his birthday.", "He then rates the Speaker's suit a six out of ten.", "He ends with a long story about a golf course in Scotland."];
function presPost(s, text, pid) { text = presPron(text); s.pres.unshift({ week: s.week, text, pid }); if (s.pres.length > 40) s.pres.pop(); }
function whiteHouse(s, r) {
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee" || b.presSaid) continue;
    b.presSaid = true;
    const v = presView(s, b), pick = (a) => a[Math.floor(r() * a.length)];
    const plain = PRES_M.fictional, line = v.score > 0.3 ? pick(plain ? ["says it's a good bill and urges Congress to pass it", "endorses it in a written statement"] : P_LOVE) : v.score < -0.2 ? pick(plain ? ["says it goes too far and signals a veto", "calls it the wrong approach"] : P_HATE) : pick(plain ? ["says the White House is still reviewing it", "won't commit either way"] : P_MEH);
    presPost(s, `On ${byId[b.pid].name}, the President ${line}.${r() < 0.35 && voiceOf(PRES_M) === "bombast" ? ` Then, unprompted: "${presRiff(r).quote}"` : ""}`, b.pid);
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
    pushNews(s, `The President reverses himself on ${byId[b.pid].name}. ${pName(PP)} scramble to adjust.`, "event");
    pushInbox(s, { kind: "staff", from: `${s.staff[0].name}, chief of staff`, title: `He flipped on ${byId[b.pid].name}`, body: `The President ${up ? "came out for it" : "turned against it"} overnight. Every ${PP === "R" ? "Republican" : "Democratic"} count on that bill just changed. Look at the whip board again.`, done: true });
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
// Real friendships, alliances and feuds that are public knowledge (src/data/ties.json).
const TIE = {}; for (const t of TIES) { (TIE[t.a] = TIE[t.a] || []).push({ id: t.b, k: t.k, why: t.why }); (TIE[t.b] = TIE[t.b] || []).push({ id: t.a, k: t.k, why: t.why }); }
export const realTies = (id) => TIE[id] || [];
export function bonds(m) {
  if (bondCache[m.id]) return bondCache[m.id];
  const real = (TIE[m.id] || []).filter((t) => memberById[t.id] && !memberById[t.id].fictional);
  const realF = real.filter((t) => t.k !== "feud").map((t) => ({ m: memberById[t.id], why: t.why, real: true })), realR = real.filter((t) => t.k === "feud").map((t) => ({ m: memberById[t.id], why: t.why, real: true }));
  const skip = new Set(real.map((t) => t.id));
  const pool = MEMBERS.filter((o) => o.id !== m.id && o.ch === m.ch);
  const shareComm = (o) => (m.comm || []).filter((c) => c.c.length <= 4 && (o.comm || []).some((d) => d.c === c.c)).length;
  const score = (o) => (o.p === m.p ? 0.6 : -0.6) + (o.faction === m.faction ? 0.5 : 0) + (o.st === m.st ? 0.45 : 0) + 0.15 * shareComm(o) - 1.4 * Math.abs(o.x - m.x) + 0.25 * noise(m.id < o.id ? m.id + o.id : o.id + m.id);
  const why = (o) => o.st === m.st && o.p === m.p ? `same ${o.st} delegation` : o.faction === m.faction ? `both ${m.faction}` : shareComm(o) ? "serve on a committee together" : o.p !== m.p ? "cross-party friendship" : "vote alike";
  const whyNot = (o) => o.p === m.p ? (o.faction !== m.faction ? `${o.faction} vs ${m.faction}` : "old feud") : o.st === m.st ? `rivals in ${o.st}` : "opposite ends of the chamber";
  const ranked = pool.map((o) => ({ o, v: score(o) })).sort((a, b) => b.v - a.v);
  const friends = [...realF, ...ranked.filter(({ o }) => !skip.has(o.id)).slice(0, Math.max(1, 4 - realF.length)).map(({ o }) => ({ m: o, why: why(o) }))];
  const sameP = ranked.filter(({ o }) => o.p === m.p && !skip.has(o.id)).slice(-1).map(({ o }) => ({ m: o, why: whyNot(o) }));
  const other = ranked.filter(({ o }) => o.p !== m.p && !skip.has(o.id) && (o.st === m.st || Math.abs(o.x - m.x) > 1)).slice(-1).map(({ o }) => ({ m: o, why: whyNot(o) }));
  return (bondCache[m.id] = { friends, rivals: [...realR, ...(realR.length ? [] : sameP), ...other].slice(0, 3) });
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
  mpSeed(s); courtSeed(s); earnSeed(s);
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
  for (const e of s.eos) if (e.alive && e.court === s.week) { e.alive = false; if (s.court && !s.court.docket.some((k) => k.pid === e.pid && !k.done)) { const y = gameYear(s), w = weekOfDate(s, y, 5, 27); s.court.docket.push({ id: `eo${e.pid}${s.week}`, name: `The President's order on ${byId[e.pid].name}`, pid: e.pid, kind: "eo", week: w - s.week >= 8 ? w : weekOfDate(s, y + 1, 5, 27) }); } s.presApproval -= 0.8; s.presHeat = clamp(s.presHeat + 0.03, 0, 1); s.legacy -= 1; pushNews(s, `A federal judge blocks the President's order on ${byId[e.pid].name}.`, "bad"); presPost(s, `The President calls the judge who blocked his order on ${byId[e.pid].name} "a total disgrace."`, e.pid); }
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
  electionNight(s); const map = s.night.pres;
  const won = map.winner === PP, margin = map.nat * (PP === "D" ? 1 : -1);
  s.over = true;
  s.result = { kind: "pres", won, margin: Math.round(margin * 10) / 10, ev: map.ev, approval: Math.round(s.presApproval), laws: s.laws.length, vetoes: s.vetoes, eos: (s.eos || []).filter((e) => e.alive).length, legacy: s.legacy };
  pushNews(s, `Election night 2028: the Republican nominee ${won ? "wins" : "loses"}, ${map.ev.R} electoral votes to ${map.ev.D}.`, won ? "good" : "bad");
}
// Senators who aren't on the 2028 ballot: a verdict on the term instead of an election.
function termReview(s, r) {
  electionNight(s);
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
  if (ok) { mp.stage = "law"; for (const x of mp.riders) if (!s.laws.includes(x.pid)) s.laws.push(x.pid); earSettle(s, mp);
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
const senFaction = (m) => WING_OF[`${m.last} ${m.st}`] || (m.p === "D" ? (m.x < -0.6 ? "Progressive wing" : m.x > -0.2 ? "Moderate Democrats" : "Senate Democrats") : m.x > 0.65 ? "MAGA wing" : m.x < 0.3 ? "Institutionalists" : "Senate Republicans");
function regroup() { houseCaucus(MEMBERS); for (const m of SENATE) if (!m.faction || m.fictional || !m.caucus || m.caucus.length === 0 || HOUSE_FACTIONS.has(m.faction)) { m.faction = senFaction(m); m.caucus = [m.faction]; } }
const HOUSE_FACTIONS_X = 0; const HOUSE_FACTIONS = new Set(["Progressive Caucus", "New Democrat Coalition", "Blue Dog Coalition", "Democrats, no bloc", "Freedom Caucus", "Republican Study Committee", "Main Street Caucus"]);
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
  derive(m); m.fund = fundOf(m); keep(s, m);
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
    const margin = (m.dem - 50) * 2 + s.mood * (m.ch === "H" ? 0.9 : 0.8) + inc * (m.ch === "H" ? 4 : 4) + n * (m.ch === "H" ? 5 : 6) + aidPts(s, m);
    const winner = margin > 0 ? "D" : "R";
    const retires = noise(`${s.seed}:ret${s.term}:${m.id}`) < -0.86 || (YEAR + 1 - (m.born || 1960) > 82);
    if (winner !== m.p) { out.flips[m.ch]++; newcomer(s, m, winner, year); backersWin(s, m, year); }
    else if (retires) { out.retire++; newcomer(s, m, m.p, year); }
  }
  // The White House, every four years.
  let presMsg = "";
  if (s.term % 2 === 1) {
    const map = s.lastPres && s.lastPres.year === year ? s.lastPres : presMap(s, true); s.lastPres = map;
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
  const fundedSeats = [...new Set([...Object.keys(s.alloc || {}), ...Object.keys(s.given || {}), ...Object.values(s.cands || {}).filter((c) => c.backed).map((c) => c.seat)])], mineP = memberById[s.youId].p;
  const w = electWorld(s);
  const fundedWon = fundedSeats.filter((id) => memberById[id]?.p === mineP).length;
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.debateBonus = 0; s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null; s.primary = null; s.rivals = 0; s.endorsed = false;
  s.bills = []; s.youOwe = []; s.promises = []; s.flags.punished = s.flags.rewarded = false; s.inbox = s.inbox.filter((m) => !m.done).slice(0, 0); s.trend = [];
  s.noms = s.noms.filter((n) => !n.done); s.imp = s.imp.filter((i) => !i.done); s.runFor = null;
  s.clout += 4; s.profile = clamp(s.profile + 3, 0, 100); s.approval = clamp(s.approval * 0.6 + 52 * 0.4, 5, 95);
  const you = memberById[s.youId]; derive(you); keep(s, you);
  seedBills(s); mpSeed(s);
  s.opp = null; s.camp = null; s.polls = []; s.dues = { paid: 0 }; s.aid = {}; s.alloc = {}; s.given = {}; s.askedHelp = null; s.petitions = [];
  if (fundedSeats.length) pushInbox(s, { kind: "staff", from: "Your finance director", title: `Your money on the map: ${fundedWon} of ${fundedSeats.length}`, done: true, body: `Of the ${fundedSeats.length} races you put money or time into, your party won ${fundedWon}.${(s.backedWon || []).filter((x) => x.year === electionYear({ ...s, term: s.term - 1 })).length ? ` New members you backed as challengers: ${(s.backedWon || []).filter((x) => x.year === electionYear({ ...s, term: s.term - 1 })).map((x) => x.name).join(", ")}. They start out in your corner.` : ""}` });
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
    const backed = Object.keys(s.given || {}).filter((id) => memberById[id]?.p === you.p).length + (s.backedWon || []).length, dg = duesGoal(you);
    const odds = clamp(0.08 + s.clout / 180 + avgRel * 3 + s.loyalty * 0.025 + you.seniority * 0.01 + Math.min(0.12, backed * 0.012) + (dg ? Math.min(1, (s.dues?.paid || 0) / dg) * 0.08 - 0.04 : 0.03), 0.03, 0.8);
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
  electionNight(s);
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
    const inc = m.p === "D" ? 1 : -1, base = (m.dem - 50) * 2 + s.mood * 0.8 + inc * 4 + aidPts(s, m);
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
  const COOL = { tv: 7, hearing: 9, leader: 6, briefing: 4, oval: 5, debate: 0, sotu: 0, confirm: 0 }; s.sceneAt = s.sceneAt || {};
  if (s.week - (s.sceneAt[type] ?? -99) < COOL[type]) return null; s.sceneAt[type] = s.week;
  s.sceneN = s.sceneN || {}; const nth = s.sceneN[type] = (s.sceneN[type] || 0) + 1;
  const msg = { kind: "scene", scene: { type, n: nth - 1, ...ctx }, from, title, body: "", due: s.week + SCENE_DUE };
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
  if (upThisTerm(s, you) && rw === ELECTION_WEEK - 5) { const opp = s.opp && !s.runFor ? `${s.opp.first} ${s.opp.last}` : `${PF[Math.floor(r() * PF.length)]} ${PL[Math.floor(r() * PL.length)]}`; pushScene(s, "debate", { opp, ch: s.runFor ? "S" : you.ch, ...(s.opp && !s.runFor ? { oppG: s.opp.g, oppId: `opp${s.seed}${s.opp.first}${s.opp.last}` } : {}) }, `Debate night against ${opp}`, "Your campaign manager"); }
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
  if (sc.type === "sotu") { s.mood = clamp(s.mood - PSIGN() * k * 0.4, -12, 12); s.clout += k * 4; for (const b of s.bills) if (!b.dead && b.party === PP) b.wh = (b.wh || 0) + 0.1 * Math.max(0, k); }
  if (sc.type === "confirm" && s.court?.nom) { const opp = memberById[s.youId].p !== s.court.nom.by; s.court.nom.cont = clamp(s.court.nom.cont + (opp ? 0.12 : -0.08) * k, 0, 1); }
  if (sc.type === "oval") { const b = s.bills.find((x) => x.id === sc.bill); if (b && out.tags?.includes("won")) { b.deals[sc.who] = (b.deals[sc.who] || 0) - 0.5; s.know[sc.who] = Math.max(2, s.know[sc.who] || 0); } }
  pushNews(s, out.headline, out.score >= 2 ? "good" : out.score <= -2 ? "bad" : "");
  s.moments.push({ week: s.week, text: out.headline });
  return s;
}
export function sceneCtx() { return { PP, cycleClass }; }

// ════════ Saving, loading and the hall of fame ════════
export const SAVE_VERSION = 1;
export function exportSave(s, real) { return JSON.stringify({ game: "political-manager", v: SAVE_VERSION, saved: new Date().toISOString(), real: !!real, s }); }
export function importSave(text) {
  const o = JSON.parse(text);
  if (!o || o.game !== "political-manager" || !o.s || typeof o.s.youId !== "string" || !Number.isFinite(o.s.week)) throw new Error("That file isn't a Political Manager save.");
  const s = o.s;
  if (s.youId !== "POTUS" && !memberById[s.youId] && !s.edits?.[s.youId]) throw new Error("This save names a member the game doesn't know.");
  restore(s); if (s.custom) applyCustom(s.custom); if (!s.edits || !Object.keys(s.edits).length) { if (!s.custom) { resetWorld(); applyPres(s); } }
  return { s, real: !!o.real };
}
// One line for the hall of fame when a career ends.
export function fameEntry(s, real) {
  const you = memberById[s.youId], r = s.result || {}, role = roleOf(s);
  const laws = s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law").length + (s.career || []).reduce((a, c) => a + (c.laws || 0), 0);
  const terms = (s.career || []).length + 1;
  const verdict = r.kind === "general" ? (r.won ? "Reelected" : "Defeated") : r.kind === "primary" ? "Lost the primary" : r.kind === "term" ? "Finished the term" : r.kind === "higher" ? (r.won ? "Won a Senate seat" : "Lost a Senate run") : r.kind === "pres" ? (r.won ? "Party held the White House" : "Party lost the White House") : r.kind === "removed" ? "Removed from office" : r.kind === "indicted" ? "Indicted and resigned" : "Ended";
  const score = Math.round((r.won ? 40 : 0) + terms * 15 + laws * 6 + Math.max(0, s.clout) * 0.3 + (role === "P" ? (s.presApproval - 40) * 1.5 + (s.legacy || 0) * 2 : 0) + (you.lead?.length ? 15 : 0));
  return { id: `${s.seed}-${s.youId}`, upto: s.week, when: new Date().toISOString(), name: role === "P" ? `President ${nameOf(you, real)}` : `${titleOf(you)} ${nameOf(you, real)}`, real: `${you.first} ${you.last}`, alt: `${you.sf} ${you.sl}`,
    role, party: you.p, seat: you.seat, terms, years: `2027-${electionYear(s)}`, verdict, won: !!r.won, laws, title: you.lead?.[0] || "", score, custom: !!s.custom, earned: Math.round(earnTotal(s)) };
}

// ════════ Personalities and the press ════════
export const voiceOf = (m) => voiceOf0(m, PP);
export { VOICES };
function pushWire(s, a) { if (a.voice === "devotee" || (a.who === "POTUS" && !a.target)) a = { ...a, quote: presPron(a.quote), headline: presPron(a.headline), dek: presPron(a.dek) }; (s.wire = s.wire || []).unshift({ week: s.week, ...a }); if (s.wire.length > 80) s.wire.pop(); pushNews(s, `${a.outlet}: ${a.headline}`, a.tone || ""); s.news[0].ids = [a.who, a.target].filter(Boolean); }
// Every week the papers fill up: the President riffs, members say things in their own voice, votes get reactions.
function wireWeek(s, r) {
  const role = roleOf(s), outlet = () => OUTLETS[Math.floor(r() * OUTLETS.length)], P = PRES_M, pv = voiceOf(P);
  // The President, on whatever is on his mind.
  if (r() < (pv === "bombast" ? 0.65 : 0.25)) {
    const q = pv === "bombast" ? presRiff(r) : { quote: vline(pv, "press", {}, r), subject: "the press", dek: "Reporters noted the change in tone." };
    if (role === "P") { pushWire(s, { outlet: outlet(), who: "POTUS", voice: pv, headline: pv === "bombast" ? `Overnight, your account posted about ${q.subject}` : "Your remarks to reporters make the rounds", quote: q.quote, dek: q.dek });
      if (pv === "bombast") { s.baseApproval = clamp(s.baseApproval + 0.3, 5, 99); s.presApproval = clamp(s.presApproval - 0.1, 20, 70); } }
    else pushWire(s, { outlet: outlet(), who: "POTUS", voice: pv, headline: pv === "bombast" ? `President on ${q.subject}: "${q.head}"` : "President takes questions on the South Lawn", quote: q.quote, dek: q.dek });
  }
  // The President goes after someone by nickname now and then.
  if (pv === "bombast" && r() < 0.18) { const pool = MEMBERS.filter((m) => m.p !== PP && (m.lead?.length || isLoud(voiceOf(m)))); const m = pool[Math.floor(r() * pool.length)];
    const nick = m && nickname(m.sl, r);
    if (m) pushWire(s, { outlet: outlet(), who: "POTUS", target: m.id, voice: pv, headline: `President dubs ${titleOf(m)} ${m.sl} "${nick}"`, quote: `${nick}? Total lightweight. Nobody likes ${m.g === "F" ? "her" : "him"}, even ${m.g === "F" ? "her" : "his"} own people.`, dek: `${titleOf(m)} ${m.sl}'s office answered with a fundraising email.` }); }
  // Members in their own voices: loud ones make news most weeks; the quiet ones now and then.
  const n = 1 + (r() < 0.6 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
  const live = s.bills.filter((b) => !b.dead && b.stage === "committee");
  for (let i = 0; i < n; i++) {
    const loud = r() < 0.75, pool = MEMBERS.filter((m) => m.id !== s.youId && (loud ? isLoud(voiceOf(m)) : !isLoud(voiceOf(m))));
    const m = pool[Math.floor(r() * pool.length)]; if (!m) continue;
    const b = live[Math.floor(r() * Math.max(1, live.length))], bill = b ? billRef(byId[b.pid].name) : "the spending bill";
    const stance = b ? (lean(m, b.pid, billCtx(s, b)).L > 0 ? "for" : "against") : "against";
    const st = memberStory(m, voiceOf(m), { name: nameOf(m), title: titleOf(m), bill, stance }, r);
    pushWire(s, { outlet: outlet(), who: m.id, voice: voiceOf(m), headline: st.headline, quote: st.quote, pid: b?.pid });
  }
}
// After a vote, someone always has something to say.
function voteReactions(s, ev, r) {
  if (!ev?.pid || !ev.house) return;
  const pass = ev.result === "signed" || ev.result === "overridden" || ev.result === "desk" || ev.result === "states";
  const voters = Object.entries(ev.house.votes || {}).filter(([id]) => id !== s.youId).map(([id, v]) => [memberById[id], v]).filter(([m]) => m);
  if (r() < 0.45) return;
  const sayers = voters.filter(([m]) => isLoud(voiceOf(m)) || r() < 0.1).sort(() => r() - 0.5).slice(0, 1);
  for (const [m, v] of sayers) pushWire(s, { outlet: OUTLETS[Math.floor(r() * OUTLETS.length)], who: m.id, voice: voiceOf(m), pid: ev.pid,
    headline: v === pass ? `${titleOf(m)} ${nameOf(m)} ${pass ? "cheers" : "celebrates the defeat of"} ${billRef(byId[ev.pid].name)}` : `${titleOf(m)} ${nameOf(m)} ${pass ? "fumes as Congress passes" : "fumes as Congress sinks"} ${billRef(byId[ev.pid].name)}`, quote: react(voiceOf(m), v === pass, r) });
}
export const wireAbout = (s, id) => (s.wire || []).filter((a) => a.who === id || a.target === id).slice(0, 4);

// Election night: the presidential map (every four years), the Senate races and the House, as they'll be reported.
function houseCount(s) { let d = 0; for (const m of HOUSE) { if (m.id === s.youId) { d += m.p === "D" ? 1 : 0; continue; } const inc = m.p === "D" ? 1 : -1, n = noise(`${s.seed}:el${s.term}:${m.id}`); if ((m.dem - 50) * 2 + s.mood * 0.9 + inc * 4 + n * 5 + aidPts(s, m) > 0) d++; } return d; }
function electionNight(s) {
  const year = electionYear(s), pres = s.term % 2 === 1 ? (s.lastPres && s.lastPres.year === year ? s.lastPres : presMap(s, true)) : null;
  if (pres) s.lastPres = pres;
  const sen = senateMap(s, true), keep = SENATE.filter((m) => sen.states[m.st]?.who !== m.id && m.p === "D").length;
  s.night = { year, pres, senate: sen, senD: keep + Object.values(sen.states).filter((x) => x.w === "D").length, houseD: houseCount(s) };
}

// Who you already know on day one. Years served together, the same state delegation, shared committees and
// the same caucus build real relationships; your closest colleagues are allies, your rivals are rivals.
function startRelations(s, you) {
  const yrs = (m) => Math.max(0, YEAR - (m.since || YEAR));
  const mine = yrs(you), myComm = new Set((you.comm || []).filter((c) => c.c.length <= 4).map((c) => c.c));
  const bump = (id, k, r) => { s.know[id] = Math.max(s.know[id] || 0, Math.min(3, k)); s.rel[id] = clamp((s.rel[id] || 0) + r, -1, 1); };
  for (const m of MEMBERS) {
    if (m.id === you.id) continue;
    const together = Math.min(mine, yrs(m)), same = m.ch === you.ch, party = m.p === you.p, h = noise(`${s.seed}:start:${m.id}`);
    if (same && m.st === you.st) bump(m.id, 2 + (together >= 4 ? 1 : 0), party ? 0.15 + Math.min(0.2, together * 0.015) : 0.04);
    else if (!same && m.st === you.st && party) bump(m.id, 1 + (together >= 6 ? 1 : 0), 0.08);
    if (same && (m.comm || []).some((c) => myComm.has(c.c))) bump(m.id, 1 + (together >= 6 ? 1 : 0), party ? 0.06 + Math.min(0.1, together * 0.008) : 0.02 + (h > 0.7 ? 0.08 : 0));
    if (same && party && m.faction === you.faction && together >= 4) bump(m.id, 1, 0.05);
    if (same && party && m.lead?.length) bump(m.id, together >= 6 ? 2 : 1, 0.04);
    // Long careers leave a web of working friendships, a few across the aisle.
    if (same && together >= 8 && h > (party ? 0.55 : 0.88)) bump(m.id, 2, party ? 0.12 : 0.2);
  }
  // Your closest colleagues and your rivals.
  const B = bonds(you), extra = Math.min(6, Math.floor(mine / 4));
  for (const { m } of B.friends) if (mine >= 2) bump(m.id, 3, 0.25 + Math.min(0.3, Math.min(mine, yrs(m)) * 0.02)); else bump(m.id, 1, 0.08);
  const more = MEMBERS.filter((m) => m.ch === you.ch && m.p === you.p && m.id !== you.id && !B.friends.some((f) => f.m.id === m.id) && Math.min(mine, yrs(m)) >= 6)
    .sort((a, b) => Math.abs(a.x - you.x) - Math.abs(b.x - you.x)).slice(0, extra);
  for (const m of more) bump(m.id, 2, 0.22);
  for (const { m } of B.rivals) bump(m.id, 2, mine >= 4 ? -0.3 : -0.12);
  // Real friendships and feuds outweigh everything else: working ties top out below a real friendship.
  for (const id in s.rel) s.rel[id] = Math.min(s.rel[id], 0.62);
  for (const t of realTies(you.id)) { const m = memberById[t.id]; if (!m || m.fictional) continue;
    if (t.k === "friend") { s.know[m.id] = 3; s.rel[m.id] = Math.max(s.rel[m.id] || 0, 0.85); s.owedToYou[m.id] = Math.max(s.owedToYou[m.id] || 0, 1); }
    else if (t.k === "ally") { s.know[m.id] = 3; s.rel[m.id] = Math.max(s.rel[m.id] || 0, 0.68); }
    else { s.know[m.id] = 3; s.rel[m.id] = Math.min(s.rel[m.id] || 0, -0.6); } }
  // Veterans are owed a few favors.
  if (mine >= 8) for (const { m } of B.friends.slice(0, Math.min(3, Math.floor(mine / 6)))) s.owedToYou[m.id] = (s.owedToYou[m.id] || 0) + 1;
}

// ════════ Money: where it comes from, and what it wants ════════
function addMoney(s, kind, amt) { s.money = s.money || { small: 0, large: 0, pac: 0 }; s.money[kind] += amt; }
export function moneyMix(s) { const m = s.money || { small: 0, large: 0, pac: 0 }, t = m.small + m.large + m.pac || 1; return { small: m.small / t, large: m.large / t, pac: m.pac / t, total: t }; }
export function takePledge(s0) { const s = structuredClone(s0); if (s.pledge) return s; const you = memberById[s.youId]; s.pledge = true; s.baseApproval = clamp(s.baseApproval + (you.p === "D" ? 3 : 1.5), 5, 95); s.ties = {}; s.toast = { title: "No corporate PAC money", text: "You announce you'll refuse corporate PAC checks. Your base loves it; your war chest will feel it. The industries that were writing checks stop calling.", tone: "good" }; pushNews(s, `${nameOf(you)} swears off corporate PAC money.`); return s; }
// The industries that funded you call when their bills come up.
function donorWeek(s, r) {
  if (roleOf(s) === "P" || s.pledge) return;
  const ties = s.ties || {}, you = memberById[s.youId];
  for (const [gid, amt] of Object.entries(ties)) {
    if (amt < 80 || r() > 0.5) continue;
    const g = groupById[gid]; if (!g) continue;
    const b = s.bills.find((x) => x.stage === "committee" && !x.dead && g.cares[x.pid] && x.floorWeek - s.week <= 2 && x.floorWeek > s.week && !s.inbox.some((m) => m.kind === "donor" && m.bill === x.id));
    if (!b) continue;
    const want = g.cares[b.pid] > 0;
    pushInbox(s, { kind: "donor", bill: b.id, gid, want, from: `${g.name}`, title: `${g.name} wants a ${want ? "yes" : "no"} on ${byId[b.pid].name}`,
      body: `They've put $${Math.round(amt)}K into your campaigns. Their lobbyist was polite about it, and clear. Vote their way and the checks keep coming. Cross them and they'll find someone who won't.`, choices: [`Vote ${want ? "yes" : "no"}`, "Vote your conscience"] });
  }
  for (const k in ties) ties[k] *= 0.97;
}
function donorAnswer(s, m, choice) {
  const b = s.bills.find((x) => x.id === m.bill), you = memberById[s.youId];
  if (choice === 0) { if (b) b.yourVote = m.want; s.cash += 40; addMoney(s, "pac", 40); s.integrity -= 3; s.toast = { title: "They're happy", text: "Another check arrives within the week.", tone: "" }; }
  else { s.ties[m.gid] = (s.ties[m.gid] || 0) * 0.3; s.integrity += 2; s.oppMoney = (s.oppMoney || 0) + 1; s.toast = { title: "They're not happy", text: `${groupById[m.gid]?.name} stops returning calls. Expect their money to show up for your opponent.`, tone: "" }; }
}

export const GROUP_NAME = (id) => groupById[id]?.name || id;

// ════════ Campaigns: your opponent, spending the war chest, polls ════════
// Money is in $K, like the war chest. Effects are points of margin on election night.
export const CAMPAIGN_START = 30;   // about August of the first year: challengers file and start raising
const rweek = (s) => s.week - (s.termStart || 0);
export const yourRace = (s) => roleOf(s) !== "P" && !s.runFor && upThisTerm(s, memberById[s.youId]);
export const SPEND = {
  tv: { label: "TV and digital ads", note: "The biggest punch, but it fades within weeks. Best saved for the last two months.", decay: 0.13, k: 1.5, unit: 500 },
  field: { label: "Field organizing", note: "Organizers, offices, door knocking. It lasts, but it only pays off if you start early.", decay: 0, k: 1.1, unit: 400 },
  mail: { label: "Mail", note: "Cheap and targeted. A small lift that fades slowly.", decay: 0.04, k: 0.8, unit: 300 },
};
const stockPts = (st) => Object.entries(SPEND).reduce((a, [k, d]) => a + d.k * Math.sqrt(Math.max(0, st?.[k] || 0) / d.unit), 0);
export const campPts = (s) => stockPts(s.camp);
export const oppPts = (s) => (s.opp ? stockPts(s.opp.st) : 0);
// Party money spent in a seat: points toward Democrats.
export const aidPts = (s, m) => { const a = s.aid?.[m.id]; return a ? 1.3 * (Math.sqrt((a.D || 0) / 1000) - Math.sqrt((a.R || 0) / 1000)) : 0; };
const addAid = (s, id, p, amt) => { s.aid = s.aid || {}; const a = (s.aid[id] = s.aid[id] || { D: 0, R: 0 }); a[p] += amt; };
// Your margin on election night, before luck. Polls are this plus sampling error.
export function projMargin(s) {
  const you = memberById[s.youId], env = you.p === "D" ? s.mood : -s.mood, gg = groupElection(s, "general");
  // Personal popularity matters, but only so much: even a well-liked member in a district that leans the other way rarely wins by double digits.
  return (you.own - 50) * 2 + env * 0.9 + 3 + clamp((s.approval - 50) * 0.3, -8, 5) + Math.min(2, s.cash / 1200) + gg.net * 0.5 + (s.debateBonus || 0) - (s.oppMoney || 0) * 1.2
    + campPts(s) - oppPts(s) + (you.p === "D" ? 1 : -1) * aidPts(s, you);
}
const OPP_BIO = { strong: ["a state senator with a big donor list", "a former federal prosecutor", "a self-funding businessman", "a decorated combat veteran", "the mayor of the district's biggest city", "a popular local TV anchor"],
  weak: ["a first-time candidate", "a perennial candidate on his fourth try", "a local talk radio host", "a small-business owner with no campaign experience", "a county commissioner from the far corner of the district"] };
function makeOpp(s, r) {
  const you = memberById[s.youId], env = you.p === "D" ? s.mood : -s.mood;
  const q = clamp(0.2 + (55 - you.own) / 16 - env / 12 + (48 - s.approval) / 35 + (r() - 0.5) * 0.3, 0.04, 1);
  const pool = q > 0.45 ? OPP_BIO.strong : OPP_BIO.weak, g = r() < 0.4 ? "F" : "M";
  let bio = pool[Math.floor(r() * pool.length)]; if (g === "F") bio = bio.replace(" his ", " her ").replace("businessman", "businesswoman");
  if (you.ch === "S") bio = q > 0.45 ? ["the state attorney general", "a two-term former governor", "a self-funding executive", "a sitting member of the House"][Math.floor(r() * 4)] : bio.replace("district's", "state's").replace("the district", "the state");
  s.opp = { first: PF[Math.floor(r() * PF.length)], last: PL[Math.floor(r() * PL.length)], p: you.p === "D" ? "R" : "D", g, q, bio, cash: Math.round(40 + q * 300), raised: 0, st: { tv: 0, field: 0, mail: 0 }, since: s.week };
  pushInbox(s, { kind: "staff", from: "Your campaign manager", title: `${s.opp.first} ${s.opp.last} is running against you`, body: `${s.opp.first} ${s.opp.last} (${s.opp.p}), ${bio}, filed to run for your seat. ${q > 0.6 ? "This is a serious recruit, and the other party's committee is behind them. Expect real money." : q > 0.3 ? "Credible, not scary. They'll raise enough to be annoying." : "Not a strong recruit. Don't get lazy."} Your race is on the Campaign tab.`, done: true });
  pushNews(s, `${s.opp.first} ${s.opp.last} launches a campaign against ${nameOf(you)}.`, "event");
}
const ATTACK_KEY = "attack";
function attackLine(s) {
  const you = memberById[s.youId], bad = (s.votesCast || []).filter((v) => v.d < -0.3).sort((a, b) => a.d - b.d)[0];
  if (bad) return { topic: `your vote on ${byId[bad.pid].name}`, ad: `"${nameOf(you)} voted ${bad.vote ? "for" : "against"} ${byId[bad.pid].name}. Washington first, ${you.st} last."` };
  if (moneyMix(s).pac > 0.4) return { topic: "your corporate PAC money", ad: `"${nameOf(you)} has taken millions from corporate PACs. Guess who gets the call back."` };
  if (s.loyalty < -2) return { topic: "breaking with your party", ad: `"You can't trust ${nameOf(you)}. Just ask ${you.p === "D" ? "Democrats" : "Republicans"}."` };
  return { topic: "your record", ad: `"${nameOf(you)} votes with party leaders 9 times out of 10. Time for someone who works for us."` };
}
function campaignWeek(s, r) {
  if (!yourRace(s)) return;
  const rw = rweek(s), you = memberById[s.youId], left = ELECTION_WEEK - rw;
  for (const [k, d] of Object.entries(SPEND)) if (s.camp?.[k]) s.camp[k] *= 1 - d.decay;
  if (rw < CAMPAIGN_START) return;
  if (!s.opp) makeOpp(s, r);
  const o = s.opp, env = you.p === "D" ? s.mood : -s.mood;
  // The opponent raises, then spends: some field early, everything on TV at the end.
  const raise = (4 + 30 * o.q) * (1 + Math.max(0, env) / 8) + (s.oppMoney || 0) * 6 + (r() - 0.5) * 6;
  o.cash += Math.max(0, raise); o.raised += Math.max(0, raise);
  for (const [k, d] of Object.entries(SPEND)) o.st[k] *= 1 - d.decay;
  if (left > 10) { const f = o.cash * 0.12; o.cash -= f; o.st.field += f * clamp(left / 40, 0.25, 1.1); }
  else { const t = o.cash / Math.max(1, left); o.cash -= t; o.st.tv += t * 0.85; o.st.mail += t * 0.15; }
  // Your campaign manager spends on autopilot in the last ten weeks if you haven't.
  if (left <= 10 && left > 0 && !(s.camp?.last > s.week - 3)) { const t = Math.round(s.cash * 0.08); if (t > 10) { s.cash -= t; s.camp = s.camp || { tv: 0, field: 0, mail: 0, spent: 0 }; s.camp.tv += t * 0.7; s.camp.spent += t; s.camp.auto = (s.camp.auto || 0) + t; } }
  // Polls: public ones every six weeks, every two at the end.
  if ((left > 12 && rw % 6 === 0) || (left <= 12 && rw % 2 === 0)) pollNow(s, false);
  // Attacks.
  const lastAtk = s.inbox.find((x) => x.kind === ATTACK_KEY);
  for (const m of s.inbox) if (m.kind === ATTACK_KEY && !m.done && m.week < s.week - 1) answerAttack(s, m, 2);
  if (rw >= PRIMARY_WEEK - 16 && left > 0 && (!lastAtk || lastAtk.week < s.week - 4) && r() < 0.1 + 0.18 * o.q) {
    const a = attackLine(s), hit = Math.round((0.8 + 1.8 * o.q) * 10) / 10;
    pushInbox(s, { kind: ATTACK_KEY, hit, from: "Your campaign manager", title: `${o.first} ${o.last} is attacking you on ${a.topic}`, body: `A new ad is running across the ${you.ch === "S" ? "state" : "district"}: ${a.ad} If it goes unanswered it could cost you about ${hit} points of approval. How do you want to respond?`, choices: ["Answer with an ad of our own ($150K)", "Answer it in person at home (6 hours)", "Let it go"] });
    pushNews(s, `${o.first} ${o.last} (${o.p}) goes on the attack against ${nameOf(you)} over ${a.topic}.`, "bad");
  }
}
function answerAttack(s, m, choice) {
  m.done = true; m.choice = choice;
  if (choice === 0 && s.cash >= 150) { s.cash -= 150; s.camp = s.camp || { tv: 0, field: 0, mail: 0, spent: 0 }; s.camp.tv += 150; s.camp.spent += 150; s.approval = clamp(s.approval - m.hit * 0.2, 5, 95); s.toast = { title: "You hit back", text: "Your response ad is on the air within two days. Most of the damage is contained.", tone: "good" }; }
  else if (choice === 1 && s.hours >= 6) { s.hours -= 6; s.approval = clamp(s.approval - m.hit * 0.4, 5, 95); s.toast = { title: "You answered it at home", text: "Town halls and local radio. You take some of the sting out of it.", tone: "" }; }
  else { s.approval = clamp(s.approval - m.hit, 5, 95); if (choice !== 2) s.toast = { title: "Not enough to answer it", text: `You didn't have the ${choice === 0 ? "money" : "time"}, so the ad went unanswered.`, tone: "bad" }; }
}
function pollNow(s, internal) {
  const pol = s.staff?.find((x) => x.role === "poll"), err = internal ? 1 + (20 - (pol?.skill || 10)) / 8 : 4.5;
  const m = projMargin(s) + noise(`${s.seed}:poll:${s.week}:${internal}:${(s.polls || []).length}`) * err * 1.4;
  const und = clamp((ELECTION_WEEK - rweek(s)) / 6, 3, 14), you = Math.round((100 - und + m) / 2), opp = Math.round(100 - und - you);
  (s.polls = s.polls || []).push({ w: s.week, you, opp, m: Math.round(m * 10) / 10, err: Math.round(err * 10) / 10, internal });
  if (s.polls.length > 40) s.polls.shift();
  if (!internal) { pushNews(s, `New poll in ${memberById[s.youId].seat}: ${nameOf(memberById[s.youId])} ${you}%, ${s.opp ? `${s.opp.first} ${s.opp.last}` : "a generic challenger"} ${opp}%.`, m < 3 ? "bad" : ""); s.news[0].ids = [s.youId]; }
}
export function buyPoll(s0) { const s = structuredClone(s0); if (s.cash < 25) return s; s.cash -= 25; pollNow(s, true); const p = s.polls[s.polls.length - 1]; s.toast = { title: "Your internal poll", text: `You ${p.you}%, ${s.opp ? s.opp.last : "challenger"} ${p.opp}%. Margin of error about ${p.err} points.`, tone: p.m > 3 ? "good" : "bad" }; return s; }
export function campaignSpend(s0, kind, amt) {
  const s = structuredClone(s0), d = SPEND[kind];
  if (!d || s.cash < amt || !yourRace(s) || rweek(s) >= ELECTION_WEEK) return s;
  const left = ELECTION_WEEK - rweek(s), eff = kind === "field" ? clamp(left / 40, 0.25, 1.1) : 1;
  s.cash -= amt; s.camp = s.camp || { tv: 0, field: 0, mail: 0, spent: 0 }; s.camp[kind] += amt * eff; s.camp.spent += amt; s.camp.last = s.week;
  s.toast = { title: d.label, text: kind === "tv" && left > 16 ? `$${amt}K of ads this early will mostly be forgotten by November.` : kind === "field" && left < 12 ? "Late field money buys less: there isn't time to recruit and train volunteers." : `$${amt}K spent. Your next poll will show whether it's working.`, tone: "" };
  return s;
}

// ════════ Earmarks: Community Project Funding ════════
// Requests ride on the full-year funding bill. Stopgaps carry none, which is why members hate them.
const EAR_TYPES = [["Water and sewer upgrade", 3500], ["New fire station", 2500], ["Community health center expansion", 3000], ["Road and bridge repair", 4000], ["Police radios and body cameras", 1500], ["Community college job training lab", 2000],
  ["Affordable housing infrastructure", 3000], ["Flood protection project", 4500], ["Rural broadband buildout", 2500], ["Veterans' resource center", 1200], ["Regional airport runway repair", 5000], ["Food bank warehouse", 900]];
export const EAR_MAX = 3;
const earMp = (s) => (s.mp || []).find((x) => x.kind === "funding" && /Fiscal \d{4} funding bill/.test(x.name));
export function earWindow(s) { const mp = earMp(s); return mp && mp.stage !== "law" && s.week >= mp.deadline - 26 && s.week <= mp.deadline - 3 ? mp : null; }
export function earOptions(s) {
  const r = rng(hash(`${s.seed}:ear:${s.term || 1}`)), pool = [...EAR_TYPES].sort(() => r() - 0.5).slice(0, 6);
  return pool.map(([name, amt], i) => ({ i, name, amt: Math.round(amt * (0.7 + r() * 0.6) / 50) * 50 }));
}
const onApprops = (you) => (you.comm || []).some((c) => c.c === "HSAP" || c.c === "SSAP");
export function requestEarmark(s0, i) {
  const s = structuredClone(s0), mp = earWindow(s), you = memberById[s.youId];
  s.ear = s.ear || [];
  if (!mp || s.hours < 2 || s.ear.filter((e) => e.term === (s.term || 1)).length >= EAR_MAX || s.ear.some((e) => e.term === (s.term || 1) && e.i === i)) return s;
  const o = earOptions(s)[i]; s.hours -= 2;
  s.ear.push({ ...o, term: s.term || 1, mp: mp.id, status: "requested" });
  if (you.p === "R" && /Freedom/.test(you.faction || "")) { s.baseApproval = clamp(s.baseApproval - 1.5, 5, 95); s.toast = { title: "Request filed", text: "Filed. Some of your conservative base calls earmarks pork, and they noticed.", tone: "" }; }
  else s.toast = { title: "Request filed", text: `$${(o.amt / 1000).toFixed(1)}M for ${o.name.toLowerCase()}. Appropriators decide when they write the funding bill.${onApprops(you) ? " Being on Appropriations helps a lot." : ""}`, tone: "good" };
  return s;
}
function earSettle(s, mp) {
  const mine = (s.ear || []).filter((e) => e.mp === mp.id && e.status === "requested"); if (!mine.length) return;
  const you = memberById[s.youId], maj = (you.ch === "H" ? HOUSE.filter((m) => m.p === "D").length >= 218 : SENATE.filter((m) => m.p === "D").length >= 51) ? "D" : "R";
  const chair = commChair(you.ch === "S" ? "SSAP" : "HSAP"), r = rng(hash(`${s.seed}:earset:${mp.id}`));
  let won = 0;
  for (const e of mine) {
    const p = clamp((you.p === maj ? 0.55 : 0.35) + (onApprops(you) ? 0.25 : 0) + (chair ? (s.rel[chair.id] || 0) * 0.25 : 0) + s.clout / 800, 0.1, 0.95);
    if (r() < p) { e.status = "funded"; won++; s.approval = clamp(s.approval + 1.1, 5, 95); }
    else e.status = "cut";
  }
  if (won) pushNews(s, `${nameOf(you)} brings home $${(mine.filter((e) => e.status === "funded").reduce((a, e) => a + e.amt, 0) / 1000).toFixed(1)}M for ${mine.filter((e) => e.status === "funded").map((e) => e.name.toLowerCase()).join(", ")}.`, "good");
  pushInbox(s, { kind: "staff", from: "Your appropriations staffer", title: `${won} of ${mine.length} of your projects made it into the bill`, body: `${mine.map((e) => `${e.name}: ${e.status === "funded" ? "funded" : "cut"}`).join(". ")}. ${won ? "Each one is a ribbon cutting and a local headline. Approval at home is up." : "Appropriators had more requests than money. Getting on the committee, or closer to its chair, changes that."}`, done: true });
}

// ════════ Money between politicians: dues, checks, leadership PACs, the party's battleground fund ════════
// Real rules (FEC, 2025-26): a campaign can give another candidate $2,000 per election; a leadership PAC $5,000.
// Transfers to the party committees are unlimited, and the parties set "dues" for members (DCCC 2026 goals:
// $165K rank-and-file, $275K on exclusive committees, $660K for their top members, $880K whip, $1.1M leader).
export const PARTY_COMM = (ch, p) => (ch === "S" ? (p === "D" ? "DSCC" : "NRSC") : p === "D" ? "DCCC" : "NRCC");
const EXCLUSIVE = ["HSAP", "HSIF", "HSBA", "HSWM", "SSAP", "SSFI"];
export const isFrontline = (m) => m.own < 54;
export function duesGoal(m) {
  if (isFrontline(m)) return 0;
  const lead = m.lead?.[0] || "", top = (m.comm || []).find((c) => c.role === "Chair" || c.role === "Ranking Member"), excl = (m.comm || []).some((c) => EXCLUSIVE.includes(c.c));
  let g = /Speaker|Majority Leader|Minority Leader|Republican Leader|Democratic Leader/.test(lead) ? 1100 : /Whip/.test(lead) ? 880 : lead ? 500 : top ? (EXCLUSIVE.includes(top.c) ? 660 : 400) : excl ? 275 : 165;
  return m.ch === "S" ? Math.round(g * 1.3) : g;
}
export const isLeader = (s) => !!memberById[s.youId]?.lead?.length && roleOf(s) !== "P";
const leadersOf = (ch, p) => MEMBERS.filter((m) => m.ch === ch && m.p === p && m.lead?.length);
export function payDues(s0, amt) {
  const s = structuredClone(s0), you = memberById[s.youId];
  if (s.cash < amt || amt <= 0) return s;
  s.cash -= amt; s.dues = s.dues || { paid: 0 }; s.dues.paid += amt;
  for (const l of leadersOf(you.ch, you.p)) if (l.id !== you.id) s.rel[l.id] = clamp((s.rel[l.id] || 0) + amt / 3000, -1, 1);
  s.clout += amt / 120; if (isLeader(s)) s.pot = (s.pot || 0) + amt;
  const g = duesGoal(you);
  s.toast = { title: `$${amt}K to the ${PARTY_COMM(you.ch, you.p)}`, text: g ? `You've paid $${s.dues.paid}K of your $${g}K goal. Leadership keeps the list, and it comes up when committee seats and leadership races are decided.` : "Frontline members owe nothing, so leadership notices when you give anyway.", tone: "good" };
  return s;
}
export const LPAC_COST = 4;   // hours to set one up
export function startLpac(s0) {
  const s = structuredClone(s0), you = memberById[s.youId];
  if (s.lpac || s.hours < LPAC_COST) return s;
  s.hours -= LPAC_COST; s.lpac = { cash: 0, raised: 0 };
  s.toast = { title: "Your leadership PAC is open", text: "It raises separately from your campaign and can give $5,000 per election to other candidates, more than your campaign's $2,000. It's how ambitious members build a following.", tone: "good" };
  pushNews(s, `${nameOf(you)} launches a leadership PAC, a sign of bigger ambitions.`);
  return s;
}
// What you can do for a colleague or candidate. kind: check | lpac | event
export const GIVE = { check: { label: "Campaign check", amt: 4, note: "$2,000 for the primary and $2,000 for the general, the legal limit." }, lpac: { label: "Leadership PAC check", amt: 10, note: "$5,000 per election." }, event: { label: "Headline a fundraiser", hours: 6, note: "Your name on the invitation brings in your donors: tens of thousands for them." } };
export function giveTo(s0, target, kind) {
  const s = structuredClone(s0), you = memberById[s.youId], g = GIVE[kind];
  const isC = String(target).startsWith("cand:"), m = isC ? null : memberById[target], cand = isC ? candFor(s, target.slice(5)) : null; if (!m && !cand) return s;
  s.given = s.given || {}; const rec = (s.given[target] = s.given[target] || { amt: 0, events: 0, kinds: {} });
  if (kind !== "event" && rec.kinds[kind] >= (s.term || 1)) { s.toast = { title: "Already at the limit", text: "You've given the most the law allows this cycle.", tone: "" }; return s; }
  if (kind === "check" && s.cash < 4) return s;
  if (kind === "lpac" && (!s.lpac || s.lpac.cash < 10)) return s;
  if (kind === "event" && s.hours < 6) return s;
  let amt = g.amt || 0;
  if (kind === "check") s.cash -= 4;
  if (kind === "lpac") s.lpac.cash -= 10;
  if (kind === "event") { s.hours -= 6; amt = Math.round(30 + s.profile * 0.8 + (you.lead?.length ? 60 : 0)); rec.events++; }
  if (kind !== "event") rec.kinds[kind] = s.term || 1;
  rec.amt += amt; const party = m ? m.p : cand.p;
  addAid(s, m ? m.id : cand.seat, party, amt * 3);   // money from colleagues also signals donors and the party
  if (m) { s.rel[m.id] = clamp((s.rel[m.id] || 0) + (kind === "event" ? 0.2 : kind === "lpac" ? 0.1 : 0.06), -1, 1); s.know[m.id] = Math.max(s.know[m.id] || 0, 1); if (kind === "event") s.owedToYou[m.id] = (s.owedToYou[m.id] || 0) + 1; }
  else { cand.backed = (cand.backed || 0) + amt; }
  const who = m ? nameOf(m) : `${cand.first} ${cand.last}`;
  s.toast = { title: kind === "event" ? `You headlined a fundraiser for ${who}` : `You gave $${amt}K to ${who}`, text: kind === "event" ? `It raised about $${amt}K for them. ${m ? "They owe you one." : "If they win, they'll remember who showed up first."}` : m ? "A small check by Washington standards. They'll notice it, and so will the people they talk to." : "Candidates remember the members who helped before anyone else did.", tone: "good" };
  return s;
}
// Challengers: named candidates running for seats the other party holds. They become members if they win.
export function candFor(s, seatId) {
  const m = memberById[seatId]; if (!m) return null;
  s.cands = s.cands || {}; if (s.cands[seatId]?.term === (s.term || 1)) return s.cands[seatId];
  const r = rng(hash(`${s.seed}:cand:${seatId}:${s.term || 1}`)), g = r() < 0.45 ? "F" : "M";
  const bios = ["a state legislator", "a Marine veteran", "a former prosecutor", "a small-business owner", "a county commissioner", "a nurse and union leader", "a former local news anchor", "a pastor and youth coach", "a farmer and school board member"];
  return (s.cands[seatId] = { seat: seatId, st: m.st, d: m.d, ch: m.ch, p: m.p === "D" ? "R" : "D", first: PF[Math.floor(r() * PF.length)], last: PL[Math.floor(r() * PL.length)], g, bio: bios[Math.floor(r() * bios.length)], term: s.term || 1, backed: 0 });
}
// The battleground: the closest seats each party has to defend or can take.
export function battleground(s, ch, p) {
  const pool = ch === "S" ? SENATE.filter((m) => m.cls === cycleClass(s.term)) : HOUSE;
  return pool.filter((m) => m.id !== s.youId).map((m) => { const mm = (m.dem - 50) * 2 + s.mood * 0.9 + (m.p === "D" ? 4 : -4) + aidPts(s, m); return { m, mm, mine: m.p === p }; })
    .filter((x) => Math.abs(x.mm) < (ch === "S" ? 14 : 9)).sort((a, b) => Math.abs(a.mm) - Math.abs(b.mm)).slice(0, 16);
}
export function allocate(s0, seatId, amt) {
  const s = structuredClone(s0), you = memberById[s.youId], m = memberById[seatId];
  if (!isLeader(s) || !m || (s.pot || 0) < amt) return s;
  s.pot -= amt; addAid(s, seatId, you.p, amt); (s.alloc = s.alloc || {})[seatId] = (s.alloc[seatId] || 0) + amt;
  if (m.p === you.p) { s.rel[m.id] = clamp((s.rel[m.id] || 0) + (amt >= 1000 ? 0.25 : 0.12), -1, 1); if (amt >= 1000) s.owedToYou[m.id] = (s.owedToYou[m.id] || 0) + 1; }
  else { const c = candFor(s, seatId); c.backed = (c.backed || 0) + amt; }
  s.toast = { title: `$${amt >= 1000 ? (amt / 1000).toFixed(1) + "M" : amt + "K"} to ${m.seat}`, text: m.p === you.p ? `${nameOf(m)} knows where it came from.` : `For ${candFor(s, seatId).first} ${candFor(s, seatId).last}, the challenger. If they win, they owe you their first vote in the caucus.`, tone: "good" };
  return s;
}
export function askForHelp(s0) {
  const s = structuredClone(s0), you = memberById[s.youId];
  if (!yourRace(s) || s.hours < 2 || (s.askedHelp || -99) > s.week - 8) return s;
  s.hours -= 2; s.askedHelp = s.week;
  const g = duesGoal(you), duesR = g ? Math.min(1, (s.dues?.paid || 0) / g) : 1;
  const ls = leadersOf(you.ch, you.p), relL = ls.length ? ls.reduce((a, m) => a + (s.rel[m.id] || 0), 0) / ls.length : 0, need = projMargin(s);
  const odds = clamp(0.15 + duesR * 0.3 + s.loyalty * 0.03 + relL * 0.4 + (need < 6 ? 0.25 : -0.2), 0.03, 0.92);
  if (rng(hash(`${s.seed}:help:${s.week}`))() < odds) { const amt = Math.round(need < 3 ? 1500 : need < 8 ? 800 : 300); addAid(s, you.id, you.p, amt);
    s.toast = { title: `The ${PARTY_COMM(you.ch, you.p)} is coming in`, text: `They'll spend about $${(amt / 1000).toFixed(1)}M in your race, on their own ads. You don't control the message, but you'll take it.`, tone: "good" }; }
  else s.toast = { title: "Not this time", text: need >= 8 ? "They looked at your polls and said you're fine. Their money goes to closer races." : duesR < 0.5 ? "They noticed you haven't paid your dues. Nobody said so out loud." : "Leadership has more races than money. Try again in a couple of months.", tone: "bad" };
  return s;
}
function moneyWeek(s, r) {
  if (roleOf(s) === "P") return;
  const you = memberById[s.youId], rw = rweek(s), maj = you.p;
  if (s.lpac && r() < 0.5) { const x = Math.round(5 + s.profile * 0.25); s.lpac.cash += x; s.lpac.raised += x; }
  if (isLeader(s) && rw >= 16) s.pot = (s.pot || 0) + Math.round(250 + (you.lead[0].match(/Speaker|Leader/) ? 400 : 100) + r() * 100);
  // Dues reminders.
  const g = duesGoal(you);
  if (g && (rw === 52 || rw === 84) && (s.dues?.paid || 0) < g * (rw === 52 ? 0.4 : 0.8)) { for (const l of leadersOf(you.ch, you.p)) if (l.id !== you.id) s.rel[l.id] = clamp((s.rel[l.id] || 0) - 0.08, -1, 1);
    pushInbox(s, { kind: "staff", from: `The ${PARTY_COMM(you.ch, you.p)}`, title: "A reminder about your dues", body: `You've paid $${s.dues?.paid || 0}K of your $${g}K goal. Members in safe seats are expected to help pay for the ones in tough seats. Leadership has the list. Pay from the Campaign tab.`, done: true }); }
  if (rw < 20 || rw >= ELECTION_WEEK) return;
  // Requests: colleagues in tough races and challengers ask you for help.
  const bg = battleground(s, you.ch, you.p);
  if (bg.length && r() < (isLeader(s) ? 0.4 : 0.22)) {
    const x = bg[Math.floor(r() * Math.min(bg.length, 10))], cand = x.mine ? null : candFor(s, x.m.id), who = x.mine ? nameOf(x.m) : `${cand.first} ${cand.last}`;
    if (!s.inbox.some((i) => (i.kind === "fundask" || i.kind === "potask") && i.seat === x.m.id && i.week > s.week - 12)) {
      if (isLeader(s)) pushInbox(s, { kind: "potask", seat: x.m.id, from: x.mine ? `${titleOf(x.m)} ${who}` : `${who}, candidate in ${x.m.seat}`, title: x.mine ? `${who} needs help holding ${x.m.seat}` : `${who} can flip ${x.m.seat}`, body: x.mine ? `"The other side just reserved $2 million in my market. I need air cover." Their seat is within ${Math.max(1, Math.round(Math.abs(x.mm)))} points. Your battleground fund has $${((s.pot || 0) / 1000).toFixed(1)}M.` : `${who} is ${cand.bio} running against ${nameOf(x.m)}. The race is within ${Math.max(1, Math.round(Math.abs(x.mm)))} points, and they're being outspent. Your battleground fund has $${((s.pot || 0) / 1000).toFixed(1)}M.`, choices: ["Send $1M", "Send $300K", "Not now"] });
      else pushInbox(s, { kind: "fundask", seat: x.m.id, from: x.mine ? `${titleOf(x.m)} ${who}` : `${who}, candidate in ${x.m.seat}`, title: x.mine ? `${who} asks for your help` : `A candidate in ${x.m.seat} asks for your support`, body: x.mine ? `${who} is in one of the closest races in the country (${x.m.seat}). A check helps a little; your name on a fundraiser helps a lot, and they won't forget it.` : `${who}, ${cand.bio}, is challenging ${nameOf(x.m)}. Early help from a sitting member opens donors' wallets. If they win, you have a friend in the next Congress.`, choices: ["Write a check ($4K)", "Headline a fundraiser for them (6 hours)", "Not this time"] });
    }
  }
}
function answerMoney(s, m, choice) {
  const you = memberById[s.youId], target = memberById[m.seat];
  if (m.kind === "potask") {
    const amt = [1000, 300, 0][choice] || 0;
    if (amt && (s.pot || 0) >= amt) { const n = allocate(s, m.seat, amt); Object.assign(s, n); }
    else if (amt) s.toast = { title: "The fund is short", text: "There isn't enough in the battleground fund. Dues from safe-seat members refill it.", tone: "bad" };
    else if (target?.p === you.p) s.rel[target.id] = clamp((s.rel[target.id] || 0) - 0.12, -1, 1);
  }
  if (m.kind === "fundask") {
    if (choice === 0 || choice === 1) { const n = giveTo(s, target?.p === you.p ? m.seat : `cand:${m.seat}`, choice === 0 ? "check" : "event"); Object.assign(s, n); }
    else if (target?.p === you.p) s.rel[target.id] = clamp((s.rel[target.id] || 0) - 0.04, -1, 1);
  }
}
// After the election: candidates you backed who won join Congress remembering it.
function backersWin(s, m, year) {
  const c = s.cands?.[m.id]; if (!c || !c.backed || c.p !== m.p) return;
  m.first = m.sf = c.first; m.last = m.sl = c.last; m.g = c.g; keep(s, m);
  s.rel[m.id] = clamp(0.35 + Math.min(0.4, c.backed / 2500), -1, 1); s.know[m.id] = 2; s.owedToYou[m.id] = (s.owedToYou[m.id] || 0) + 1;
  (s.backedWon = s.backedWon || []).push({ id: m.id, name: `${c.first} ${c.last}`, seat: m.seat || `${m.st}-${m.d}`, year });
}

// ════════ Forcing votes: discharge petitions and privileged resolutions ════════
// A House majority (218 signatures) can pull a bill out of committee over the Speaker's objection.
// War Powers and National Emergencies Act resolutions are privileged: any member can force a vote,
// and in the Senate they need only a simple majority.
export const PRIVILEGED = { war_powers: "the War Powers Resolution", tariff_repeal: "the National Emergencies Act" };
const houseMaj = () => (HOUSE.filter((m) => m.p === "D").length >= 218 ? "D" : "R");
export const canPetition = (s, b) => roleOf(s) === "H" && !b.dead && b.stage === "committee" && b.origin === "H" && !b.discharged && !(s.petitions || []).some((p) => p.bill === b.id && p.status !== "off")
  && (b.party !== houseMaj() || (!b.marked && b.floorWeek - s.week > 4));
export const petitionOf = (s, b) => (s.petitions || []).find((p) => p.bill === b.id && p.status !== "off");
function newPetition(s, b, by) {
  const p = { id: `pet${s.week}-${(s.petitions || []).length}`, bill: b.id, pid: b.pid, by, sigs: { [by]: 1 }, n: 1, start: s.week, status: "open" };
  if (b.sponsor !== by) { p.sigs[b.sponsor] = 1; p.n++; }
  (s.petitions = s.petitions || []).push(p); return p;
}
const defyLeaders = (s, hit) => { const you = memberById[s.youId]; if (you.p !== houseMaj()) return; s.loyalty -= hit; for (const l of leadersOf("H", you.p)) s.rel[l.id] = clamp((s.rel[l.id] || 0) - 0.1 * hit, -1, 1); };
function petitionWeek(s, r) {
  const maj = houseMaj(), you = memberById[s.youId];
  // Now and then the minority starts one on something popular.
  if (r() < 0.035) {
    const b = s.bills.find((x) => !x.dead && x.stage === "committee" && x.origin === "H" && x.party !== maj && !petitionOf(s, x) && x.sponsor !== s.youId && (billInfo(x.pid, x.party).pop > 0.05 || billInfo(x.pid, x.party).bipartisan));
    if (b) { const p = newPetition(s, b, b.sponsor); pushNews(s, `${nameOf(memberById[b.sponsor])} files a discharge petition to force a vote on ${byId[b.pid].name} over leadership's objection.`, "event");
      if (roleOf(s) === "H" && !p.sigs[s.youId]) pushInbox(s, { kind: "petask", pet: p.id, from: `${titleOf(memberById[b.sponsor])} ${nameOf(memberById[b.sponsor])}`, title: `Sign the discharge petition on ${byId[b.pid].name}?`, body: `It needs 218 signatures to force a floor vote the ${maj === "D" ? "Democratic" : "Republican"} majority doesn't want. ${you.p === maj ? "Signing is a public break with your own leadership, and they keep track." : "Every minority signature counts; the hard part is getting majority members to defy their leaders."}`, choices: ["Sign it", "Stay off it"] }); }
  }
  for (const p of s.petitions || []) {
    if (p.status !== "open" && p.status !== "ripe") continue;
    const b = s.bills.find((x) => x.id === p.bill);
    if (!b || b.dead || b.stage !== "committee") { p.status = "off"; continue; }
    if (p.status === "ripe") { if (s.week >= p.ripeAt) { b.discharged = true; b.marked = true; b.floorWeek = s.week; p.status = "done"; b.hist.push(`Discharge petition: ${p.n} signatures.`); pushNews(s, `The discharge petition ripens: ${byId[b.pid].name} comes to the House floor.`, "event"); } continue; }
    const ctx = billCtx(s, b);
    for (const m of HOUSE) {
      if (p.sigs[m.id] || m.id === s.youId) continue;
      const L = lean(m, b.pid, ctx).p, rr = rng(hash(`${s.seed}:pet:${p.id}:${m.id}:${s.week}`))();
      const prob = m.p !== maj ? (L > 0.6 ? 0.3 : 0) : L > 0.78 ? 0.05 * (1.3 - m.t.loyalty) + (b.deals[m.id] ? 0.1 : 0) : 0;
      if (rr < prob) { p.sigs[m.id] = 1; p.n++; }
    }
    if (p.n >= 218) {
      const majSigners = Object.keys(p.sigs).filter((id) => memberById[id]?.p === maj).length, majSeats = HOUSE.filter((m) => m.p === maj).length;
      if (r() < 0.5 && majSeats - majSigners >= 218) { p.status = "off"; b.hist.push("Leadership turned off the discharge petition with a rule vote."); pushNews(s, `${maj === "D" ? "Democratic" : "Republican"} leaders use a rule vote to turn off the discharge petition on ${byId[b.pid].name}.`, "bad"); continue; }
      p.status = "ripe"; p.ripeAt = s.week + 2;
      pushNews(s, `The discharge petition on ${byId[b.pid].name} hits ${p.n} signatures${majSigners ? `, with ${majSigners} from the majority` : ""}. A floor vote is coming whether leaders like it or not.`, "event");
    }
  }
}

// ════════ The Supreme Court and the federal bench ════════
// The Court as of November 2026. Alito has said he'll stay through the end of the term (summer 2027);
// Thomas has ruled out retiring. Leanings are rough placements for the game.
const JUSTICES = [
  { first: "John", skin: 0, last: "Roberts", born: 1955, by: "R", x: 0.3, since: 2005, g: "M", chief: true }, { first: "Clarence", skin: 5, last: "Thomas", born: 1948, by: "R", x: 0.95, since: 1991, g: "M" },
  { first: "Samuel", skin: 1, last: "Alito", born: 1950, by: "R", x: 0.85, since: 2006, g: "M" }, { first: "Sonia", skin: 2, last: "Sotomayor", born: 1954, by: "D", x: -0.75, since: 2009, g: "F" },
  { first: "Elena", skin: 0, last: "Kagan", born: 1960, by: "D", x: -0.5, since: 2010, g: "F" }, { first: "Neil", skin: 0, last: "Gorsuch", born: 1967, by: "R", x: 0.6, since: 2017, g: "M" },
  { first: "Brett", skin: 0, last: "Kavanaugh", born: 1965, by: "R", x: 0.4, since: 2018, g: "M" }, { first: "Amy Coney", skin: 0, last: "Barrett", born: 1972, by: "R", x: 0.42, since: 2020, g: "F" },
  { first: "Ketanji Brown", skin: 5, last: "Jackson", born: 1970, by: "D", x: -0.8, since: 2022, g: "F" },
];
// Judges often named on Republican shortlists. Who gets picked, and what happens next, is invented. [first, last, contentiousness, lean, born]
const SHORTLIST = [["Andrew", "Oldham", 0.42, 0.75, 1978], ["Amul", "Thapar", 0.36, 0.65, 1969], ["Neomi", "Rao", 0.46, 0.7, 1973], ["Kathryn", "Mizelle", 0.56, 0.75, 1987], ["James", "Ho", 0.66, 0.85, 1973], ["Emil", "Bove", 0.82, 0.8, 1981]];
// How exposed a law is to a constitutional challenge (0-1).
const VULN = { aw_ban: 0.7, codify_roe: 0.4, voting_rights: 0.5, wealth_tax: 0.75, term_limits: 0.9, court_expansion: 0.3, stock_ban: 0.25, ice_limits: 0.35, save_act: 0.45, voter_id: 0.3, abortion_15wk: 0.45,
  gender_care: 0.35, dei: 0.35, red_flag: 0.35, carry_reciprocity: 0.4, public_option: 0.2, background_checks: 0.3, deport: 0.4, tariffs_up: 0.35, carbon: 0.35, ai_rules: 0.35, kids_online: 0.5, police: 0.15, marijuana: 0.1 };
const gameYear = (s) => dateOf(s.week).getUTCFullYear();
function courtSeed(s) {
  s.court = { j: JUSTICES.map((j, i) => { const [sf, sl] = swapPair(j.first.split(" ")[0], j.last); return { ...j, id: `J${i}`, sf: j.first.includes(" ") ? `${sf} ${j.first.split(" ").slice(1).join(" ")}` : sf, sl }; }),
    vac: null, nom: null, tries: 0, docket: [], decided: [], terms: {} };
  s.bench = { confirmed: 0, slips: 0 };
  // Already granted for the term ending June 2027.
  const june = weekOfDate(s, 2027, 5, 25);
  s.court.docket.push({ id: "aw27", name: "Challenge to state assault weapons bans", pid: "aw_ban", kind: "policy", week: june, tilt: 0.45, real: true },
    { id: "tar27", name: "Challenge to the President's replacement tariffs", pid: "tariffs_up", kind: "policy", week: june, tilt: 0.35, real: true });
}
const weekOfDate = (s, y, m, d) => Math.round((Date.UTC(y, m, d) - dateOf(0).getTime()) / (7 * 86400000));
export const onBench = (s) => (s.court?.j || []).filter((j) => !j.gone);
export function courtMedian(s) { const xs = onBench(s).map((j) => j.x).sort((a, b) => a - b), n = xs.length; return n ? (n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2) : 0; }
const senMaj = () => (SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R");
function newJusticeNom(s, pick, consensus) {
  const [first, last, cont, x, born] = pick, [sf, sl] = swapPair(first, last);
  s.court.nom = { first, last, sf: consensus ? first : sf, sl: consensus ? last : sl, cont, x: PP === "R" ? x : -x, born, g: /a$|i$|e$/.test(first) ? "F" : "M", consensus: !!consensus, hearing: s.week + 4, vote: s.week + 7, by: PP };
  pushNews(s, `The President nominates ${s.court.nom.first} ${s.court.nom.last} to the Supreme Court. ${cont > 0.6 ? "Democrats call the pick a provocation." : cont < 0.2 ? "Senators in both parties sound open to it." : "A confirmation fight is coming."}`, "event");
  if (senMaj() !== PP && rweek(s) >= 56 && rng(hash(`${s.seed}:garland:${s.week}`))() < 0.6) { s.court.nom.blocked = true; pushNews(s, `Senate ${senMaj() === "D" ? "Democrats" : "Republicans"} refuse to hold hearings in an election year: "Let the voters decide."`, "event"); return; }
  if (roleOf(s) === "S") pushInbox(s, { kind: "scotusvote", from: "Your legislative director", title: `Supreme Court vote: ${s.court.nom.first} ${s.court.nom.last}`, body: `The floor vote is ${fmtDate(s.court.nom.vote)}; it takes a simple majority. ${cont > 0.6 ? "A combative pick with a thin record." : cont < 0.2 ? "A consensus pick with a long, moderate record." : "A conservative judge with a real record."} This vote will follow you for the rest of your career.`, choices: ["Vote to confirm", "Vote no"] });
}
function consensusPick(s, r) { return [PF[Math.floor(r() * PF.length)], PL[Math.floor(r() * PL.length)], 0.12, 0.25, 1966]; }
function presNominates(s, r) {
  if (roleOf(s) === "P") {
    const used = new Set([...(s.court.used || [])]), picks = SHORTLIST.filter((x) => !used.has(x[1])).sort(() => r() - 0.5).slice(0, 3), c = consensusPick(s, r);
    pushInbox(s, { kind: "scotusnom", picks: [...picks, c], from: "White House Counsel", title: "A seat on the Supreme Court is open", body: `It's the most lasting thing you'll do. ${senMaj() === PP ? "Your party runs the Senate, so a loyalist can get through." : `${senMaj() === "D" ? "Democrats" : "Republicans"} run the Senate with ${SENATE.filter((m) => m.p === senMaj()).length} seats. A favorite of the movement will probably fail; a consensus pick angers your base but gets the seat.`}`,
      choices: [...picks.map(([f, l, cont]) => `${f} ${l} (${cont > 0.6 ? "a brawl" : cont > 0.4 ? "a fight" : "confirmable with effort"})`), `${c[0]} ${c[1]}, a consensus pick (base will hate it)`] });
    return;
  }
  const used = new Set(s.court.used || []), pool = SHORTLIST.filter((x) => !used.has(x[1]));
  const pick = s.court.tries >= 2 || !pool.length ? null : pool.sort((a, b) => (senMaj() === PP ? b[3] - a[3] : a[2] - b[2]) + (r() - 0.5) * 0.3)[0];
  if (PP !== "R") { const [f, l] = [PF[Math.floor(r() * PF.length)], PL[Math.floor(r() * PL.length)]]; newJusticeNom(s, [f, l, 0.3 + r() * 0.3, 0.55, 1975], true); return; }
  if (pick) (s.court.used = s.court.used || []).push(pick[1]);
  newJusticeNom(s, pick || consensusPick(s, r), !pick);
}
function scotusVote(s) {
  const n = s.court.nom; let yes = 0;
  for (const m of SENATE) {
    const same = m.p === n.by, rel = roleOf(s) === "P" ? (s.rel[m.id] || 0) * 0.3 : 0;
    const p = same ? sig(8 * (0.85 - n.cont * 0.55 - (s.presApproval < 35 ? 0.1 : 0) + rel)) : sig(8 * (-0.62 + (0.5 - n.cont) * 1.5 + (m.p === "D" ? m.x + 0.2 : 0.2 - m.x) * 0.9 + rel));
    const v = m.id === s.youId && n.yourVote !== undefined ? n.yourVote : noise(`${s.seed}:sc:${n.last}:${m.id}`) * 0.5 + 0.5 < p; if (v) yes++;
    if (m.id === s.youId && roleOf(s) === "S") n.mine = v;
  }
  return yes;
}
function courtWeek(s, r) {
  if (!s.court) courtSeed(s);
  const c = s.court, year = gameYear(s), d = dateOf(s.week), role = roleOf(s), you = memberById[s.youId];
  // Retirements at the end of the term (early July), and the odd sudden vacancy.
  if (!c.vac) {
    const july = d.getUTCMonth() === 6 && d.getUTCDate() <= 7 && !c.terms[`ret${year}`];
    for (const j of onBench(s)) {
      const age = year - j.born, friendly = j.by === PP ? (senMaj() === PP ? 4 : 0.6) : 0.15;
      const pr = july ? (age >= 75 ? 0.09 : age >= 70 ? 0.03 : 0.005) * friendly : age >= 80 ? 0.0012 : age >= 75 ? 0.0006 : 0.00005;
      if (r() < pr) { j.gone = true; j.left = year; c.vac = { i: c.j.indexOf(j), since: s.week, who: j.id }; c.tries = 0;
        pushNews(s, `${july ? `Justice ${j.sl} announces retirement` : `Justice ${j.sl} dies`}, opening a seat on the Supreme Court.`, "event");
        if (role !== "P") pushInbox(s, { kind: "staff", from: "Your legislative director", title: "A Supreme Court seat is open", body: `${role === "S" ? "The Senate confirms the replacement, and you'll get a vote. Every group you know is about to call." : "The House has no vote on it, but your base will want to hear from you."} The President will name someone within weeks.`, done: true });
        c.nomDue = s.week + 2; break; }
    }
    if (july) c.terms[`ret${year}`] = true;
  }
  if (c.vac && !c.nom && s.week >= (c.nomDue || 0)) presNominates(s, r);
  const n = c.nom;
  if (n && !n.blocked) {
    if (s.week === n.hearing) { pushNews(s, `Confirmation hearings open for ${n.first} ${n.last}.`, "event");
      if (role === "S" && (you.comm || []).some((x) => x.c === "SSJU")) pushScene(s, "confirm", { nom: `${n.first} ${n.last}`, cont: n.cont, by: n.by }, `Judiciary hearing: questioning ${n.first} ${n.last}`, "Judiciary Committee staff");
      if (role === "P") pushInbox(s, { kind: "staff", from: "White House Counsel", title: "Hearings are under way", body: `Your nominee needs ${51 - SENATE.filter((m) => m.p === PP).length > 0 ? 51 - SENATE.filter((m) => m.p === PP).length : 0} senators from the other party if every one of yours holds. Calls to wavering senators from the Chamber tab help.`, done: true }); }
    if (s.week >= n.vote) {
      const yes = scotusVote(s), ok = yes >= 51 || (yes === 50 && n.by === PP);
      if (ok) { const j = c.j[c.vac.i]; Object.assign(j, { first: n.first, last: n.last, sf: n.sf, sl: n.sl, born: n.born, by: n.by, x: n.x, since: year, g: n.g, gone: false, chief: false });
        pushNews(s, `The Senate confirms ${n.first} ${n.last} to the Supreme Court, ${yes}-${100 - yes}.`, "good"); c.vac = null; c.nom = null; if (role === "P") { s.legacy += 5; s.baseApproval = clamp(s.baseApproval + (n.consensus ? -4 : 4), 5, 99); } }
      else { pushNews(s, `The Senate rejects ${n.first} ${n.last} for the Supreme Court, ${yes}-${100 - yes}.`, "bad"); c.nom = null; c.tries++; c.nomDue = s.week + 2; if (role === "P") { s.presApproval = clamp(s.presApproval - 1.5, 20, 70); s.clout -= 6; } }
      if (role === "S" && n.mine !== undefined) { const aligned = n.mine === (you.p === n.by); s.baseApproval = clamp(s.baseApproval + (aligned ? 2 : -4), 5, 99); if (n.consensus && n.mine) s.approval = clamp(s.approval + 1, 5, 95); s.moments.push({ week: s.week, text: `You voted ${n.mine ? "to confirm" : "against"} ${n.first} ${n.last} for the Supreme Court.` }); }
    }
  }
  // Lower courts: a steady flow of nominations; a Senate run by the other party slows it to a trickle.
  if (s.week % 4 === 0) { const k = Math.round((2 + r() * 4) * (senMaj() === PP ? 1.6 : 0.5)); s.bench.confirmed += k; if (role === "P") s.legacy += k * 0.12; if (k && r() < 0.4) pushNews(s, `The Senate confirms ${k} federal judge${k > 1 ? "s" : ""} this month. ${s.bench.confirmed} this Congress.`); }
  if (role === "S" && r() < 0.025) {
    const nq = r() < 0.25, [f, l] = [PF[Math.floor(r() * PF.length)], PL[Math.floor(r() * PL.length)]];
    pushInbox(s, { kind: "blueslip", nq, from: "Senate Judiciary Committee", title: `Blue slip: ${f} ${l} for a district court in ${you.st}`, body: `The President nominated ${f} ${l} to a federal district court in your state. By Senate custom, the nominee doesn't get a hearing unless both home-state senators return a "blue slip." ${nq ? "The American Bar Association rated the nominee Not Qualified." : "The ABA rated the nominee Well Qualified."}`, choices: ["Return the blue slip", "Withhold it"] });
  }
  // Decision days in late June.
  for (const k of c.docket.filter((x) => !x.done && s.week >= x.week)) decideCase(s, k, r);
}
function decideCase(s, k, r) {
  k.done = true; const med = courtMedian(s), role = roleOf(s), you = memberById[s.youId];
  const left = billInfo(k.pid, "D").dir > 0 ? 1 : -1;        // which side wrote it
  let cons;                                                   // true: the conservative outcome
  if (k.kind === "law") { const strikeP = (VULN[k.pid] || 0.2) * sig(3.5 * med * left + 0.2); cons = left > 0 ? r() < strikeP : r() > strikeP; k.struck = left > 0 ? cons : !cons; }
  else if (k.kind === "eo") { cons = r() < 0.35 + med * 0.45; k.struck = !cons; }
  else cons = r() < sig(4 * med + (k.tilt || 0) - 1.2);
  const vote = (() => { const xs = onBench(s).map((j) => j.x), lean = cons ? 1 : -1, maj = xs.filter((x) => x * lean > -0.35 + (r() - 0.5) * 0.3).length; return `${Math.max(maj, Math.ceil(xs.length / 2 + 0.5))}-${xs.length - Math.max(maj, Math.ceil(xs.length / 2 + 0.5))}`; })();
  k.vote = vote; k.cons = cons;
  let text;
  if (k.kind === "law") { text = k.struck ? `The Supreme Court strikes down ${byId[k.pid].name}, ${vote}.` : `The Supreme Court upholds ${byId[k.pid].name}, ${vote}.`; if (k.struck) { s.laws = s.laws.filter((p) => p !== k.pid); if (left > 0) { s.mood = clamp(s.mood + 0.35, -12, 12); s.boost.court_expansion = (s.boost.court_expansion || 0) + 0.06; s.boost.term_limits = (s.boost.term_limits || 0) + 0.04; } } }
  else if (k.kind === "eo") { const e = (s.eos || []).find((x) => x.pid === k.pid); text = k.struck ? `The Supreme Court leaves the block on the President's order on ${byId[k.pid].name} in place, ${vote}.` : `The Supreme Court revives the President's order on ${byId[k.pid].name}, ${vote}.`; if (e && !k.struck) { e.alive = true; s.legacy += 1; s.presApproval = clamp(s.presApproval + 0.4, 20, 70); } }
  else text = `${k.name}: the Supreme Court sides with ${cons ? "the conservative side" : "the liberal side"}, ${vote}.`;
  if (k.pid === "aw_ban" && k.kind === "policy") text = cons ? `The Supreme Court strikes down state assault weapons bans, ${vote}.` : `The Supreme Court upholds state assault weapons bans, ${vote}.`;
  if (k.pid === "tariffs_up" && k.kind === "policy") text = cons ? `The Supreme Court lets the President's replacement tariffs stand, ${vote}.` : `The Supreme Court strikes down the President's replacement tariffs, ${vote}.`;
  pushNews(s, text, "event"); s.court.decided.unshift({ ...k, text, week: s.week }); if (s.court.decided.length > 20) s.court.decided.pop();
  if (role !== "P") pushInbox(s, { kind: "ruling", cons, from: "Your communications director", title: text.replace("The Supreme Court", "The Court"), body: `${cons === (you.p === "R") ? "Your side won this one." : "Your side lost this one."} Reporters want a statement.`, choices: ["Praise the decision", "Blast the Court", "Say nothing"] });
}
// Laws passed this Congress draw lawsuits; the Court rules the next June.
function docketLaw(s, pid, r) {
  if (!s.court || !VULN[pid] || r() > VULN[pid] + 0.15) return;
  const y = gameYear(s), w = weekOfDate(s, y, 5, 26), when = w - s.week >= 16 ? w : weekOfDate(s, y + 1, 5, 26);
  if (!s.court.docket.some((k) => k.pid === pid && !k.done)) { s.court.docket.push({ id: `law${pid}${s.week}`, name: `Challenge to ${byId[pid].name}`, pid, kind: "law", week: when }); pushNews(s, `Opponents sue to block ${byId[pid].name}. The Supreme Court agrees to hear the case.`); }
}

// ════════ Crises abroad and at home, pardons, the State of the Union ════════
const CRISES = [
  { id: "taiwan", title: "Chinese warships encircle Taiwan", news: "China calls it a drill. Shipping through the strait has stopped.", force: "Send a carrier group and warn Beijing", risk: 0.2, econ: 0.5 },
  { id: "iran", title: "Iran is weeks from a bomb, intelligence says", news: "Inspectors were expelled and centrifuges are spinning.", force: "Order airstrikes on the nuclear sites", risk: 0.35, econ: 0.6, war: true },
  { id: "baltic", title: "Russian drones strike a NATO ally", news: "A warehouse in Lithuania burns; Moscow calls it a mistake.", force: "Send troops and jets to the Baltics", risk: 0.2, econ: 0.3 },
  { id: "cartel", title: "A cartel ambush kills Americans near the border", news: "Four U.S. citizens are dead; the video is everywhere.", force: "Order strikes on cartel camps in Mexico", risk: 0.3, econ: 0.3, war: true },
  { id: "hostage", title: "Americans are taken hostage abroad", news: "Eleven aid workers are held by an armed group.", force: "Order a rescue raid", risk: 0.4, econ: 0 },
  { id: "cyber", title: "A cyberattack blacks out three states", news: "Millions lose power; investigators point to a foreign government.", force: "Order a cyber strike back", risk: 0.25, econ: 0.4 },
  { id: "korea", title: "North Korea fires a missile over Japan", news: "Tokyo issues shelter alerts; Seoul raises its readiness level.", force: "Move bombers and missile defenses into the region", risk: 0.15, econ: 0.2 },
];
export const CRISIS_OPTS = ["force", "talk", "sanction", "wait"];
const optLabel = (c) => [c.force, "Open talks through back channels", "Hit them with sanctions", "Stay out of it for now"];
function crisisWeek(s, r) {
  const role = roleOf(s), you = memberById[s.youId];
  for (const c of s.crises || []) if (!c.done && c.choice != null && s.week >= c.resolve) resolveCrisis(s, c, r);
  for (const m of s.inbox) if (m.kind === "crisis" && !m.done && m.week < s.week - 1) { m.done = true; m.choice = 3; pickCrisis(s, m.cid, 3); }
  if ((s.crises || []).some((c) => !c.done) || s.week - (s.crisisAt ?? -99) < 10 || r() > 0.05) return;
  const used = new Set((s.crises || []).map((c) => c.id)), pool = CRISES.filter((c) => !used.has(c.id)); if (!pool.length) return;
  const t = pool[Math.floor(r() * pool.length)], c = { id: t.id, cid: `cr${s.week}`, week: s.week, choice: null, done: false };
  (s.crises = s.crises || []).push(c); s.crisisAt = s.week;
  pushNews(s, `BREAKING: ${t.title}. ${t.news}`, "event");
  if (role === "P") pushInbox(s, { kind: "crisis", cid: c.cid, from: "The Situation Room", title: t.title, body: `${t.news} The National Security Council is waiting. Force can rally the country or start something you can't stop. Talks look weak if they fail. Sanctions cost Americans at the pump. Waiting is a choice too.`, choices: optLabel(t) });
  else { const pick = r() < 0.4 ? 0 : r() < 0.6 ? 2 : r() < 0.75 ? 1 : 3; pickCrisis(s, c.cid, pick); }
}
function pickCrisis(s, cid, choice) {
  const c = (s.crises || []).find((x) => x.cid === cid); if (!c || c.choice != null) return;
  const t = CRISES.find((x) => x.id === c.id), role = roleOf(s), you = memberById[s.youId], kind = CRISIS_OPTS[choice];
  c.choice = choice; c.kind = kind; c.resolve = s.week + 4;
  const fx = { force: [2.5, 2], talk: [0, -2], sanction: [0.8, 1], wait: [-0.8, -2.5] }[kind];
  s.presApproval = clamp(s.presApproval + fx[0], 20, 70); if (role === "P") s.baseApproval = clamp(s.baseApproval + fx[1], 5, 99);
  if (kind === "sanction") s.econ.inflation = clamp(s.econ.inflation + t.econ * 0.3, 1, 7);
  if (kind === "force" && t.war) s.boost.war_powers = (s.boost.war_powers || 0) + 0.08;
  const what = ["orders the military to act", "opens back-channel talks", "announces sweeping sanctions", "holds off for now"][choice];
  pushNews(s, `${t.title}: the President ${what}.`, "event");
  if (role !== "P") pushInbox(s, { kind: "crisisreact", cid, force: kind === "force", from: "Your communications director", title: `The President ${what}`, body: `${t.title}. Reporters want to know where you stand.${kind === "force" ? " Some members want a vote under the War Powers Resolution before this goes further." : ""}`, choices: kind === "force" ? ["Back the President", "Criticize the decision", "Demand a war powers vote"] : ["Back the President", "Criticize the decision", "Say nothing"] });
}
function resolveCrisis(s, c, r) {
  c.done = true; const t = CRISES.find((x) => x.id === c.id), risk = { force: t.risk, talk: 0.45, sanction: 0.3, wait: 0.4 }[c.kind], ok = r() > risk;
  c.ok = ok;
  const good = { force: [1, "The show of force works. The other side backs down."], talk: [2, "The talks produce a deal. Critics who called it weakness go quiet."], sanction: [0.8, "The sanctions bite, and the pressure works."], wait: [0.5, "It burns out on its own."] }[c.kind];
  const bad = { force: [-3, "It escalates. American casualties, and oil prices spike."], talk: [-2, "The talks collapse, and the President looks weak."], sanction: [-1.2, "The sanctions hurt us more than them; prices rise."], wait: [-2.2, "It gets worse while Washington watched."] }[c.kind];
  const [d, txt] = ok ? good : bad;
  s.presApproval = clamp(s.presApproval + d, 20, 70);
  if (!ok && (c.kind === "force" || c.kind === "sanction")) { s.econ.inflation = clamp(s.econ.inflation + t.econ * 0.5, 1, 7); s.econ.growth = clamp(s.econ.growth - t.econ * 0.4, -2.5, 4); }
  if (!ok) s.mood = clamp(s.mood + 0.4 * PSIGN(), -12, 12);
  c.text = txt; pushNews(s, `${t.title}: ${txt}`, ok ? "good" : "bad");
  if (roleOf(s) === "P") { s.legacy += ok ? 2 : -2; pushInbox(s, { kind: "staff", from: "The Situation Room", title: ok ? "It worked" : "It went wrong", body: txt, done: true }); }
  // Members who took a side are judged on how it turned out.
  const st = c.stance; if (st != null && roleOf(s) !== "P") { const backed = st === 0; s.approval = clamp(s.approval + (backed === ok ? 1 : -1) * 0.8, 5, 95); }
}
const PARDONS = [
  { who: "your former campaign chairman, convicted of tax fraud and lying to investigators", base: 1.5, app: -2.5, heat: 0.08, crony: true },
  { who: "a major donor's son, convicted of securities fraud", base: 0, app: -2, heat: 0.07, crony: true },
  { who: "a grandmother serving life for a nonviolent drug offense", base: -0.3, app: 1.2, heat: 0, legacy: 1 },
  { who: "a police officer convicted of excessive force in a case caught on video", base: 2, app: -1.5, heat: 0.02 },
  { who: "a crypto founder who gave millions to your inaugural committee", base: 0.4, app: -2.2, heat: 0.1, crony: true },
  { who: "a decorated veteran convicted over a shooting in a war zone", base: 2, app: -0.4, heat: 0 },
  { who: "a former governor from your party, convicted of bribery", base: 0.5, app: -2, heat: 0.06, crony: true },
  { who: "a whistleblower who leaked surveillance documents", base: -1, app: 0.4, heat: 0, legacy: 1 },
  { who: "protesters convicted of blocking a clinic entrance", base: 1.5, app: -0.8, heat: 0.01 },
];
function pardonWeek(s, r) {
  const role = roleOf(s); if (r() > 0.07 || s.week - (s.pardonAt ?? -99) < 8) return;
  const used = new Set(s.pardonsUsed || []), pool = PARDONS.map((p, i) => ({ ...p, i })).filter((p) => !used.has(p.i)); if (!pool.length) return;
  const p = pool[Math.floor(r() * pool.length)]; s.pardonAt = s.week; (s.pardonsUsed = s.pardonsUsed || []).push(p.i);
  if (role === "P") { pushInbox(s, { kind: "pardon", pi: p.i, from: "White House Counsel", title: "A pardon request on your desk", body: `The request is for ${p.who}. The power is absolute and can't be undone. ${p.crony ? "Your critics will call it a reward for loyalty, and House Democrats will want hearings." : p.app > 0 ? "Reform groups on both sides have been pushing for it." : "Your base wants it. Most of the country doesn't."}`, choices: ["Grant a full pardon", "Commute the sentence", "Deny it"] }); return; }
  if (p.crony || r() < 0.4) { pushNews(s, `The President pardons ${p.who.replace(/\byour\b/g, "his")}.`, "event");
    pushInbox(s, { kind: "pardonreact", crony: !!p.crony, from: "Your communications director", title: "The President issued a controversial pardon", body: `He pardoned ${p.who.replace("your ", "his ")}. ${p.crony ? "Democrats are calling it pay-to-play." : "It's splitting people along the usual lines."} Do you say anything?`, choices: ["Condemn it", "Defend it", "Say nothing"] });
    if (p.crony) s.boost.pardon_reform = (s.boost.pardon_reform || 0) + 0.04; }
}
function answerPardon(s, m, choice) {
  const p = PARDONS[m.pi], k = [1, 0.5, 0][choice];
  if (choice === 2) { s.baseApproval = clamp(s.baseApproval - Math.max(0, p.base) * 0.4, 5, 99); s.toast = { title: "Denied", text: "The request goes back in the file.", tone: "" }; return; }
  s.baseApproval = clamp(s.baseApproval + p.base * k, 5, 99); s.presApproval = clamp(s.presApproval + p.app * k, 20, 70); s.presHeat = clamp(s.presHeat + p.heat * k, 0, 1); s.legacy += (p.legacy || 0) * k;
  if (p.crony) s.boost.pardon_reform = (s.boost.pardon_reform || 0) + 0.05 * k;
  pushNews(s, `The President ${choice === 0 ? "pardons" : "commutes the sentence of"} ${p.who.replace("your ", "his ")}.`, p.app > 0 ? "good" : "bad");
  s.toast = { title: choice === 0 ? "Pardoned" : "Commuted", text: p.crony ? "The story leads every newscast. Democrats announce an investigation." : p.app > 0 ? "Even some of your critics call it the right thing." : "Your base cheers. Everyone else is furious.", tone: p.app > 0 ? "good" : "" };
}
function sotuWeek(s, r) {
  const rw = rweek(s); if (rw !== 5 && rw !== 57) return;
  if (roleOf(s) === "P") pushScene(s, "sotu", { year: gameYear(s) }, "The State of the Union is tonight", "Speechwriters");
  else pushNews(s, `The President delivers the State of the Union, ${PP === "R" ? "Republicans" : "Democrats"} cheering and the other side sitting on its hands.`, "event");
}
function answerWorld(s, m, choice) {
  const you = memberById[s.youId];
  if (m.kind === "crisis") pickCrisis(s, m.cid, choice);
  if (m.kind === "crisisreact") { const c = (s.crises || []).find((x) => x.cid === m.cid); if (c) c.stance = choice; const mine = you.p === PP;
    if (choice === 0) { s.baseApproval = clamp(s.baseApproval + (mine ? 1.5 : -1.5), 5, 99); s.rapport = clamp(s.rapport + 0.08, -1, 1); }
    if (choice === 1) { s.baseApproval = clamp(s.baseApproval + (mine ? -2 : 1.5), 5, 99); s.profile = clamp(s.profile + 1, 0, 100); if (mine) s.rapport = clamp(s.rapport - 0.12, -1, 1); }
    if (choice === 2 && m.force) { s.profile = clamp(s.profile + 3, 0, 100); s.baseApproval = clamp(s.baseApproval + (mine ? -2.5 : 2), 5, 99); let b = s.bills.find((x) => x.pid === "war_powers" && !x.dead);
      if (!b && !s.laws.includes("war_powers")) b = addBill(s, "war_powers", s.youId, 3);
      if (b && !b.privileged && b.stage === "committee") { b.privileged = b.discharged = b.marked = true; b.floorWeek = s.week + 2; }
      s.toast = { title: "You forced a war powers vote", text: "Under the War Powers Resolution it comes to the floor in two weeks, and the Senate needs only 51. Everyone goes on the record.", tone: "good" }; } }
  if (m.kind === "pardon") answerPardon(s, m, choice);
  if (m.kind === "pardonreact") { const mine = you.p === PP; if (choice === 0) { s.baseApproval = clamp(s.baseApproval + (mine ? -1.5 : 1.5), 5, 99); s.integrity += 2; if (mine) s.rapport = clamp(s.rapport - 0.1, -1, 1); }
    if (choice === 1) { s.baseApproval = clamp(s.baseApproval + (mine ? 1.2 : -2), 5, 99); s.approval = clamp(s.approval - (m.crony ? 1 : 0.3), 5, 95); if (m.crony) s.integrity -= 3; } }
  if (m.kind === "scotusnom") { const pick = m.picks[choice]; if (pick) { const cons = choice === m.picks.length - 1; if (!cons) (s.court.used = s.court.used || []).push(pick[1]); newJusticeNom(s, pick, cons); } }
  if (m.kind === "scotusvote" && s.court?.nom) s.court.nom.yourVote = choice === 0;
  if (m.kind === "blueslip") { const mine = you.p === PP; s.bench.slips++;
    if (choice === 0) { s.rapport = clamp(s.rapport + 0.08, -1, 1); s.baseApproval = clamp(s.baseApproval + (mine ? 0.5 : m.nq ? -2 : -0.6), 5, 99); if (m.nq) s.integrity -= 3; }
    else { s.rapport = clamp(s.rapport - (mine ? 0.15 : 0.05), -1, 1); s.baseApproval = clamp(s.baseApproval + (mine ? -1 : 1), 5, 99); if (m.nq) s.integrity += 2; } }
  if (m.kind === "ruling") { const liked = m.cons === (you.p === "R");
    if (choice === 0) s.baseApproval = clamp(s.baseApproval + (liked ? 1.2 : -2.5), 5, 99);
    if (choice === 1) { s.baseApproval = clamp(s.baseApproval + (liked ? -2.5 : 1.5), 5, 99); s.profile = clamp(s.profile + 1, 0, 100); if (!liked) s.approval = clamp(s.approval - 0.3, 5, 95); } }
}

// ════════ Your own money: salary, investments, a book, and the things that get people in trouble ════════
// Real numbers (CRS, 2026): $174,000 for members, $193,400 for party leaders and the President pro tempore,
// $223,500 for the Speaker, $400,000 for the President. Honoraria are banned for members (since 1991);
// outside earned income is capped at $33,855; book royalties from an established publisher are exempt.
export const OUTSIDE_CAP = 33.855;
export function salaryOf(s) { if (roleOf(s) === "P") return 400; const l = memberById[s.youId]?.lead?.[0] || ""; return /^Speaker/.test(l) ? 223.5 : /Majority Leader|Minority Leader|Republican Leader|Democratic Leader|Pro Tempore/.test(l) && !/Assistant/.test(l) ? 193.4 : 174; }
export const TRADE = { none: { label: "Cash and bonds", mu: 0.0007, sd: 0.001 }, index: { label: "Index funds", mu: 0.0015, sd: 0.02 }, active: { label: "Pick individual stocks", mu: 0.0016, sd: 0.032 }, informed: { label: "Trade on what you hear in closed briefings", mu: 0.0055, sd: 0.03 } };
export const earnTotal = (s) => Object.values(s.earn || {}).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
function earnSeed(s) { const you = memberById[s.youId]; s.earn = { salary: 0, invest: 0, book: 0, outside: 0, spouse: 0, family: 0, after: 0 }; s.port = roleOf(s) === "P" ? 0 : Math.round(150 + (you?.seniority || 0) * 70 + (you?.lead?.length ? 500 : 0) + (2027 - (you?.born || 1975)) * 8); s.trade = "index"; }
function scandal(s, title, body, choices, kind = "money") { pushInbox(s, { kind: "moneyscandal", sub: kind, from: "Your communications director", title, body, choices }); }
function earnWeek(s, r) {
  if (!s.earn) earnSeed(s);
  const e = s.earn, role = roleOf(s), you = memberById[s.youId], banned = s.laws.includes("stock_ban");
  e.salary += salaryOf(s) / 52.18;
  if (role !== "P") {
    if (banned && (s.trade === "active" || s.trade === "informed") && !s.divested) { s.divested = true; s.trade = "index"; pushInbox(s, { kind: "staff", from: "Your chief of staff", title: "The stock trading ban is law", body: "Members can't hold or trade individual stocks anymore. Your portfolio was moved into index funds.", done: true }); }
    const t = TRADE[s.trade] || TRADE.index, g = s.port * (t.mu + noise(`${s.seed}:mkt:${s.week}`) * t.sd * 0.8 + (s.trade !== "index" && s.trade !== "none" ? noise(`${s.seed}:pick:${s.week}`) * t.sd * 0.5 : 0));
    s.port += g; e.invest += g;
    if (s.trade === "informed" && r() < 0.011 * (1 + s.profile / 100) * (onApprops(you) || (you.comm || []).some((c) => ["HSAS", "SSAS", "HSIF", "HSBA", "SSBK", "SSIN", "HLIG"].includes(c.c)) ? 1.3 : 1))
      scandal(s, "A trading tracker flags your well-timed trades", "A website that follows congressional stock disclosures noticed you bought shares days before a closed-door briefing turned into public news. Legal under the STOCK Act only if you didn't use what you heard. Reporters are calling.", ["Sell everything and apologize", "Blame your financial adviser", "Attack the reporters"], "stock");
    if (s.teach) { e.outside += OUTSIDE_CAP / 52.18; s.hours = Math.max(0, s.hours - 3); }
    if (s.book && s.book.until > s.week) e.book += s.book.roy;
    if (s.spousePay) { const x = Math.min(s.cash, 2.5); s.cash -= x; e.spouse += x; if (r() < 0.004 + s.profile / 30000) scandal(s, "Your spouse is on the campaign payroll", "A local paper reports your campaign has paid your spouse about $130,000 a year as a 'senior adviser.' Legal if it's real work at a fair rate. It doesn't look that way in print.", ["Take them off the payroll", "Defend it", "Ignore it"], "spouse"); }
    if (s.spouseConsult) { e.spouse += 4; s.integrity -= 0.08; if (r() < 0.006 + s.profile / 25000) scandal(s, "Your spouse's clients have business before your committee", "An investigation finds companies lobbying your committee hired your spouse's consulting firm. No law clearly bars it. The story writes itself anyway.", ["Have your spouse drop those clients", "Say you're walled off", "Attack the reporters"], "consult"); }
  } else if (s.family) { e.family += 55; s.presHeat = clamp(s.presHeat + 0.004, 0, 1); if (r() < 0.012) { s.presHeat = clamp(s.presHeat + 0.06, 0, 1); s.presApproval = clamp(s.presApproval - 1.2, 20, 70); pushNews(s, "Report: a foreign government's fund put money into a venture run by the President's family.", "bad"); } }
}
function answerScandal(s, m, choice) {
  const k = m.sub;
  if (k === "stock") { if (choice === 0) { s.approval = clamp(s.approval - 2, 5, 95); s.integrity -= 4; s.trade = "index"; s.toast = { title: "You sold it all", text: "Index funds from here on. The story fades in a week.", tone: "" }; }
    else if (choice === 1) { s.approval = clamp(s.approval - 3.5, 5, 95); s.integrity -= 8; s.toast = { title: "Nobody believes it", text: "Your disclosures show the trades were in your own account.", tone: "bad" }; }
    else { s.approval = clamp(s.approval - 4.5, 5, 95); s.baseApproval = clamp(s.baseApproval + 1, 5, 99); s.integrity -= 10; s.toast = { title: "You went after the press", text: "Your base cheers. A watchdog files an ethics complaint.", tone: "bad" }; pushInbox(s, { kind: "ethics", from: "The Office of Congressional Ethics", title: "A complaint over your stock trades", body: "A watchdog asks the ethics office to investigate whether you traded on nonpublic information.", choices: ["Fight it (10 hours, $150K)", "Ignore it", "Give back the money"] }); }
    if (s.laws.includes("stock_ban")) s.approval = clamp(s.approval - 2, 5, 95);
    pushNews(s, `${nameOf(memberById[s.youId])} faces questions over well-timed stock trades.`, "bad"); }
  if (k === "spouse") { if (choice === 0) { s.spousePay = false; s.approval = clamp(s.approval - 0.8, 5, 95); } else if (choice === 1) { s.approval = clamp(s.approval - 1.8, 5, 95); s.integrity -= 4; } else { s.approval = clamp(s.approval - 2.5, 5, 95); s.integrity -= 5; } }
  if (k === "consult") { if (choice === 0) { s.spouseConsult = false; s.approval = clamp(s.approval - 1, 5, 95); } else if (choice === 1) { s.approval = clamp(s.approval - 2.5, 5, 95); s.integrity -= 6; } else { s.approval = clamp(s.approval - 3.5, 5, 95); s.baseApproval = clamp(s.baseApproval + 0.8, 5, 99); s.integrity -= 8; } }
}
export function setMoney(s0, key, val) {
  const s = structuredClone(s0); if (!s.earn) earnSeed(s);
  if (key === "trade" && TRADE[val]) { if (s.laws.includes("stock_ban") && (val === "active" || val === "informed")) { s.toast = { title: "Not allowed", text: "The stock trading ban is law: members can't trade individual stocks.", tone: "bad" }; return s; } s.trade = val; }
  if (["teach", "spousePay", "spouseConsult", "family"].includes(key)) s[key] = !!val;
  return s;
}
export function bookDeal(s0, bulk = false) {
  const s = structuredClone(s0), you = memberById[s.youId]; if (!s.earn) earnSeed(s);
  if (bulk) { if (!s.book || s.cash < 100) return s; s.cash -= 100; s.earn.book += 15; s.integrity -= 6; if (rng(hash(`${s.seed}:bulk:${s.week}`))() < 0.3) { s.approval = clamp(s.approval - 1.5, 5, 95); pushNews(s, `${nameOf(you)}'s campaign spent $100,000 buying copies of ${nameOf(you)}'s own book.`, "bad"); } s.toast = { title: "Your campaign bought 4,000 copies", text: "Legal, and common. It also pads your royalties with your donors' money, and reporters look for it.", tone: "" }; return s; }
  if (s.book?.term === (s.term || 1) || s.profile < 25 || s.hours < 10) return s;
  s.hours -= 10; const adv = Math.round(15 + Math.pow(s.profile / 10, 2.6) * 4);
  s.earn.book += adv; s.book = { term: s.term || 1, adv, roy: Math.round(adv / 60), until: s.week + 52 };
  pushNews(s, `${titleOf(you)} ${nameOf(you)} signs a book deal.`);
  s.toast = { title: `A $${adv}K advance`, text: "Book royalties from an established publisher are exempt from the cap on outside income, with the ethics committee's sign-off. Royalties will trickle in for a year.", tone: "good" };
  return s;
}
// After Washington: what the next ten years are worth, roughly.
export function afterPaths(s) {
  const you = memberById[s.youId], role = roleOf(s), cl = s.clout || 0, pr = s.profile || 0, lead = !!you?.lead?.length;
  if (role === "P") return [["book", "Memoirs and the speaking circuit", Math.round(20000 + pr * 300)], ["boards", "A foundation, boards and private deals", Math.round(25000 + s.legacy * 400)], ["home", "Go home and stay out of it", 2000]];
  return [["lobby", `K Street lobbyist (after a ${you.ch === "S" ? "two-year" : "one-year"} cooling-off period)`, Math.round(Math.min(2500, 300 + Math.max(0, cl) * 4 + (lead ? 700 : 0)) * (you.ch === "S" ? 8 : 9))],
    ["boards", "Corporate boards and consulting", Math.round(Math.min(1500, 150 + Math.max(0, cl) * 4 + you.seniority * 15) * 10)], ["speak", "Speeches, a memoir and cable TV", Math.round(Math.min(3000, 60 + Math.pow(pr / 10, 2.2) * 10) * 10)], ["home", "Go home: a law practice or teaching", 1800]];
}
export function chooseAfter(s0, key) { const s = structuredClone(s0); if (!s.earn) earnSeed(s); const p = afterPaths(s).find((x) => x[0] === key); if (p) { s.earn.after = p[2]; s.afterPath = p[1]; } return s; }

// ════════ Outside players: donors, PACs, movement groups, foreign influence ════════
export { ORGS, orgById };
export const orgName = (o, real) => (real ? o.real : o.name);
const caresOf = (o) => o.cares || groupById[o.gid]?.cares || {};
// How well you fit what they want: your party, where you sit, and how you've voted on their issues.
export function orgFit(s, o) {
  const you = memberById[s.youId]; if (!you) return 0;
  const party = o.party === "any" ? 0 : o.party === you.p ? 0.35 : -0.6;
  const ideo = o.kind === "foreign" ? 0 : 0.45 - Math.abs((you.x || 0) - o.x) * 0.6;
  const c = caresOf(o); let v = 0, n = 0;
  for (const vc of s.votesCast || []) if (c[vc.pid]) { v += (vc.vote ? 1 : -1) * c[vc.pid]; n++; }
  return clamp(party + ideo + (n ? (v / n) * 0.5 : 0), -1, 1);
}
const orgState = (s, id) => ((s.orgs = s.orgs || {})[id] = s.orgs[id] || { rel: 0, given: 0, met: 0, last: -99, endorsed: false });
const MEET_WHY = {
  pac: ["want to walk you through their priorities for the year", "want to talk about the bill coming up in your committee", "are hosting a lunch for a few members and want you there"],
  donor: ["want to get to know you over dinner", "have some thoughts about your race", "are thinking about where to put their money this cycle"],
  org: ["want to talk about where you stand", "want you to speak at their next event", "want to share what their members are hearing"],
};
function orgWeek(s, r) {
  if (roleOf(s) === "P") return;
  const you = memberById[s.youId];
  for (const m of s.inbox) if ((m.kind === "orgmeet" || m.kind === "orgoffer" || m.kind === "foreign") && !m.done && m.week < s.week - 1) { m.done = true; m.choice = -1; if (m.kind === "orgmeet") orgState(s, m.org).rel -= 0.03; }
  if (s.week - (s.orgAt ?? -99) < 2) return;
  // Foreign influence is rare and gets more likely as your profile grows.
  if (r() < 0.012 + s.profile / 8000) { const fs = ORGS.filter((o) => o.kind === "foreign"), o = fs[Math.floor(r() * fs.length)], k = Math.floor(r() * 3); s.orgAt = s.week;
    const offers = [
      { t: "An all-expenses-paid trip abroad", b: `${o.name} invites you and your spouse on a week-long "fact-finding" trip, five-star hotels included. Some foreign-government-paid travel is allowed if the ethics committee approves it in advance. This one hasn't been approved.`, amt: 0, risk: 0.2 },
      { t: "A generous 'consulting' arrangement", b: `A middleman for ${o.name.toLowerCase()} suggests your spouse's firm could do some "consulting" for $250,000 a year. Nobody mentions your committee. Nobody has to.`, amt: 250, risk: 0.35 },
      { t: "An offer to 'help your campaign'", b: `Someone tied to ${o.name.toLowerCase()} says a group of American donors could each give the maximum to your campaign, and they'd be reimbursed. That's a straw-donor scheme with foreign money: two federal crimes.`, amt: 400, risk: 0.5 },
    ][k];
    pushInbox(s, { kind: "foreign", org: o.id, k, amt: offers.amt, risk: offers.risk, from: o.name, title: offers.t, body: offers.b, choices: ["Accept", "Decline politely", "Decline and report it to the FBI"] });
    return; }
  if (r() > 0.32 + s.profile / 300) return;
  const pool = ORGS.filter((o) => o.kind !== "foreign" && !(o.id === "emily" && you.g !== "F")).map((o) => ({ o, f: orgFit(s, o) + (orgState(s, o.id).rel) * 0.5 }));
  // Groups reach out to people they like, and to people they want to scare.
  const c = pool.filter((x) => x.f > 0.15 || (x.f < -0.2 && x.o.kind === "donor" && x.o.party === you.p)).sort(() => r() - 0.5)[0]; if (!c) return;
  const o = c.o, st = orgState(s, o.id); s.orgAt = s.week;
  const live = s.bills.find((b) => b.stage === "committee" && !b.dead && caresOf(o)[b.pid] && b.floorWeek > s.week && b.yourVote == null);
  if (c.f < 0) { // a threat
    pushInbox(s, { kind: "orgoffer", org: o.id, threat: true, bill: live?.id, want: live ? caresOf(o)[live.pid] > 0 : null, from: o.name, title: o.mega ? `${o.name} is watching your votes` : `${o.name} has a warning`, body: `${o.mega ? "A post goes up overnight: members who vote the wrong way \"will be primaried.\" Your name is in the replies." : "Their lobbyist says your record is noticed, and not kindly."}${live ? ` They want a ${caresOf(o)[live.pid] > 0 ? "yes" : "no"} on ${byId[live.pid].name}.` : ""}`, choices: live ? [`Vote ${caresOf(o)[live.pid] > 0 ? "yes" : "no"} to keep the peace`, "Ignore it", "Hit back publicly"] : ["Ignore it", "Hit back publicly"] });
    return; }
  if (st.met >= 1 && (o.budget > 0 || o.kind === "org") && r() < 0.55) { // an offer
    const amt = o.kind === "org" ? 0 : Math.round(o.mega ? (you.p === o.party ? 300 + r() * 900 : 0) : o.budget * (0.6 + r() * 0.8));
    if (o.mega && you.p !== o.party) return;
    pushInbox(s, { kind: "orgoffer", org: o.id, amt, bill: live?.id, want: live ? caresOf(o)[live.pid] > 0 : null, from: o.name,
      title: o.kind === "org" ? `${o.name} wants to endorse you` : o.mega ? `${o.name} wants to spend in your race` : `${o.name} wants to back you`,
      body: o.kind === "org" ? `Their endorsement comes with volunteers and an audience.${live ? ` They'd like to see you ${caresOf(o)[live.pid] > 0 ? "vote yes" : "vote no"} on ${byId[live.pid].name}.` : " They'll expect you to stay with them on the issues they care about."}` : o.mega ? `A super PAC funded by ${o.name} would spend about $${(amt / 1000).toFixed(1)}M for you. You can't coordinate with it, but everyone knows who it answers to.${live ? ` Word is they'd like a ${caresOf(o)[live.pid] > 0 ? "yes" : "no"} on ${byId[live.pid].name}.` : ""}` : `Their PAC would give $${amt}K this cycle, and they'd bundle more from their executives.${live ? ` They mention ${byId[live.pid].name} is coming up, and what they hope you'll do.` : ""}`,
      choices: ["Accept", "Accept, but promise nothing", "Decline"] });
    return; }
  const why = MEET_WHY[o.kind === "pac" ? "pac" : o.kind][Math.floor(r() * 3)];
  pushInbox(s, { kind: "orgmeet", org: o.id, from: o.name, title: `${o.name} would like a meeting`, body: `They ${why}. ${o.note}`, choices: ["Take the meeting (3 hours)", "Send a staffer", "Decline"] });
}
function answerOrg(s, m, choice) {
  const o = orgById[m.org], st = orgState(s, o.id), you = memberById[s.youId];
  if (m.kind === "orgmeet") {
    if (choice === 0 && s.hours >= 3) { s.hours -= 3; st.rel = clamp(st.rel + 0.2, -1, 1); st.met++; st.last = s.week; s.toast = { title: `You met with ${o.name}`, text: o.kind === "org" ? "They leave with your number, and you leave with a sense of what they could do for you." : "Coffee, talking points and a folder of one-pagers. They'll be back.", tone: "good" }; }
    else if (choice === 1) { st.rel = clamp(st.rel + 0.05, -1, 1); st.met += 0.5; }
    else st.rel = clamp(st.rel - 0.08, -1, 1);
  }
  if (m.kind === "orgoffer" && m.threat) {
    const b = s.bills.find((x) => x.id === m.bill), opts = m.bill ? ["give", "ignore", "fight"] : ["ignore", "fight"], c = opts[choice] || "ignore";
    if (c === "give") { if (b) b.yourVote = m.want; s.integrity -= 3; st.rel = clamp(st.rel + 0.25, -1, 1); }
    if (c === "ignore" && o.mega && o.party === you.p) { s.rivals = (s.rivals || 0) + 0.5; }
    if (c === "fight") { s.profile = clamp(s.profile + 3, 0, 100); s.baseApproval = clamp(s.baseApproval + (o.party === you.p ? -1 : 2), 5, 99); st.rel = clamp(st.rel - 0.3, -1, 1); if (o.mega && o.party === you.p) s.rivals = (s.rivals || 0) + 1;
      s.toast = { title: `You took on ${o.name}`, text: o.party === you.p ? "Your base is split. Expect money against you in the primary." : "Your base loves it. The clip does well.", tone: "" }; pushNews(s, `${nameOf(you)} hits back at ${o.name}.`, "event"); }
  }
  else if (m.kind === "orgoffer") {
    if (choice === 0 || choice === 1) {
      st.rel = clamp(st.rel + (choice === 0 ? 0.3 : 0.12), -1, 1); st.endorsed = o.kind === "org" || st.endorsed;
      if (o.kind === "org") { s.baseApproval = clamp(s.baseApproval + 2.5, 5, 99); if (Math.abs(o.x) > 0.7) s.approval = clamp(s.approval - (you.vuln > 0.6 ? 1.5 : 0.3), 5, 95); s.toast = { title: `Endorsed by ${o.name}`, text: you.vuln > 0.6 && Math.abs(o.x) > 0.7 ? "Your base is thrilled. Your opponent is already putting it in a mailer." : "Volunteers sign up, and your base notices.", tone: "good" }; }
      else if (o.mega) { addAid(s, you.id, you.p, m.amt); st.given += m.amt; s.toast = { title: `${o.name}'s super PAC is in`, text: `About $${(m.amt / 1000).toFixed(1)}M will be spent in your race. You'll hear about it if you cross them.`, tone: "good" }; }
      else { s.cash += m.amt; addMoney(s, "pac", m.amt); st.given += m.amt; if (o.gid) { s.ties = s.ties || {}; s.ties[o.gid] = (s.ties[o.gid] || 0) + m.amt; } s.tookMoney += m.amt; s.toast = { title: `$${m.amt}K from ${o.name}`, text: choice === 0 ? "They consider you a friend now, and friends take calls." : "You took the check and said you'd vote your conscience. They heard 'yes' anyway.", tone: "good" }; }
      if (choice === 0 && m.bill) { const b = s.bills.find((x) => x.id === m.bill); if (b) { b.yourVote = m.want; s.promises.push({ pid: b.pid, group: o.name, vote: m.want }); } s.integrity -= 3; }
      if (s.pledge && o.kind === "pac") { s.baseApproval = clamp(s.baseApproval - 3, 5, 99); pushNews(s, `${nameOf(you)}, who swore off corporate PAC money, takes a check from ${o.name}.`, "bad"); }
    } else { st.rel = clamp(st.rel - 0.15, -1, 1); s.integrity += 1; }
  }
  if (m.kind === "foreign") {
    if (choice === 0) {
      st.given += m.amt; if (m.amt) { if (m.k === 1) { s.earn = s.earn || {}; s.earn.spouse = (s.earn.spouse || 0) + m.amt; } else { s.cash += m.amt; addMoney(s, "large", m.amt); } }
      s.integrity -= 18; (s.foreignRisk = s.foreignRisk || []).push({ week: s.week, risk: m.risk, k: m.k });
      s.toast = { title: "You took it", text: m.k === 2 ? "The checks start arriving from people you've never met. Each one is a crime." : "Nothing happens. For now.", tone: "bad" };
    } else if (choice === 2) { s.integrity += 6; s.profile = clamp(s.profile + 2, 0, 100); s.toast = { title: "You called the FBI", text: "Agents take a statement. Months later, a quiet thank-you, and a story about the case that makes you look good.", tone: "good" }; }
    else s.integrity += 2;
  }
}
// Foreign money catches up with people.
function foreignWeek(s, r) {
  for (const f of s.foreignRisk || []) {
    if (f.caught || f.cleared) continue;
    if (s.week - f.week > 60) { f.cleared = true; continue; }
    if (r() < f.risk / 30) { f.caught = true; const you = memberById[s.youId];
      s.approval = clamp(s.approval - (f.k === 2 ? 14 : 7), 5, 95); s.integrity -= 15; s.baseApproval = clamp(s.baseApproval - 8, 5, 99);
      pushNews(s, f.k === 2 ? `FBI investigating straw donations to ${nameOf(you)}'s campaign linked to a foreign government.` : `${nameOf(you)} accepted undisclosed benefits from foreign-linked interests, records show.`, "bad");
      pushInbox(s, { kind: "staff", from: "Your lawyer", title: f.k === 2 ? "The FBI is investigating your campaign" : "It's out", body: f.k === 2 ? "Agents have subpoenaed your campaign's donor records. Straw donations with foreign money are felonies. This could end your career, or worse." : "A reporter has the documents. The ethics committee will open an inquiry. Say as little as possible.", done: true });
      if (f.k === 2 && r() < 0.5 && !s.over) { s.over = true; s.result = { kind: "indicted", won: false }; pushNews(s, `${nameOf(you)} is indicted and resigns from Congress.`, "bad"); }
    }
  }
}
// What you can do from the Donors & groups tab.
export function orgAction(s0, id, act) {
  const s = structuredClone(s0), o = orgById[id], st = orgState(s, id), you = memberById[s.youId];
  if (act === "meet") { if (s.hours < 3) return s; s.hours -= 3; st.met++; st.last = s.week; st.rel = clamp(st.rel + 0.12 + orgFit(s, o) * 0.1, -1, 1); s.toast = { title: `Meeting with ${o.name}`, text: orgFit(s, o) > 0.2 ? "It goes well. They'll be in touch." : "Polite, and a little cold. You're not their kind of member.", tone: "" }; }
  if (act === "ask") { if (s.hours < 2 || s.week - (st.asked ?? -99) < 8) return s; s.hours -= 2; st.asked = s.week;
    const ok = st.rel + orgFit(s, o) > 0.45 && (o.party === "any" || o.party === you.p);
    if (!ok) { s.toast = { title: "Not yet", text: "They want to see more from you first: your votes, or more time together.", tone: "" }; st.rel = clamp(st.rel - 0.03, -1, 1); return s; }
    if (o.kind === "org") { st.endorsed = true; s.baseApproval = clamp(s.baseApproval + 2, 5, 99); s.toast = { title: `${o.name} endorses you`, text: "Their members will knock doors for you.", tone: "good" }; }
    else if (o.mega) { const amt = 500; addAid(s, you.id, you.p, amt); st.given += amt; s.toast = { title: `${o.name} is in`, text: "A super PAC will spend about $500K for you. Don't cross them.", tone: "good" }; }
    else { const amt = Math.round(o.budget * 0.8); s.cash += amt; addMoney(s, "pac", amt); st.given += amt; if (o.gid) { s.ties = s.ties || {}; s.ties[o.gid] = (s.ties[o.gid] || 0) + amt; } s.toast = { title: `$${amt}K from ${o.name}`, text: "Easy money. It comes with a phone number that you'll be expected to answer.", tone: "good" }; } }
  if (act === "cut") { if (st.given) { const back = Math.min(s.cash, Math.round(st.given * 0.5)); s.cash -= back; } st.rel = -0.5; st.given = 0; if (o.gid && s.ties) s.ties[o.gid] = 0; s.integrity += 3; s.baseApproval = clamp(s.baseApproval + (o.party === you.p ? -0.5 : 1.5), 5, 99);
    pushNews(s, `${nameOf(you)} cuts ties with ${o.name}.`); s.toast = { title: "Ties cut", text: "You return what you can and say so publicly. They won't forget.", tone: "" }; }
  return s;
}
export const orgRows = (s) => ORGS.map((o) => ({ o, st: (s.orgs || {})[o.id] || { rel: 0, given: 0, met: 0 }, fit: orgFit(s, o) }));

// ════════ Rankings: everyone in Washington, and the people who used to run it ════════
// Former officials and governors: rough game ratings (0-100) from public standing; favorability is approximate.
const FORMER = [
  ["Barack", "Obama", "D", 1961, "M", 4, "Former President", { influence: 92, legis: 70, pop: 58, profile: 99, integrity: 82, cash: 1500 }],
  ["Joe", "Biden", "D", 1942, "M", 0, "Former President", { influence: 40, legis: 90, pop: 38, profile: 78, integrity: 66, cash: 200 }],
  ["George W.", "Bush", "R", 1946, "M", 0, "Former President", { influence: 45, legis: 70, pop: 52, profile: 75, integrity: 68, cash: 300 }],
  ["Bill", "Clinton", "D", 1946, "M", 0, "Former President", { influence: 50, legis: 75, pop: 45, profile: 78, integrity: 40, cash: 400 }],
  ["Kamala", "Harris", "D", 1964, "F", 3, "Former Vice President", { influence: 55, legis: 30, pop: 42, profile: 88, integrity: 66, cash: 900 }],
  ["Mike", "Pence", "R", 1959, "M", 0, "Former Vice President", { influence: 22, legis: 30, pop: 33, profile: 55, integrity: 70, cash: 50 }],
  ["Hillary", "Clinton", "D", 1947, "F", 0, "Former Secretary of State", { influence: 40, legis: 40, pop: 40, profile: 78, integrity: 50, cash: 100 }],
  ["Nancy", "Pelosi", "D", 1940, "F", 0, "Speaker Emerita, retired", { influence: 70, legis: 92, pop: 36, profile: 80, integrity: 50, cash: 400 }],
  ["Mitch", "McConnell", "R", 1942, "M", 0, "Former Senate Leader, retired", { influence: 45, legis: 80, pop: 24, profile: 55, integrity: 45, cash: 200 }],
  ["Mitt", "Romney", "R", 1947, "M", 0, "Former Senator", { influence: 25, legis: 45, pop: 42, profile: 50, integrity: 78, cash: 100 }],
  ["Liz", "Cheney", "R", 1966, "F", 0, "Former Representative", { influence: 20, legis: 25, pop: 38, profile: 55, integrity: 85, cash: 300 }],
  ["Dick", "Durbin", "D", 1944, "M", 0, "Former Senate Whip, retired", { influence: 30, legis: 75, pop: 45, profile: 35, integrity: 72, cash: 50 }],
  ["Gavin", "Newsom", "D", 1967, "M", 0, "Governor of California", { influence: 70, legis: 50, pop: 46, profile: 90, integrity: 55, cash: 1200 }],
  ["Josh", "Shapiro", "D", 1973, "M", 0, "Governor of Pennsylvania", { influence: 55, legis: 45, pop: 57, profile: 70, integrity: 70, cash: 800 }],
  ["JB", "Pritzker", "D", 1965, "M", 0, "Governor of Illinois", { influence: 55, legis: 45, pop: 50, profile: 65, integrity: 60, cash: 3000 }],
  ["Gretchen", "Whitmer", "D", 1971, "F", 0, "Governor of Michigan", { influence: 50, legis: 40, pop: 52, profile: 65, integrity: 68, cash: 500 }],
  ["Ron", "DeSantis", "R", 1978, "M", 0, "Governor of Florida", { influence: 55, legis: 50, pop: 47, profile: 75, integrity: 55, cash: 900 }],
  ["Glenn", "Youngkin", "R", 1966, "M", 0, "Former Governor of Virginia", { influence: 40, legis: 30, pop: 48, profile: 55, integrity: 65, cash: 800 }],
];
export const RANK_GROUPS = [["all", "Everyone"], ["H", "House"], ["S", "Senate"], ["X", "White House and Cabinet"], ["J", "Supreme Court"], ["F", "Former officials and governors"]];
export function allRankings(s) {
  const base = rankings(s), byId = {}; for (const r of base) byId[r.m.id] = r;
  const sponsored = {}; for (const b of s.bills) if (b.stage === "law") sponsored[b.sponsor] = (sponsored[b.sponsor] || 0) + 1;
  // The office you hold or held is most of a career's weight: a presidency outranks any senator's resume.
  const PRESTIGE = (t) => !t ? 0 : /^President$/.test(t) ? 170 : /Former President/.test(t) ? 160 : /Chief Justice/.test(t) ? 100 : /Former Vice President/.test(t) ? 70 : /Vice President/.test(t) ? 160 : /Speaker Emerita/.test(t) ? 60 : /^Speaker/.test(t) ? 125 : /Senate Majority Leader/.test(t) ? 85 : /Senate Minority Leader|Former Senate Leader/.test(t) ? 65 : /House (Majority|Minority) Leader|Republican Leader|Democratic Leader/.test(t) ? 60 : /Associate Justice/.test(t) ? 60 : /Secretary of State/.test(t) ? 50 : /Governor of (California|Florida|Pennsylvania|Illinois|Michigan)/.test(t) ? 40 : /Secretary|Attorney General|Chief of Staff/.test(t) ? 30 : /Governor/.test(t) ? 30 : /Whip/.test(t) ? 35 : /Director|Administrator|Ambassador|Representative/.test(t) ? 15 : /Pro Tempore/.test(t) ? 10 : 0;
  const row = (m, me, x, title) => ({ m, me, ...x, prestige: PRESTIGE(title || m.lead?.[0]), score: Math.round(0.7 * (x.influence * 1.2 + x.legis * 1.5 + (x.pop - 40) * 0.8 + Math.min(40, x.cash / 60) + x.integrity * 0.3 + x.profile * 0.5) + PRESTIGE(title || m.lead?.[0])) });
  const rows = [];
  // Every member of both chambers, scored the same way the chamber ranking does.
  for (const m of MEMBERS) {
    if (byId[m.id]) { const b = byId[m.id], pr = PRESTIGE(m.lead?.[0]) + ((m.comm || []).some((c) => c.role === "Chair") ? 8 : 0); rows.push({ ...b, prestige: pr, score: Math.round(b.score * 0.7 + pr), grp: m.ch }); continue; }
    const me = m.id === s.youId;
    rows.push({ ...row(m, me, { influence: me ? s.clout : m.base.influence + (sponsored[m.id] || 0) * 6, legis: me ? s.legis : (sponsored[m.id] || 0) * 12 + Math.round(m.seniority * 0.4 + (m.chair ? 6 : 0)), pop: me ? s.approval : Math.round(50 + (m.own - 50) * 0.5 + noise(m.id + "pop") * 6), cash: me ? s.cash : m.base.cash, integrity: me ? s.integrity : Math.round(45 + m.t.ethics * 50), profile: me ? s.profile : Math.round(5 + m.seniority * 1.2 + (m.lead?.length ? 50 : 0) + m.t.ego * 20) }), grp: m.ch });
    rows[rows.length - 1].score += (m.comm || []).some((c) => c.role === "Chair") ? 8 : 0;
  }
  // The President, the Vice President and the Cabinet.
  const P = PRES_M, meP = roleOf(s) === "P";
  rows.push({ ...row(P, meP, { influence: 100, legis: Math.round(55 + (s.laws || []).length * 2), pop: Math.round(s.presApproval), cash: 3000, integrity: Math.round(70 - s.presHeat * 50), profile: 100 }, "President"), grp: "X", title: "President" });
  for (const c of s.cab || []) { if (c.vacant) continue; const m = { id: "cab-" + c.id, first: c.first, last: c.last, sf: c.sf, sl: c.sl, p: PP, born: c.born, g: /Susie|Brooke|Linda|Pam|Jeanine|Kari|Tulsi|Kristi|Lori/.test(c.first) ? "F" : "M", look: c.tone !== undefined ? { skin: c.tone } : undefined, seat: c.short };
    rows.push({ ...row(m, false, { influence: Math.round(c.id === "vp" ? 75 : c.id === "cos" ? 70 : 35 + c.loyal * 25), legis: 10, pop: Math.round(c.id === "vp" ? 40 : 35 + (1 - c.heat) * 12), cash: c.id === "vp" ? 500 : 0, integrity: Math.round(80 - c.heat * 60), profile: Math.round(30 + c.heat * 30 + (c.id === "vp" ? 40 : 0)) }, c.post), grp: "X", title: c.post }); }
  // The Court.
  for (const j of onBench(s)) { const m = { id: j.id, first: j.first, last: j.last, sf: j.sf, sl: j.sl, p: j.by, born: j.born, g: j.g, look: j.skin != null ? { skin: j.skin } : undefined, seat: "Supreme Court" };
    const med = Math.abs(j.x - courtMedian(s)) < 0.12; rows.push({ ...row(m, false, { influence: med ? 85 : j.chief ? 80 : 60, legis: 20, pop: 45, cash: 0, integrity: 70, profile: j.chief ? 70 : 45 }, j.chief ? "Chief Justice" : "Associate Justice"), grp: "J", title: j.chief ? "Chief Justice" : "Associate Justice" }); }
  // Former officials and governors: they still move money, voters and members.
  for (const [first, last, p, born, g, skin, title, st] of FORMER) { const [sf, sl] = swapPair(first.split(" ")[0], last); const m = { id: "fmr-" + last + first, first, last, sf: first.includes(" ") ? `${sf} ${first.split(" ").slice(1).join(" ")}` : sf, sl, p, born, g, look: { skin }, seat: title };
    rows.push({ ...row(m, false, st, title), grp: "F", title }); }
  const keys = ["score", "influence", "legis", "pop", "cash", "integrity", "profile"];
  for (const k of keys) [...rows].sort((a, b) => b[k] - a[k]).forEach((x, i) => (x["a_" + k] = i + 1));
  return rows;
}
