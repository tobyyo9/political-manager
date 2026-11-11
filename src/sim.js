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
// Recalibrated after 2026: with the President near 39% approval, Democrats won the House vote by about 13 points.
export const moodTarget = (s) => PSIGN() * ((45 - s.presApproval) * 0.8 + 3);
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
export const upThisTerm = (s, m) => m.ch === "H" || m.cls === cycleClass(s.term) || (!!m.appointee && electionYear(s) === 2028) || m.specialYear === electionYear(s);
export const electionYear = (s) => 2028 + 2 * ((s.term || 1) - 1);
export const nameOf = (m, real) => (real ? `${m.first} ${m.last}` : `${m.sf} ${m.sl}`);
export const titleOf = (m) => (m.ch === "H" ? "Rep." : m.ch === "S" ? "Sen." : m.cabTitle || "President");

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
  hold: { label: "Place a hold", hours: 2, role: "S" }, filibuster: { label: "Lead a talking filibuster", hours: 12, role: "S" }, nuke: { label: "Push to end the filibuster", hours: 6, role: "S" }, dpush: { label: "Lobby Congress for your agenda", hours: 6, role: "C" }, drule: { label: "Issue a rule", hours: 10, role: "C" }, dtravel: { label: "Travel the country", hours: 8, role: "C" }, dmanage: { label: "Run the department", hours: 8, role: "C" }, gbudget: { label: "Pass your budget", hours: 10, role: "G" }, gtour: { label: "Tour the state", hours: 8, role: "G" }, gmanage: { label: "Run the state government", hours: 8, role: "G" }, gsue: { label: "Sue the administration", hours: 6, role: "G" }, gmedicaid: { label: "Expand Medicaid", hours: 12, role: "G" }, probe: { label: "Open an investigation", hours: 10, role: "HS" },
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
    econ: { growth: 1.6, inflation: 3.4, jobs: 4.6 }, presApproval: 39, mood: 10, reconUsed: {}, over: false, result: null, votesCast: [], tookMoney: 0,
    rapport: 0, pres: [], staff: makeStaff(seed), diff: diff || { info: "normal", world: "normal" }, boost: {}, groups: {}, flags: {}, usedEvents: [], moments: [],
    role: you.ch === "S" ? "S" : "H", cab: freshCabinet(), noms: [], presHeat: 0.35, imp: [], term: 1, termStart: 0, edits: {}, pp: "R", career: [],
  };
  mpSeed(s); courtSeed(s); earnSeed(s); govSeed(s);
  startRelations(s, you);
  s.money = { small: Math.round(s.cash * you.fund.small), large: Math.round(s.cash * you.fund.large), pac: Math.round(s.cash * you.fund.pac) }; s.pledge = !!you.fund.pledge; s.ties = {};
  for (const g of you.fund.sectors) if (!["labor", "lowtax"].includes(g) && !s.pledge) s.ties[g] = Math.round(s.cash * you.fund.pac / Math.max(1, you.fund.sectors.length));
  seedBills(s);
  if (you.ch === "S") pushInbox(s, { kind: "staff", from: "Your chief of staff", title: upIn2028(you) ? "You're on the ballot in 2028" : "You're not up until " + (you.cls === 1 ? 2030 : 2032), body: upIn2028(you) ? "Your seat is one of the 34 up in November 2028. Six years usually buys freedom; you don't have it." : "No election this Congress. That buys you room to take hard votes, but leadership, donors and the President still keep score. At the end of 2028 you'll get a verdict on your term." });
  pushInbox(s, { kind: "staff", from: "Your chief of staff", title: "Welcome to the 120th Congress", body: `You have ${HOURS} hours a week. Spend them on colleagues, your district, donors and bills. Votes come to the floor most weeks; I'll flag the ones that matter at home. The election is ${fmtDate(ELECTION_WEEK)}.` });
  govOffer(s, you);
  speakerBallot(s, you);
  lastTermAsk(s, you);
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
      else { const x = mp.riders.splice(mp.riders.findIndex((y) => y.pid === arg.pid), 1)[0]; pushNews(s, `${byId[x.pid].name} comes off ${mp.name.toLowerCase()}.`); s.toast = { title: "Rider stripped", text: `${byId[x.pid].name} is out. ${x.p === (role === "P" ? "R" : you.p) ? "Your own side is annoyed." : "The other side is furious."}`, tone: "good" }; if (isMem(role) && x.p === you.p) s.loyalty -= 1; }
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
  if (["dpush", "drule", "dtravel", "dmanage"].includes(act)) { cabAction(s, act, arg, r); return s; }
  if (["gbudget", "gtour", "gmanage", "gsue", "gmedicaid"].includes(act)) { govAction(s, act, arg, r); return s; }
  if (act === "nuke") {
    if (s.filOff || s.nuke) { s.hours += ACTIONS.nuke.hours; s.toast = { title: "Nothing to push", text: s.filOff ? "The filibuster is already gone." : "The vote is already scheduled.", tone: "" }; return s; }
    if (you.p !== senMaj()) { s.hours += ACTIONS.nuke.hours; s.toast = { title: "Not your call", text: "Only the majority can change the rules. In the minority, the filibuster is your best friend.", tone: "" }; return s; }
    if ((you.lead || []).some((t) => /Majority Leader/.test(t)) && !(s.nukeFailed && s.week - s.nukeFailed < 26)) { scheduleNuke(s, "you"); s.toast = { title: "You're going nuclear", text: "The vote is in two weeks. Count your votes.", tone: "good" }; }
    else { s.filStreak = (s.filStreak || 0) + 1; s.profile = clamp(s.profile + 2, 0, 100); s.baseApproval = clamp(s.baseApproval + 1, 5, 99); pushNews(s, `${nameOf(you)} calls on Senate leaders to end the filibuster.`); s.toast = { title: "You make the case", text: "Floor speech, op-ed, cable hits. Leadership is feeling the pressure.", tone: "good" }; }
    return s;
  }
  if (act === "probe") {
    const c = s.cab.find((x) => x.id === arg.id);
    if (!c || c.vacant || c.id === "vp" || you.p === PP || (s.probes || []).some((p) => p.cab === c.id && p.stage !== "done")) { s.hours += ACTIONS.probe.hours; s.toast = { title: "Can't open that one", text: you.p === PP ? "Investigating your own party's administration is career suicide." : "There's already an investigation, or nobody to investigate.", tone: "" }; return s; }
    openProbe(s, c, s.youId, you.ch); const p = s.probes[s.probes.length - 1];
    s.profile = clamp(s.profile + 2, 0, 100); s.rapport = clamp(s.rapport - 0.1, -1, 1);
    pushNews(s, `${nameOf(you)} opens an investigation into ${c.post} ${cabName(c)}.`, "event");
    s.toast = { title: "Investigation opened", text: p.power ? "Your party runs the chamber, so you can subpoena. First, the document requests." : "You're in the minority: letters, press conferences and a report, but no subpoenas.", tone: "good" };
    return s;
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
  if (m.kind === "lead") { if (m.top && choice === 0) topRace(s); else leaderRace(s, m.top ? choice - 1 : choice, m.comm); }
  if (m.kind === "pchal") answerChal(s, m, choice);
  if (m.kind === "vpick") { const P = s.amb?.pr?.[memberById[s.youId]?.p]; if (P && !P.mate && P.opts?.[choice]) setMate(s, s.amb, memberById[s.youId].p, P.opts[choice]); }
  if (m.kind === "cabstyle" && s.presCareer) answerCab(s, choice);
  if (m.kind === "senapt") answerSenApt(s, m, choice);
  if (m.kind === "govask") answerGov(s, m, choice);
  if (m.kind === "probedefy") answerProbe(s, m, choice);
  if (m.kind === "presask" || m.kind === "testify") answerCabMode(s, m, choice);
  if (m.kind === "gcrisis") answerGovMode(s, m, choice);
  if (m.kind === "lastterm" && choice === 1) { s.lastTerm = true; newsBoth(s, (real) => `${titleOf(you)} ${nameOf(you, real)} announces this will be ${you.g === "F" ? "her" : "his"} last term.`, "event"); s.toast = { title: "Your last term", text: "No campaign this time. Use the time you have; the clock is now visible to everyone.", tone: "" }; }
  if (m.kind === "caboffer" && choice === 0 && !s.cabNom) { s.cabNom = { post: m.post, week: s.week + 4 }; newsBoth(s, (real) => `The President nominates ${titleOf(you)} ${nameOf(you, real)} to be ${s.cab.find((c) => c.id === m.post)?.post}.`, "event"); }
  if (m.kind === "spkrun" && choice === 0 && s.spkRace) s.spkRace.you = true;
  if (m.kind === "spkvote") s.spkVote = { choice };
  if (m.kind === "vacate" && choice === 1) s.loyalty -= 3;
  if (m.kind === "govrun" && choice === 0 && !s.runFor) { s.runFor = "gov"; newsBoth(s, (real) => `${titleOf(you)} ${nameOf(you, real)} announces a run for governor of ${STATE_NAME[you.st] || you.st}.`, "event"); s.toast = { title: "You're running for governor", text: `The race is in November ${electionYear(s)}. Your ${you.ch === "H" ? "House seat goes on the ballot without you" : upNow(s, you) ? "Senate seat goes on the ballot without you" : "Senate seat is safe if you lose"}.`, tone: "good" }; }
  if (m.kind === "presrun" && choice === 0 && s.amb?.pr && !s.runFor) { const A = s.amb, c = cand(youCand(s), 0, 0, you.x); c.you = true; A.pr[you.p].c.push(c); s.youPres = "in"; s.profile = clamp(s.profile + 4, 0, 100); newsBoth(s, (real) => `${titleOf(you)} ${nameOf(you, real)} announces a run for president in ${A.year}.`, "event"); s.toast = { title: "You're running for president", text: "Debates, early states and a delegate count. Your weeks get shorter while you're on the trail.", tone: "good" }; }
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
    if (s.houseFrozen > s.week && b.origin !== "S") { b.floorWeek = s.houseFrozen; continue; }   // no Speaker, no House floor
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
  const inCab = roleOf(s) === "C" || roleOf(s) === "G";
  if (roleOf(s) === "P") presWeek(s, r);
  else if (roleOf(s) === "C") cabWeek(s, r);
  else if (roleOf(s) === "G") govModeWeek(s, r);
  else { others(s, r); whiteHouse(s, r); staffNotes(s, r); }
  (s.trend = s.trend || []).push({ w: s.week, a: Math.round(s.approval), b: Math.round(s.baseApproval), p: Math.round(s.presApproval), m: Math.round(s.mood * 10) / 10 });
  // 5. Your inbox.
  if (isMem(roleOf(s))) inbox(s, r);
  if (!inCab) { sceneWeek(s, R(s, "scene")); donorWeek(s, R(s, "donor")); campaignWeek(s, R(s, "camp")); moneyWeek(s, R(s, "money")); }
  if (isMem(roleOf(s)) || s.week % 2 === 0) petitionWeek(s, R(s, "pet"));
  courtWeek(s, R(s, "court"));
  crisisWeek(s, R(s, "crisis"));
  pardonWeek(s, R(s, "pardon"));
  sotuWeek(s, R(s, "sotu"));
  earnWeek(s, R(s, "earn"));
  if (!inCab) orgWeek(s, R(s, "org"));
  ambitionWeek(s, R(s, "amb"));
  vacancyWeek(s, R(s, "vac"));
  speakerWeek(s, R(s, "spk"));
  govWeek(s, R(s, "gov"));
  rulesWeek(s, R(s, "rules"));
  probeWeek(s, R(s, "probe"));
  if (!inCab) { agingWeek(s, R(s, "age")); cabConfirm(s, R(s, "cabc")); foreignWeek(s, R(s, "foreign")); }
  wireWeek(s, R(s, "wire"));
  { const rr = R(s, "react"); for (const ev of events.slice(0, 2)) voteReactions(s, ev, rr); }
  // 6. Primary and general.
  const rw = s.week - (s.termStart || 0);
  if (roleOf(s) === "P") { if (rw >= ELECTION_WEEK && !s.over) presVerdict(s, r); }
  else if (roleOf(s) === "C") { if (rw >= ELECTION_WEEK && !s.over) cabVerdict(s, r); }
  else if (roleOf(s) === "G") { if (rw >= ELECTION_WEEK && !s.over) govCareerVerdict(s, r); }
  else if (!upThisTerm(s, you) && !s.runFor) { if (rw >= ELECTION_WEEK && !s.over) termReview(s, r); }
  else if (s.lastTerm && !s.runFor) { if (rw >= ELECTION_WEEK && !s.over) { electionNight(s); s.over = true; s.result = { kind: "retired", won: true, age: yourAge(s) }; newsBoth(s, (real) => `${titleOf(you)} ${nameOf(you, real)} retires after ${s.career.length + 1} terms in this game, at ${yourAge(s)}.`, "event"); } }
  else { if (rw === PRIMARY_WEEK && s.runFor !== "pres") primary(s, r); if (rw >= ELECTION_WEEK && !s.over) { if (s.runFor === "pres") presGeneral(s, r); else if (s.runFor === "gov") govGeneral(s, r); else if (s.runFor) runHigher(s, r); else general(s, r); } }
  s.events = events;
  return s;
}

function floor(s, b) {
  const role = roleOf(s), you = memberById[s.youId], p = byId[b.pid], info = billInfo(b.pid, b.party);
  const out = [], first = b.origin === "S" ? "S" : "H", second = first === "H" ? "S" : "H";
  // The majority only schedules what it wants; a minority bill needs real support to reach the floor.
  const ctx = billCtx(s, b);
  const maj1 = first === "H" ? houseMaj() : senMaj();
  if (b.party !== maj1 && !b.discharged) {
    const pool = first === "H" ? HOUSE : SENATE, need = first === "H" ? 218 : 51;
    const support = pool.filter((m) => lean(m, b.pid, ctx).p > 0.5).length;
    if (support < need) { b.dead = true; b.stage = "died"; b.hist.push("Never scheduled: the majority would not bring it up."); pushNews(s, `${p.name} dies in committee. ${maj1 === "D" ? "Democratic" : "Republican"} leaders won't schedule it.`); return out; }
  }
  if (info.reconcilable && b.party === houseMaj() && b.party === senMaj() && !info.mustPass && !s.reconUsed[dateOf(s.week).getUTCFullYear()] && !info.bipartisan) { b.route = "reconciliation"; s.reconUsed[dateOf(s.week).getUTCFullYear()] = b.id; }
  const c2 = billCtx(s, b);
  // Your vote (members only): your choice, or your staff's call if you left it blank.
  const mine = isMem(role) ? lean(you, b.pid, c2) : null;
  const yv = isMem(role) ? b.yourVote ?? mine.L > 0 : null;
  const forced = isMem(role) ? { [s.youId]: yv } : {};
  const needOf = (ch) => (ch === "H" ? (info.amendment ? NEED.H.amendment : NEED.H.passage) : info.amendment ? NEED.S.amendment : b.route === "reconciliation" || b.privileged || s.filOff ? NEED.S.reconciliation : NEED.S.passage);
  const ev = { bill: b.id, pid: b.pid, yourVote: yv, auto: b.yourVote === null, stages: [], first };
  if (isMem(role)) cast(s, b, yv, mine);
  for (const ch of [first, second]) {
    let rc = rollCall(ch, b.pid, c2, forced); const need = needOf(ch);
    // A 50-50 tie on a majority vote: the Vice President breaks it, the way the White House wants.
    if (ch === "S" && need === 51 && rc.yes === 50 && presView(s, b).score >= 0) { rc = { ...rc, yes: 51, vp: true }; const vpC = s.cab?.find((c) => c.id === "vp"); pushNews(s, `Vice President ${vpC ? cabName(vpC) : ""} breaks a 50-50 tie to pass ${p.name} in the Senate.`, "event"); }
    if (ch === "H") { ev.house = rc; ev.needH = need; } else { ev.senate = rc; ev.needS = need; }
    b.hist.push(ch === "H" ? `House: ${rc.yes}-${rc.no}` : `Senate: ${rc.yes}-${rc.no} (${need} needed)`);
    if (rc.yes < need) {
      b.dead = true; b.stage = "failed"; ev.result = ch === "S" && need === 60 ? "filibustered" : ch === "H" ? "failed-house" : "failed-senate";
      if (ev.result === "filibustered" && b.party === senMaj() && rc.yes >= 50) s.filStreak = (s.filStreak || 0) + 1;
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
function enact(s, b) { b.stage = "law"; s.laws.push(b.pid); docketLaw(s, b.pid, rng(hash(`${s.seed}:dock:${b.id}`))); if (!billInfo(b.pid, b.party).bipartisan) stateSuit(s, b.pid, b.party, rng(hash(`${s.seed}:suit:${b.id}`))); if (b.sponsor === s.youId) { s.legis += 12; s.clout += 6; s.profile += 5; } else if (b.cos.includes(s.youId)) s.legis += 2; }
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
  const strength = -Math.max(0, yourAge(s) - 75) * 0.8 + s.baseApproval + fit * 8 + Math.min(10, s.cash / 400) - (you.prisk > 0.5 ? 6 : 0) + gp.net - (s.rivals || 0) * 3 - (memberById[s.youId].p === "D" && memberById[s.youId].prisk > 0.4 ? Math.max(0, moneyMix(s).pac - 0.45) * 20 : 0) + (s.pledge ? 3 : 0);
  s.primaryGroups = gp;
  const c = s.pchal, challenged = !!c || strength < 60 || r() < 0.2;
  // Incumbents almost always win primaries; you only lose if your own party's voters have really turned on you, or a real threat shows up.
  // A famous challenger turns it into a real race: your standing at home matters less than who they are.
  const share = clamp((c?.real ? 52 + (strength - 80) * 0.35 - (c.q - 0.5) * 20 : 60 + (strength - 55) * 0.75 - (c ? c.q * 14 - 3 : 0)) + (s.pchalLock || 0) + (s.pdebate || 0) + (r() - 0.5) * 8, 20, 92);
  const opp = c ? pname(c, false) : `${PF[Math.floor(r() * PF.length)]} ${PL[Math.floor(r() * PL.length)]}`, oppR = c ? pname(c, true) : opp;
  s.primary = { challenged, share: challenged ? Math.round(share * 10) / 10 : 100, won: !challenged || share > 50, opp, oppR };
  if (challenged) { const sh = s.primary.share; newsBoth(s, (real) => `${nameOf(you, real)} ${s.primary.won ? "survives" : "loses"} a primary challenge from ${real ? oppR : opp}, ${sh}% to ${Math.round((100 - sh) * 10) / 10}%.`, s.primary.won ? "good" : "bad"); }
  if (!s.primary.won) { s.over = true; s.result = { kind: "primary", ...s.primary, margin: Math.round((share - 50) * 20) / 10 }; }
  else pushInbox(s, { kind: "staff", from: "Your campaign manager", title: challenged ? `You won the primary with ${s.primary.share}%` : "No primary challenger filed", body: `${challenged ? `${opp} conceded before midnight. ` : ""}Now the general election. Approval at home, the national mood and your war chest decide it.`, ...(challenged && c?.real ? { rbody: `${oppR} conceded before midnight. Now the general election. Approval at home, the national mood and your war chest decide it.` } : {}), done: true });
}
function general(s, r) {
  electionNight(s);
  const you = memberById[s.youId];
  const env = you.p === "D" ? s.mood : -s.mood;                       // national swing toward your party, in points
  const lean2 = (you.own - 50) * 2;                                   // the seat's 2024 margin for your party
  const gg = groupElection(s, "general");
  const margin = projMargin(s) + (s.govRel || 0) * (s.govs?.[you.st]?.p === you.p ? 2 : 1) + (r() - 0.5) * 5; void lean2;
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
    const plain = PRES_M.fictional || PRES_M.realNew, line = v.score > 0.3 ? pick(plain ? ["says it's a good bill and urges Congress to pass it", "endorses it in a written statement"] : P_LOVE) : v.score < -0.2 ? pick(plain ? ["says it goes too far and signals a veto", "calls it the wrong approach"] : P_HATE) : pick(plain ? ["says the White House is still reviewing it", "won't commit either way"] : P_MEH);
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
      body: `The Senate has to confirm whoever you pick, and ${senMaj() === "D" ? "Democrats" : "Republicans"} run it with ${SENATE.filter((m) => m.p === senMaj()).length} seats. A loyalist is satisfying. A confirmable pick actually gets the job.`,
      picks, choices: picks.map(([f, l, cont]) => `${f} ${l} (${cont > 0.55 ? "a brawl to confirm" : cont > 0.35 ? "a fight" : "confirmable"})`) });
  } else if (c.need) s.vacQ = [...(s.vacQ || []), { post: c.id, week: s.week + 2 }];
}
function nominate(s, c, pick) {
  const [first, last, cont, loyal] = pick;
  const n = { id: `n${s.week}${s.noms.length}`, post: c.id, first, last, cont, loyal, vote: s.week + 4, done: false };
  s.noms.push(n);
  pushNews(s, `The President nominates ${first} ${last} for ${c.post}. ${cont > 0.5 ? `${PP === "R" ? "Democrats" : "Republicans"} vow a fight.` : "Senators sound open to it."}`);
  if (roleOf(s) === "S") pushInbox(s, { kind: "confirm", nom: n.id, from: "Your legislative director", title: `Confirmation vote: ${first} ${last} for ${c.short}`, body: `The vote is ${fmtDate(n.vote)}. ${cont > 0.5 ? "A loyalist with a thin record for the job." : "Qualified on paper, close to the President in practice."} How do you vote?`, choices: ["Vote to confirm", "Vote no"] });
}
function confirmVote(s, n) {
  const you = memberById[s.youId]; let yes = 0; const votes = {};
  for (const m of SENATE) {
    const p = m.p === PP ? sig(8 * (0.7 - n.cont * 0.6 - (s.presApproval < 35 ? 0.15 : 0) + (s.rel[m.id] || 0) * (roleOf(s) === "P" ? 0.3 : 0)))
      : sig(8 * (-0.25 + (0.45 - n.cont) * 1.2 + (PSIGN() * m.x + 0.25) * 0.6 + (roleOf(s) === "P" ? (s.rel[m.id] || 0) * 0.3 : 0)));
    const v = m.id === s.youId && n.yourVote !== undefined ? n.yourVote : m.id === s.youId ? you.p === PP : noise(`${s.seed}:cf:${n.id}:${m.id}`) * 0.5 + 0.5 < p;
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
    c.heat = clamp(c.heat + (r() - 0.5) * 0.035 + (r() < 0.02 ? 0.12 : 0) + (0.28 - c.heat) * 0.015, 0, 1);   // stories fade unless something feeds them
    if (before < 0.7 && c.heat >= 0.7) pushNews(s, `${c.post} ${cabName(c)} is under fire over ${HEAT_WHY[Math.floor(r() * HEAT_WHY.length)]}.`, "event");
    if (c.id === "vp" || c.you) continue;     // a Vice President can't be fired, and doesn't quit over a news cycle; your own fate is decided elsewhere
    if (c.heat > 0.88 && r() < 0.06) vacate(s, c, "resigns");
    else if (r() < 0.0004) vacate(s, c, "resigns");   // about one quiet departure a Congress across 23 posts
    else if (role !== "P" && c.heat > 0.8 && c.loyal < 0.8 && r() < 0.03) vacate(s, c, "fired");
  }
  // Open posts get a nominee; the Senate votes a month later.
  // After two failed nominations for the same post, an acting official serves out the Congress.
  const tries = (s.cabTries = s.cabTries || {}), hostile = senMaj() !== PP, trump = !PRES_M.fictional && !PRES_M.realNew;
  for (const v of s.vacQ || []) if (v.week <= s.week && !v.done) { v.done = true; const c = s.cab.find((x) => x.id === v.post); if (!c.vacant) continue;
    const key = `${s.term}:${c.id}`; if ((tries[key] || 0) >= 2) continue;
    let pick;
    if (trump) { const used = new Set(s.noms.map((n) => n.last).concat(s.cab.map((x) => x.last))); const pool = BENCH.filter((b) => !used.has(b[1]));
      // A hostile Senate, or a nominee already rejected, pushes the White House toward someone confirmable.
      pick = pool.sort((a, b) => (hostile || tries[key] ? a[2] - b[2] : b[3] - a[3]) + (r() - 0.5) * 0.3)[0]; }
    else pick = [PF[Math.floor(r() * PF.length)], PL[Math.floor(r() * PL.length)], clamp((hostile ? 0.2 : 0.3) + r() * 0.35, 0, 1), 0.6 + r() * 0.3];
    if (pick) nominate(s, c, pick); }
  for (const n of s.noms) if (!n.done && n.vote <= s.week) {
    n.done = true; const c = s.cab.find((x) => x.id === n.post), v = confirmVote(s, n); n.result = v;
    if (v.ok) { Object.assign(c, { first: n.first, last: n.last, sf: swapPair(n.first, n.last)[0], sl: swapPair(n.first, n.last)[1], vacant: false, tone: undefined, heat: 0.15 + n.cont * 0.4, loyal: n.loyal, note: "Confirmed this Congress.", since: s.week }); pushNews(s, `The Senate confirms ${n.first} ${n.last} as ${c.post}, ${v.yes}-${v.no}.`, "good"); if (role === "P") { s.clout += 3; s.legacy = (s.legacy || 0) + 1; } }
    else { const key = `${s.term}:${c.id}`; tries[key] = (tries[key] || 0) + 1;
      pushNews(s, `The Senate rejects ${n.first} ${n.last} for ${c.post}, ${v.yes}-${v.no}.${tries[key] >= 2 && role !== "P" ? ` An acting ${c.short} chief will serve for the rest of this Congress.` : ""}`, "bad");
      if (role === "P") { s.presApproval -= 0.8; s.clout -= 4; vacate(s, c, "still"); c.vacant = true; } else if (tries[key] < 2) s.vacQ.push({ post: c.id, week: s.week + 3 }); }
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
  if (isMem(role)) {
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
    econ: { growth: 1.6, inflation: 3.4, jobs: 4.6 }, presApproval: 39, mood: 10, reconUsed: {}, over: false, result: null, votesCast: [], tookMoney: 0,
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
    const odds = clamp(0.3 + (m.p === PP ? 0.25 : -0.12) + (m.t.label === "follower" ? 0.2 : m.t.label === "vain" ? 0.1 : 0) + (s.presApproval - 40) / 80 + (s.rel[m.id] || 0) * 0.4 - (m.p === PP ? 0 : 0.2 * (1 - m.vuln)), 0.05, 0.9);
    b.asked[m.id] = true; s.know[m.id] = Math.max(1, s.know[m.id] || 0);
    if (r() < odds) { b.deals[m.id] = (b.deals[m.id] || 0) + (want ? 1 : -1) * (m.p === PP ? 0.45 : 0.3); s.rel[m.id] = clamp((s.rel[m.id] || 0) + 0.08, -1, 1); s.toast = { title: `${nameOf(m)} is with you`, text: `"Whatever you need, Mr. President." They were ${l.p > 0.5 ? "leaning yes" : "leaning no"}; they've moved your way.`, tone: "good" }; }
    else { s.rel[m.id] = clamp((s.rel[m.id] || 0) - 0.04, -1, 1); s.toast = { title: "Polite, but no", text: `${nameOf(m)} thanks you for the call and says they have to do what's right for ${m.seat}.`, tone: "" }; }
  }
  if (act === "push") { const info = billInfo(b.pid, b.party); b.wh = (b.wh || 0) + 0.3; s.presApproval = clamp(s.presApproval + info.pop * 1.4, 20, 70); presPost(s, `The President pushes ${byId[b.pid].name} in a prime-time address.`, b.pid); s.toast = { title: "Prime time", text: `Your party hears you. ${info.pop > 0 ? "The public likes the idea." : "It's not popular, and the polls notice."}`, tone: info.pop > 0 ? "good" : "" }; }
  if (act === "threat") { b.wh = (b.wh || 0) - 0.5; b.threat = true; presPost(s, `VETO THREAT: the President says ${byId[b.pid].name} "will never become law."`, b.pid); s.toast = { title: "Veto threat issued", text: `${pName(PP)} now have cover to vote no, and to sustain a veto.`, tone: "" }; }
  if (act === "eo") {
    if ((s.eos || []).some((e) => e.pid === arg.pid) || s.laws.includes(arg.pid)) { s.hours += ACTIONS.eo.hours; return; }
    const info = billInfo(arg.pid, PP); s.boost[arg.pid] = (s.boost[arg.pid] || 0) + 0.06; s.presApproval = clamp(s.presApproval + info.pop * 1.2, 20, 70); s.presHeat = clamp(s.presHeat + 0.01, 0, 1);
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
  if (signs) { s.signed++; s.presApproval = clamp(s.presApproval + info.pop * 1.5 + (b.party !== PP ? 0.3 : 0), 20, 70); s.baseApproval = clamp(s.baseApproval - (b.party !== PP && info.dir * PSIGN() < 0 ? 3 : 0), 5, 99); s.legacy += b.party === PP ? 2 : 1; }
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
  if (r() < 0.5) { const pool = MEMBERS.filter((m) => m.ch && (m.p === PP || m.vuln > 0.8)); const m = pool[Math.floor(r() * pool.length)];
    pushInbox(s, { kind: "pask", who: m.id, from: `${titleOf(m)} ${nameOf(m)} (${m.p}-${m.seat})`, title: `${nameOf(m)} ${ASKS[Math.floor(r() * ASKS.length)]}`, body: m.p === PP ? "It costs you a little. They'll remember it on the next close vote." : "A Democrat from a seat you won. Helping them is odd, but a friend across the aisle is worth a lot on an override.", choices: ["Do it", "Say no"] }); }
  // Your chief of staff on the next floor vote.
  const nx = s.bills.filter((b) => !b.dead && b.stage === "committee").sort((a, b) => a.floorWeek - b.floorWeek)[0];
  if (nx && nx.floorWeek === s.week + 1) { const v = presView(s, nx), w = whipCount(s, nx, nx.origin || "H");
    pushInbox(s, { kind: "staff", from: "Legislative affairs", title: `Next week: ${byId[nx.pid].name}`, body: `${v.signs ? "You lean toward signing it." : "Your instinct is a veto."} Our count in the ${nx.origin === "S" ? "Senate" : "House"}: about ${w.yes} yes, ${w.no} no. ${!v.signs ? `To make a veto stick, keep ${pName(PP)} below ${nx.origin === "S" ? "67" : "290"} on an override.` : ""}`, done: true }); }
  if (s.week % 4 === 0) pushInbox(s, { kind: "staff", from: "Your pollster", title: `You're at ${Math.round(s.presApproval)}%`, body: `${pName(PP)}: ${Math.round(s.baseApproval)}% approve. ${s.presApproval < 38 ? "Below 38 your party starts running away from you." : s.presApproval > 45 ? "Members want you in their districts again." : "Stable, not strong."}`, done: true });
}
function presVerdict(s, r) {
  if (s.presCareer) return presCareerVerdict(s, r);
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
  for (const m of ms) { const v = m.id === s.youId && isMem(roleOf(s)) ? (mp.yourVote ?? mpLean(s, m, mp) > 0) : rng(hash(`${s.seed}:mp:${mp.id}:${s.week}:${m.id}:${over}`))() < sig(14 * mpLean(s, m, mp, over)); votes[m.id] = v; if (v) yes++; }
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
      if (isMem(role)) pushInbox(s, { kind: "staff", from: "Your legislative director", title: `${mp.name} due ${fmtDate(mp.deadline)}`, body: mp.kind === "funding" ? "Miss it and the government shuts down. Riders are the fight: each side tries to attach policy the other has to swallow. You can add or strip riders from the Bills tab." : "Miss the X-date and the Treasury can't pay every bill. Republicans want spending cuts attached; Democrats want it clean.", done: true });
      if (role === "P") pushInbox(s, { kind: "staff", from: "OMB", title: `${mp.name} due ${fmtDate(mp.deadline)}`, body: `Democrats attached ${mp.riders.map((x) => byId[x.pid].name).join(", ") || "nothing yet"}. You can demand riders of your own or demand theirs come off. If it reaches you with a rider you can't accept, you can veto, and own the shutdown.`, done: true });
      continue;
    }
    if (mp.stage === "desk") { const m = s.inbox.find((x) => x.kind === "mpdesk" && x.mp === mp.id && !x.done); if (m && m.week < s.week) { m.done = true; m.choice = mpPresSigns(s, mp) ? 0 : 1; if (m.choice === 0) mpSettle(s, mp, true); else { mp.blame = "pres"; s.vetoes++; mpSettle(s, mp, false); } } continue; }
    if (mp.stage !== "open" && mp.stage !== "lapsed") continue;
    // The President demands a rider of his own (when you aren't him).
    if (isMem(role) && !mp.presAsked && mp.riders.length && r() < 0.35) { mp.presAsked = true; const pid = R_RIDERS[mp.kind].find((p) => !mp.riders.some((x) => x.pid === p)); if (pid) { presPost(s, `The President says he won't sign ${mp.name.toLowerCase()} without ${byId[pid].name}.`, pid); mp.demand = pid; } }
    // Leaders trade riders away when the Senate count is short.
    const sc = mpCount(s, mp, "S");
    if (sc.yes < 60 && !mp.lock) { const d = mp.riders.findIndex((x) => x.p === "D"); if (d >= 0 && r() < 0.4) { const x = mp.riders.splice(d, 1)[0]; pushNews(s, `To win Republican votes, Democratic leaders drop ${byId[x.pid].name} from ${mp.name.toLowerCase()}.`); }
      else if (d < 0 && mp.kind === "debt" && r() < 0.3) { const pid = R_RIDERS.debt.find((p) => !mp.riders.some((x) => x.pid === p)); if (pid) { mp.riders.push({ pid, p: "R", by: "Senate deal" }); pushNews(s, `Senate deal: ${mp.name.toLowerCase()} now carries ${byId[pid].name}.`); } } }
    if (mp.lock && s.week >= mp.lock) mp.lock = null;
    if (s.week < mp.deadline - 1 && mp.stage === "open") continue;
    // The vote.
    const h = mpVote(s, mp, "H"), sn = mpVote(s, mp, "S");
    mp.hist.push(`${fmtDate(s.week)}: House ${h.yes}-${h.no}, Senate ${sn.yes}-${sn.no}`);
    if (isMem(role) && isMem(roleOf(s))) { const mine = (role === "S" ? sn : h).votes[s.youId]; (s.mpVotes = s.mpVotes || []).push({ week: s.week, mp: mp.id, vote: mine }); if (!mine && you.vuln > 0.6) s.approval = clamp(s.approval - 1, 5, 95); }
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
  if (ok && s.spk) s.spk.anger = (s.spk.anger || 0) + 0.6;   // the hardliners hate the deal
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
function rebuildChambers() { HOUSE.length = 0; SENATE.length = 0; for (const m of MEMBERS) if (!m.vacant) (m.ch === "H" ? HOUSE : SENATE).push(m); }   // an empty seat casts no votes
export function resetWorld() {
  MEMBERS.forEach((m, i) => { for (const k of Object.keys(m)) delete m[k]; Object.assign(m, JSON.parse(JSON.stringify(ORIG[i]))); });
  PP = "R"; YEAR = 2027; applyPres(null); rebuildChambers(); clearCaches();
}
// Re-apply a saved career's changes to the world (after a reload).
function applyPres(s) {
  const P = s?.presRec; if (!P) { Object.assign(PRES_M, { first: PRESIDENT.first, last: PRESIDENT.last, sf: PRESIDENT.sf, sl: PRESIDENT.sl, p: "R", born: PRESIDENT.born, look: PRESIDENT.look, g: "M", fictional: false, realNew: false }); return; }
  if (P.you) { Object.assign(PRES_M, { first: P.first, last: P.last, sf: P.sf || P.first, sl: P.sl || P.last, p: P.p, born: P.born, g: P.g, look: P.look || { skin: 0 }, fictional: !!P.fictional, realNew: true }); return; }
  if (P.real) { Object.assign(PRES_M, { first: P.first, last: P.last, sf: P.sf || P.first, sl: P.sl || P.last, p: P.p, born: P.born, g: P.g, look: P.look || { skin: 0 }, fictional: false, realNew: true }); return; }
  Object.assign(PRES_M, { first: P.first, last: P.last, sf: P.first, sl: P.last, p: P.p, born: P.born, g: P.g, look: { skin: (P.first.length * 7 + P.last.length * 3) % 6 }, fictional: true, realNew: false });
}
export function restore(s) {
  applyPres(s); applyCab(s); applyGov(s);
  if (!s?.edits || !Object.keys(s.edits).length) return;
  resetWorld(); PP = s.pp || "R"; YEAR = 2027 + 2 * ((s.term || 1) - 1);
  for (const [id, rec] of Object.entries(s.edits)) { const m = memberById[id]; if (!m) continue; for (const k of Object.keys(m)) delete m[k]; Object.assign(m, JSON.parse(JSON.stringify(rec))); }
  rebuildChambers(); regroup(); clearCaches();
  applyPres(s); applyCab(s); applyGov(s);   // resetWorld put the original President back; restore this career's
}
const keep = (s, m) => { s.edits[m.id] = JSON.parse(JSON.stringify(m)); };
const TRAITS_JS = ["dealmaker", "believer", "grudge", "vain", "loyalist", "follower", "wonk", "showhorse"];
// A fictional newcomer who wins a seat in a future election.
function newcomer(s, m, party, year, preset = null) {
  const r = rng(hash(`${s.seed}:new:${m.id}:${year}`)), used = new Set(MEMBERS.map((x) => x.last));
  let first = PF[Math.floor(r() * PF.length)]; let last = PL[Math.floor(r() * PL.length)]; for (let i = 0; used.has(last) && i < 20; i++) last = PL[Math.floor(r() * PL.length)];
  const lean = party === "D" ? m.dem : 100 - m.dem; let x = party === "D" ? -(0.18 + clamp((lean - 50) / 60, 0, 0.4) + r() * 0.12) : 0.3 + clamp((lean - 50) / 60, 0, 0.35) + r() * 0.12;
  if (preset) { first = preset.first; last = preset.last; x = preset.x ?? x; }
  const t = { ambition: 0.2 + r() * 0.7, loyalty: 0.2 + r() * 0.7, ego: 0.2 + r() * 0.7, ethics: 0.2 + r() * 0.7, deal: 0.2 + r() * 0.7 }; t.label = TRAITS_JS[Math.floor(r() * TRAITS_JS.length)];
  const comm = (m.comm || []).map((c) => ({ ...c, role: "", title: "" }));
  const keepKeys = { ch: m.ch, st: m.st, d: m.d, dem: m.dem, id: m.id, cls: m.cls };
  for (const k of Object.keys(m)) delete m[k];
  Object.assign(m, keepKeys, { first, last, sf: first, sl: last, p: party, x: Math.round(x * 1000) / 1000, y: 0, born: 1975 + Math.floor(r() * 18), since: year + 1, comm, lead: [], t, g: preset?.g || (r() < 0.45 ? "F" : "M"), fictional: true, est: true, new: true });
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
  const A = s.amb && s.amb.year === year ? s.amb : null; out.prim = 0;
  // Senate seats first, so a House member who wins one is moved before their old seat is refilled.
  for (const m of [...MEMBERS].sort((a, b) => (a.ch === "S" ? 0 : 1) - (b.ch === "S" ? 0 : 1))) {
    if (m.id === s.youId || !upNow(s, m)) continue;
    const o = (A ? A.out[m.id] : retiresGeneric(s, m) ? { why: "retire" } : null) || (m.vacant ? { why: "retire" } : null);
    const margin = seatMargin(s, m), winner = margin > 0 ? "D" : "R", named = m.ch === "S" ? A?.sen?.[m.st]?.[winner] : null;
    if (winner !== m.p) { out.flips[m.ch]++; if (named) install(s, m, named, year); else { newcomer(s, m, winner, year); backersWin(s, m, year); } }
    else if (o) { if (o.why === "primary") out.prim++; else out.retire++; if (named) install(s, m, named, year); else newcomer(s, m, m.p, year, o.why === "primary" ? o.by : null); }
  }
  // Governors on the same ballot (yours was decided already if you ran).
  out.gov = s.govDone ? (s.lastGov?.races || []) : govElections(s, year, null); s.govDone = false;
  // The White House, every four years.
  let presMsg = "";
  if (s.term % 2 === 1) {
    const map = s.lastPres && s.lastPres.year === year ? s.lastPres : presMap(s, true); s.lastPres = map;
    const winner = map.winner, nom = A?.pr?.[winner]?.nom, loser = A?.pr?.[winner === "D" ? "R" : "D"]?.nom;
    const ev = `${Math.max(map.ev.D, map.ev.R)} electoral votes to ${Math.min(map.ev.D, map.ev.R)}`;
    const msgFor = (real) => nom?.you ? `${nameOf(s.presCareer?.from || memberById[s.youId], real)} (${winner}) wins the White House, ${ev}.` : nom && !nom.you ? `${pname(nom, real)} (${winner}) wins the White House, ${ev}${loser && !loser.you ? `, over ${pname(loser, real)}` : ""}.` : `${winner === "D" ? "A Democrat" : "A Republican"} wins the White House, ${ev}${winner === PP ? ", keeping it for the President's party" : ""}.`;
    presMsg = msgFor(false); out.presMsgR = msgFor(true);
    if (nom?.ref === "potus") { s.presApproval = 50; s.presHeat = 0.2; s.pp = PP; s.mood = s.mood * 0.3 + (PP === "R" ? 2 : -2); YEAR += 2; for (const m of MEMBERS) derive(m); rebuildChambers(); regroup();
      const after0 = { H: HOUSE.filter((m) => m.p === "D").length >= 218 ? "D" : "R", S: SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R" };
      for (const ch of ["H", "S"]) if (after0[ch] !== before[ch]) flipTitles(ch, after0[ch]);
      for (const m of MEMBERS) if (m.ch && (m.lead?.length || (m.comm || []).some((c) => c.role))) keep(s, m); clearCaches();
      return { ...out, presMsg: `${presMsg} A second term.`, presMsgR: `${out.presMsgR} A second term.`, house: HOUSE.filter((m) => m.p === "D").length, senate: SENATE.filter((m) => m.p === "D").length, after: after0 }; }
    // The outgoing administration's real people join the former officials.
    s.formers = s.formers || [];
    if (!PRES_M.fictional) s.formers.push({ first: PRES_M.first, last: PRES_M.last, sf: PRES_M.sf, sl: PRES_M.sl, p: PRES_M.p, born: PRES_M.born, g: PRES_M.g, look: PRES_M.look, title: "Former President" });
    for (const c of s.cab || []) { const o = CABINET.find((x) => x.id === c.id); if (o && !c.vacant && c.last === o.last && !(nom && nom.last === c.last)) s.formers.push({ first: c.first, last: c.last, sf: c.sf, sl: c.sl, p: "R", born: c.born, g: c.id === "vp" ? "M" : undefined, title: `Former ${c.post}`, cab: c.id }); }
    if (winner !== PP) { PP = winner; s.presApproval = 52; } else s.presApproval = 48;
    s.presHeat = 0.2; s.rapport = 0; s.pres = [];
    // A new (fictional) President and cabinet: the real one is term-limited.
    const pick = (k) => [PF[Math.floor(rng(hash(`${s.seed}:pn:${year}:${k}`))() * PF.length)], PL[Math.floor(rng(hash(`${s.seed}:pl:${year}:${k}`))() * PL.length)]];
    const [pf, pl] = pick("pres");
    if (nom?.you) { const y = s.presCareer?.from || memberById[s.youId]; s.presRec = { first: y.first, last: y.last, sf: y.sf, sl: y.sl, p: PP, born: y.born, g: y.g, look: y.look, since: year + 1, you: true, fictional: !!(y.fictional || y.custom) }; }
    else if (nom && !nom.you) { s.presRec = { first: nom.first, last: nom.last, sf: nom.sf, sl: nom.sl, p: PP, born: nom.born, g: nom.g || "M", look: nom.look, since: year + 1, real: true };
      const seat = nom.id && memberById[nom.id]; if (seat && seat.last === nom.last) newcomer(s, seat, seat.p, year); }
    else s.presRec = { first: pf, last: pl, p: PP, born: 1960 + Math.floor(r() * 18), g: r() < 0.4 ? "F" : "M", since: year + 1 };
    applyPres(s);
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
export const canContinue = (s) => s.over && s.result && s.result.won && (roleOf(s) === "G" ? s.result.kind === "govterm" : roleOf(s) === "C" ? s.result.kind === "cabterm" : s.result.kind === "gov" ? true : roleOf(s) === "P" ? !!s.presCareer && (s.result.kind === "midterm" || (s.result.kind === "pres" && s.result.reelect)) : (s.result.kind === "general" || s.result.kind === "term" || s.result.kind === "higher"));
export function nextCongress(s0) {
  const s = structuredClone(s0);
  if (!canContinue(s)) return s;
  if (roleOf(s) === "P") return presNextCongress(s);
  if (roleOf(s) === "C") return cabNextCongress(s);
  if (roleOf(s) === "G") return govNextCongress(s);
  if (s.result.kind === "gov" && s.result.won) { enterGovernor(s); return s; }
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
  govNews(s, w.gov);
  { const tail = ` Democrats hold ${w.house} House seats and ${w.senate} Senate seats. ${w.flips.H + w.flips.S} seats changed parties, ${w.retire} members retired and ${w.prim || 0} lost primaries.`; pushNews(s, `The ${ord(congress)} Congress convenes. ${w.presMsg}${tail}`, "event"); if (w.presMsgR) s.news[0].rt = `The ${ord(congress)} Congress convenes. ${w.presMsgR}${tail}`; }
  if (false) pushNews(s, `The ${ord(congress)} Congress convenes. ${w.presMsg} Democrats hold ${w.house} House seats and ${w.senate} Senate seats. ${w.flips.H + w.flips.S} seats changed parties and ${w.retire} members retired.`, "event");
  pushInbox(s, { kind: "staff", from: `${s.staff[0].name}, chief of staff`, title: `Welcome to the ${ord(congress)} Congress`, done: true,
    body: `${w.presMsg} ${hMaj === "D" ? "Democrats" : "Republicans"} run the House and ${sMaj === "D" ? "Democrats" : "Republicans"} run the Senate. You're ${you.p === (you.ch === "H" ? hMaj : sMaj) ? "in the majority" : "in the minority"}. You have more seniority and more clout than two years ago. New members won this year are fictional; everyone else is who was there.` });
  // Leadership races and committee posts.
  const myComm = (you.comm || []).find((c) => c.c[0] === you.ch);
  pushInbox(s, { kind: "lead", from: "Your chief of staff", title: "Leadership elections are this week", comm: myComm?.c || null,
    body: `Your caucus votes on its leaders, and the Steering Committee picks committee posts. You can run for whip, go for the top spot${myComm ? ` on ${myComm.n}` : ""}, or sit it out. Losing a race costs you something with whoever won.`,
    top: true, choices: [you.ch === "H" ? (hMaj === you.p ? "Run for Speaker" : "Run for party leader") : `Run for ${sMaj === you.p ? "Majority" : "Minority"} Leader`, "Run for party whip", myComm ? `Seek the top spot on ${myComm.n}` : "Ask for a better committee", "Sit it out"] });
  govOffer(s, you); speakerBallot(s, you); cabOffer(s, you); lastTermAsk(s, you);
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
// You, as your party's nominee for president.
function presGeneral(s, r) {
  electionNight(s);
  const you = memberById[s.youId], map = s.lastPres, won = map.winner === you.p, other = s.amb?.pr?.[you.p === "D" ? "R" : "D"]?.nom;
  const ev = map.ev[you.p], evO = 538 - ev, opp = other ? pname(other, false) : "the other party's nominee", oppR = other ? pname(other, true) : opp;
  newsBoth(s, (real) => `Election night: ${nameOf(you, real)} ${won ? "wins" : "loses"} the presidency, ${ev} electoral votes to ${evO}, ${won ? "over" : "to"} ${real ? oppR : opp}.`, won ? "good" : "bad");
  if (won || upNow(s, you)) { s.over = true; s.result = { kind: "pres", won, ev, evO, opp, oppR, margin: Math.round(((ev - evO) / 5.38) * 10) / 10 }; return; }
  termReview(s, r); s.result.presLost = { ev, evO, opp, oppR }; s.runFor = null;
}
// A House member running statewide for the Senate.
function runHigher(s, r) {
  electionNight(s);
  const you = memberById[s.youId], seat = memberById[s.runFor];
  const env = you.p === "D" ? s.mood : -s.mood, lean = (you.p === "D" ? 1 : -1) * (LEAN[seat.st] ?? (seat.dem - 50) * 2) / 2;
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
// The 2026 midterms rewrote the map. Statewide results, Democrat minus Republican in points (an independent running as the
// Republican's main opponent counts on the Democratic side), from AP counts as of November 8-10, 2026. Democrats won the
// national House vote by about 13 points.
const SEN26 = { AL: -9.4, AK: 0.7, AR: -11.9, CO: 25.4, DE: 27.2, FL: -2.9, GA: 18.0, ID: -23.0, IL: 24.3, IA: 4.1, KS: 5.0, KY: -12.1, LA: -1.8, ME: 6.3, MA: 31.3, MI: 7.0, MN: 10.1, MS: 0.3,
  MT: -10.6, NE: -6.2, NH: 13.7, NJ: 27.2, NM: 26.6, NC: 19.6, OH: 4.8, OK: -17.9, OR: 19.4, RI: 37.5, SC: 4.5, SD: -21.0, TN: -12.2, TX: 12.1, VA: 22.7, WV: -20.4, WY: -30.4 };
const GOV26 = { AL: -4.0, AZ: 13.1, AR: -15.3, CA: 31.2, CO: 27.8, CT: 19.2, FL: -1.3, GA: 8.6, HI: 45.2, ID: -24.8, IL: 23.5, IA: 11.0, KS: 0.7, ME: 17.1, MD: 32.2, MA: 27.3, MI: 10.9, MN: 12.9,
  NE: -8.0, NV: 7.6, NH: -4.3, NM: 14.8, NY: 19.6, OH: 7.9, OK: -6.0, OR: 9.6, PA: 22.1, SC: -4.5, SD: -27.0, TN: -2.5, TX: 7.1, VT: -6.6, WI: 8.0 };
// Each state's lean against the nation: mostly what it did in 2026, partly what it did for President in 2024. Governor's races
// carry big candidate effects (a popular incumbent can win anywhere), so a state with only a governor's race leans on 2024 more.
// States with no statewide race in 2026 move by the typical shift. LEAN is relative: add the national environment to get a margin.
export const REL24 = {}, LEAN = {};
// The 2026 national environment is set so a typical state kept its lean: the median state moved by the national swing,
// and the states that moved more than that (Texas, North Carolina, Georgia) now lean further toward Democrats than before.
// (The national House vote, about D+13, runs ahead of statewide races because of uncontested seats.)
export let NAT_2026 = 0;
{ const raw = {}; for (const st of Object.keys(STATE_DEM)) { REL24[st] = (STATE_DEM[st] - 50) * 2 - NAT_2024; const sn = SEN26[st], gv = GOV26[st];
    if (sn != null || gv != null) raw[st] = { m: sn != null && gv != null ? sn * 0.6 + gv * 0.4 : sn ?? gv, w: sn != null ? 0.8 : 0.45 }; }
  const sw = Object.entries(raw).filter(([, x]) => x.w === 0.8).map(([st, x]) => x.m - REL24[st]).sort((a, b) => a - b); NAT_2026 = sw[Math.floor(sw.length / 2)];
  const rel26 = {}; for (const [st, x] of Object.entries(raw)) rel26[st] = { m: x.m - NAT_2026, w: x.w };
  const typical = 0;
  for (const st of Object.keys(STATE_DEM)) { const x = rel26[st]; LEAN[st] = Math.round((x ? x.w * x.m + (1 - x.w) * REL24[st] : REL24[st] + 0.6 * typical) * 10) / 10; } }
// House districts after 2026: each district's 2024 lean, moved as far as its state moved, then checked against who actually won
// it in 2026 (Democrats won the national House vote by about 13). A district whose winner would have lost on those numbers is
// nudged until that winner wins, allowing incumbents a personal vote of about 6 points. Relative to the nation, like LEAN.
const NAT_H26 = 13;
export const DIST26 = {};
for (const m of ORIG) if (m.ch === "H") { const seat = `${m.st}-${m.d || "AL"}`, sg = m.p === "D" ? 1 : -1, inc = (m.since || 2027) < 2027 ? 6 : 0;
  // The state's shift is capped at 6 points either way: statewide races carry candidate effects (Collins in Maine) that districts don't share.
  let rel = (m.dem - 50) * 2 - NAT_2024 + clamp((LEAN[m.st] ?? REL24[m.st] ?? 0) - (REL24[m.st] ?? 0), -6, 6);
  const marg = rel + NAT_H26 + sg * inc; if (sg * marg < 0.5) rel += sg * (0.5 - sg * marg);
  DIST26[seat] = Math.round(rel * 10) / 10; }
export const houseLean = (m) => DIST26[m.seat] ?? (m.dem - 50) * 2 + 0.5 * ((LEAN[m.st] ?? 0) - (REL24[m.st] ?? 0));
const phi = (z) => 1 / (1 + Math.exp(-1.7 * z));
// The national presidential margin for Democrats: the generic ballot plus the economy, which helps or hurts the party in power.
export function nationalPres(s) { return s.mood * 0.85 - PSIGN() * ((s.econ.growth - 1.6) * 1.2 - (s.econ.inflation - 3) * 1.0); }
// final: draw the actual result with state-level error; otherwise a forecast with win probabilities.
export function presMap(s, final = false, year = electionYear(s)) {
  const nat = nationalPres(s) + nomEdge(s), states = {}; const ev = { D: 0, R: 0 };
  for (const st of Object.keys(EV)) {
    const base = LEAN[st] + nat + homeBump(s, st);
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
  for (const m of SENATE.filter((x) => upNow(s, x))) {
    const n = noise(`${s.seed}:el${s.term}:${m.id}`) * 6, mm = final ? seatMargin(s, m) : seatMargin(s, m) - n, k = s.amb?.year === electionYear(s) ? s.amb.sen?.[m.st] : null;
    states[m.st] = { m: Math.round(mm * 10) / 10, pD: final ? (mm > 0 ? 1 : 0) : phi(mm / 6), w: mm > 0 ? "D" : "R", holder: m.p, who: m.id, open: isOpen(s, m), noms: k ? { D: k.D ? { sf: k.D.sf, sl: k.D.sl, first: k.D.first, last: k.D.last } : null, R: k.R ? { sf: k.R.sf, sl: k.R.sl, first: k.R.first, last: k.R.last } : null } : null };
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
  const COOL = { tv: 7, hearing: 9, leader: 6, briefing: 4, oval: 5, debate: 0, sotu: 0, confirm: 0, pdebate: 0 }; s.sceneAt = s.sceneAt || {};
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
  if (s.runFor === "pres" && rw === ELECTION_WEEK - 5) { const o = s.amb?.pr?.[you.p === "D" ? "R" : "D"]?.nom; if (o) pushScene(s, "debate", { opp: pname(o, false), oppR: pname(o, true), oppG: o.g, oppId: "pr" + o.last, ch: "P" }, `Presidential debate against ${pname(o, false)}`, "Your campaign chair"); }
  else if (upThisTerm(s, you) && rw === ELECTION_WEEK - 5) { const opp = s.opp && !s.runFor ? `${s.opp.first} ${s.opp.last}` : `${PF[Math.floor(r() * PF.length)]} ${PL[Math.floor(r() * PL.length)]}`; pushScene(s, "debate", { opp, ch: s.runFor ? "S" : you.ch, ...(s.opp && !s.runFor ? { oppG: s.opp.g, oppId: `opp${s.seed}${s.opp.first}${s.opp.last}`, oppR: s.opp.rname || null } : {}) }, `Debate night against ${opp}`, "Your campaign manager"); }
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
  if (sc.type === "pdebate") { if (sc.pres) { const c = s.amb?.pr?.[you.p]?.c.find((x) => x.you); if (c) c.mom += k * 1.1; } else s.pdebate = k * 5; }
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
function houseCount(s) { let d = 0; for (const m of HOUSE) { if (m.id === s.youId) { d += m.p === "D" ? 1 : 0; continue; } if (seatMargin(s, m) > 0) d++; } return d; }
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
export const yourRace = (s) => isMem(roleOf(s)) && !s.runFor && upThisTerm(s, memberById[s.youId]);
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
  const sgn = you.p === "D" ? 1 : -1, shift = sgn * (you.ch === "S" ? (LEAN[you.st] ?? (you.dem - 50) * 2) - (you.dem - 50) * 2 : houseLean(you) - (you.dem - 50) * 2);   // where your seat stands after 2026
  // In a wave against your party, incumbency and a good local brand count for less: 2026 swept out members who were popular at home.
  const against = Math.max(0, -env - 4), incB = Math.max(0, 3 - against * 0.5), apprCap = Math.max(1.5, 5 - against * 0.5);
  return (you.own - 50) * 2 + shift - Math.max(0, yourAge(s) - 78) * 0.4 + env + incB + clamp((s.approval - 50) * 0.25, -8, apprCap) + Math.min(2, s.cash / 1200) + gg.net * 0.5 + (s.debateBonus || 0) - (s.oppMoney || 0) * 1.2
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
  { const N = you.ch === "S" && s.amb?.year === electionYear(s) ? s.amb.sen?.[you.st]?.[s.opp.p] : null; if (N) { bio = N.why || bio; Object.assign(s.opp, { first: N.sf, last: N.sl, rname: `${N.first} ${N.last}`, g: N.g, q: Math.max(s.opp.q, 0.85), bio, cash: s.opp.cash + 800 }); } }
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
export const isLeader = (s) => !!memberById[s.youId]?.lead?.length && isMem(roleOf(s));
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
        if (isMem(role)) pushInbox(s, { kind: "staff", from: "Your legislative director", title: "A Supreme Court seat is open", body: `${role === "S" ? "The Senate confirms the replacement, and you'll get a vote. Every group you know is about to call." : "The House has no vote on it, but your base will want to hear from you."} The President will name someone within weeks.`, done: true });
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
  if (isMem(role)) pushInbox(s, { kind: "ruling", cons, from: "Your communications director", title: text.replace("The Supreme Court", "The Court"), body: `${cons === (you.p === "R") ? "Your side won this one." : "Your side lost this one."} Reporters want a statement.`, choices: ["Praise the decision", "Blast the Court", "Say nothing"] });
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
  if (isMem(role)) pushInbox(s, { kind: "crisisreact", cid, force: kind === "force", from: "Your communications director", title: `The President ${what}`, body: `${t.title}. Reporters want to know where you stand.${kind === "force" ? " Some members want a vote under the War Powers Resolution before this goes further." : ""}`, choices: kind === "force" ? ["Back the President", "Criticize the decision", "Demand a war powers vote"] : ["Back the President", "Criticize the decision", "Say nothing"] });
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
  const st = c.stance; if (st != null && isMem(roleOf(s))) { const backed = st === 0; s.approval = clamp(s.approval + (backed === ok ? 1 : -1) * 0.8, 5, 95); }
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
export function salaryOf(s) { if (roleOf(s) === "P") return 400; if (roleOf(s) === "C") return 250.6; if (roleOf(s) === "G") return 200; const l = memberById[s.youId]?.lead?.[0] || ""; return /^Speaker/.test(l) ? 223.5 : /Majority Leader|Minority Leader|Republican Leader|Democratic Leader|Pro Tempore/.test(l) && !/Assistant/.test(l) ? 193.4 : 174; }
export const TRADE = { none: { label: "Cash and bonds", mu: 0.0007, sd: 0.001 }, index: { label: "Index funds", mu: 0.0015, sd: 0.02 }, active: { label: "Pick individual stocks", mu: 0.0016, sd: 0.032 }, informed: { label: "Trade on what you hear in closed briefings", mu: 0.0055, sd: 0.03 } };
export const earnTotal = (s) => Object.values(s.earn || {}).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
function earnSeed(s) { const you = memberById[s.youId]; s.earn = { salary: 0, invest: 0, book: 0, outside: 0, spouse: 0, family: 0, after: 0 }; s.port = roleOf(s) === "P" ? 0 : Math.round(150 + (you?.seniority || 0) * 70 + (you?.lead?.length ? 500 : 0) + (2027 - (you?.born || 1975)) * 8); s.trade = "index"; }
function scandal(s, title, body, choices, kind = "money") { pushInbox(s, { kind: "moneyscandal", sub: kind, from: "Your communications director", title, body, choices }); }
function earnWeek(s, r) {
  if (!s.earn) earnSeed(s);
  const e = s.earn, role = roleOf(s), you = memberById[s.youId], banned = s.laws.includes("stock_ban");
  e.salary += salaryOf(s) / 52.18;
  if (isMem(role)) {
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

// ════════ Ambitions and elections: real people make career moves ════════
// Who might run for what. The chances are the game's guesses from public reporting through November 2026; what anyone
// actually decides is invented. Refs: "m:Last ST" a member of Congress, "f:Last" a former official or governor, "c:vp" a Cabinet post.
// The 2028 presidential field: ref, chance they run, ideology (-1 left .. +1 right; members use their own), national fame, favorability.
const FIELD28 = [
  ["f:Newsom", 0.85, -0.42, 90, 45], ["f:Buttigieg", 0.66, -0.3, 84, 48], ["f:Shapiro", 0.65, -0.22, 72, 54], ["f:Pritzker", 0.55, -0.4, 66, 48],
  ["f:Beshear", 0.6, -0.22, 60, 55], ["m:Ocasio-Cortez NY", 0.3, null, 94, 46], ["f:Harris", 0.3, -0.4, 88, 43], ["f:Moore", 0.4, -0.32, 62, 52],
  ["m:Khanna CA", 0.5, null, 58, 46], ["m:Booker NJ", 0.3, null, 72, 47], ["m:Murphy CT", 0.35, null, 62, 47], ["m:Kelly AZ", 0.22, null, 66, 52],
  ["m:Gallego AZ", 0.2, null, 56, 49], ["f:Whitmer", 0.2, -0.32, 64, 50], ["f:Emanuel", 0.3, -0.1, 55, 42], ["f:Walz", 0.06, -0.35, 60, 44],
  ["c:vp", 0.92, 0.66, 94, 42], ["c:state", 0.5, 0.55, 82, 45], ["f:DeSantis", 0.45, 0.68, 76, 46], ["m:Cruz TX", 0.4, null, 86, 41],
  ["m:Hawley MO", 0.3, null, 70, 43], ["f:Youngkin", 0.45, 0.5, 58, 50], ["f:Haley", 0.3, 0.4, 72, 45], ["f:Greene", 0.22, 0.85, 80, 34],
  ["m:Paul KY", 0.2, null, 74, 45], ["f:Ramaswamy", 0.12, 0.7, 68, 40], ["f:Kemp", 0.15, 0.45, 55, 52], ["m:Scott SC", 0.1, null, 64, 50],
];
// Senate runs in 2028: ref, state, chance, ideology, quality in a general (points), the incumbent they'd take on in a primary.
const SEN28 = [
  ["m:Ocasio-Cortez NY", "NY", 0.38, null, 0, "Schumer NY", "Says the party needs a fighter, not a dealmaker"],
  ["f:Kemp", "GA", 0.5, 0.45, 4, null, "Georgia's two-term governor, the strongest recruit Republicans have"],
  ["f:Sununu", "NH", 0.35, 0.3, 5, null, "the popular former governor who turned the race down once before"],
  ["f:Hogan", "MD", 0.08, 0.25, 3, null, "the former governor who lost the 2024 Senate race"],
  ["f:Buttigieg", "IN", 0.05, -0.3, 3, null, "back in the state where he was mayor"],
  ["f:Lamb", "PA", 0.3, -0.2, 1, "Fetterman PA", "the former congressman, running from the party's middle"],
  ["f:Walz", "MN", 0.2, -0.35, 0, null, "for the special election to finish Amy Klobuchar's term"],
];
// Senators and members most likely to call it a career in 2028 (everyone else: age and chance).
const RETIRE28 = { "Grassley IA": 0.9, "Johnson WI": 0.7, "Blumenthal CT": 0.4, "Wyden OR": 0.4, "Murray WA": 0.3, "Welch VT": 0.3, "Schumer NY": 0.16, "Fetterman PA": 0.22,
  "Crapo ID": 0.2, "Boozman AR": 0.25, "Moran KS": 0.2, "Hoeven ND": 0.2, "Kennedy LA": 0.12, "Waters CA": 0.55 };
// Delegates and the calendar (weeks into the term, share of all delegates at stake).
const CAL = [[55, "Iowa and New Hampshire", 0.02], [57, "Nevada and South Carolina", 0.03], [61, "Super Tuesday", 0.36], [63, "Michigan, Florida, Illinois and Ohio", 0.15],
  [66, "New York, Pennsylvania and Wisconsin", 0.15], [70, "The May primaries", 0.12], [74, "The last primaries, in June", 0.17]];
export const DELS = { D: 3950, R: 2430 }, BASE_X = { D: -0.38, R: 0.62 };
export const upNow = (s, m) => m.ch === "H" || m.cls === cycleClass(s.term) || (m.appointee && electionYear(s) === 2028) || m.specialYear === electionYear(s);
const isReal = (P) => P && !P.fictional;
const ttl = (P) => (/^(Former |Governor|Sen\.|Rep\.|Vice President|Secretary|Mayor|Speaker)/.test(P?.title || "") ? `${P.title} ` : "");
export const pname = (P, real) => (P === "you" ? "You" : !P ? "" : real ? `${P.first} ${P.last}` : `${P.sf} ${P.sl}`);
function newsBoth(s, build, tone = "") { pushNews(s, build(false), tone); s.news[0].rt = build(true); }
function inboxBoth(s, msg, build) { const a = build(false), b = build(true); pushInbox(s, { ...msg, title: a.title, body: a.body, rtitle: b.title, rbody: b.body }); }
// A real person from the data, as a plain record the race can carry around.
export function person(s, ref) {
  const t = ref[0], key = ref.slice(2);
  if (t === "m") { const m = MEMBERS.find((x) => `${x.last} ${x.st}` === key && !x.fictional && !x.custom && !x.vacant); return m ? { ref, id: m.id, first: m.first, last: m.last, sf: m.sf, sl: m.sl, p: m.p, x: m.x, born: m.born, g: m.g, look: m.look, ch: m.ch, st: m.st, t: m.t, title: `${titleOf(m)}` } : null; }
  if (t === "c") { const c = (s.cab || []).find((x) => x.id === key), o = CABINET.find((x) => x.id === key); return c && o && !c.vacant && c.last === o.last ? { ref, cab: key, first: c.first, last: c.last, sf: c.sf, sl: c.sl, p: "R", born: c.born, g: "M", look: { skin: c.tone ?? 0 }, title: c.post } : null; }
  const f = FORMER.find((x) => x[1] === key); if (!f) return null;
  const [first, last, p, born, g, skin, title] = f, [sf, sl] = swapPair(first.split(" ")[0], last);
  if (PRES_M.last === last && PRES_M.first === first) return null;
  if (MEMBERS.some((m) => m.last === last && m.first === first)) return null;    // already in Congress
  return { ref, first, last, sf: first.includes(" ") ? `${sf} ${first.split(" ").slice(1).join(" ")}` : sf, sl, p, born, g, look: { skin }, title };
}
const youCand = (s) => { const y = memberById[s.youId]; return { ref: "you", id: y.id, first: y.first, last: y.last, sf: y.sf, sl: y.sl, p: y.p, x: y.x, born: y.born, g: y.g, look: y.look, you: true }; };
// The generic retirement rule: old age, or a random few.
function retiresGeneric(s, m) { return noise(`${s.seed}:ret${s.term}:${m.id}`) < -0.86 || (YEAR + 1 - (m.born || 1960) > 82); }
const notable = (m) => m.ch === "S" || m.lead?.length || FAME[`${m.last} ${m.st}`] || (m.seniority || 0) > 24;
function primaryLoss(s, m) {
  const base = BASE_X[m.p], off = Math.abs(m.x - base), age = YEAR + 1 - (m.born || 1960);
  const p = (0.008 + (age >= 80 ? 0.03 : 0) + (m.prisk > 0.7 ? 0.02 : 0) + (off > 0.55 ? 0.03 : 0)) * (m.ch === "S" ? 0.5 : 1);
  return rng(hash(`${s.seed}:pl${s.term}:${m.id}`))() < p;
}
function chalName(s, m) {
  const r = rng(hash(`${s.seed}:chal:${m.id}:${s.term}`)), used = new Set(MEMBERS.map((x) => x.last));
  let last = PL[Math.floor(r() * PL.length)]; for (let i = 0; used.has(last) && i < 20; i++) last = PL[Math.floor(r() * PL.length)];
  const first = PF[Math.floor(r() * PF.length)], base = BASE_X[m.p];
  return { first, last, sf: first, sl: last, p: m.p, g: r() < 0.45 ? "F" : "M", x: Math.round((m.x * 0.4 + base * 0.6 + (r() - 0.5) * 0.15) * 1000) / 1000, fictional: true };
}
function ambSeed(s) {
  const year = electionYear(s), r = rng(hash(`${s.seed}:amb:${year}`)), presYr = year % 4 === 0;
  const A = { year, plans: [], log: [], out: {}, sen: {}, quiet: 0, pr: null, done: {} };
  const wk = (a, b) => a + Math.floor(r() * (b - a));
  // Who isn't running again.
  for (const m of MEMBERS) {
    if (m.id === s.youId || !upNow(s, m) || m.vacant) continue;
    const curated = year === 2028 && !m.fictional ? RETIRE28[`${m.last} ${m.st}`] : null;
    if (curated != null ? r() < curated : retiresGeneric(s, m)) A.out[m.id] = { why: "retire", wk: wk(16, 70), say: notable(m) };
  }
  if (year === 2028) {
    const plans = {};
    // One decision per person: the White House, the Senate, or staying put.
    const vance = FIELD28.find((x) => x[0] === "c:vp");
    const vanceRuns = r() < vance[1];
    for (const row of FIELD28) { const [ref, p0] = row; let p = p0; if (ref === "c:vp") p = vanceRuns ? 1 : 0; if (ref === "c:state") p = vanceRuns ? 0.12 : 0.8; plans[ref] = { ref, pres: p, row }; }
    for (const row of SEN28) (plans[row[0]] = plans[row[0]] || { ref: row[0], pres: 0 }).sen = row;
    for (const pl of Object.values(plans)) {
      const P = person(s, pl.ref); if (!P || P.id === s.youId) continue;
      const roll = r(), sp = pl.sen ? pl.sen[2] : 0;
      const kind = roll < pl.pres ? "pres" : roll < pl.pres + sp ? "sen" : "stay";
      if (kind === "stay" && (pl.row?.[3] || 0) < 80) continue;      // only the biggest names make news by saying no
      A.plans.push({ ref: pl.ref, kind, wk: kind === "pres" ? (pl.ref === "c:vp" ? wk(40, 50) : wk(16, 50)) : kind === "sen" ? wk(22, 56) : wk(30, 54), row: pl.row, sen: pl.sen });
    }
  }
  // The White House race: both parties, unless a President is running for a second term.
  if (presYr) {
    A.pr = { D: { c: [], nom: null }, R: { c: [], nom: null }, cal: CAL.map(([w, name, f]) => ({ w, name, f, res: null })) };
    const inc = s.presRec && (s.presRec.since || 0) >= year - 4 && s.presRec.p;      // a first-term President
    if (inc && electionYear(s) > 2028) { const P = { ...s.presRec, sf: s.presRec.sf || s.presRec.first, sl: s.presRec.sl || s.presRec.last, ref: "potus", x: BASE_X[s.presRec.p] * 0.8, you: !!s.presRec.you && !!s.presCareer }; A.pr[inc].c.push(cand(P, 90, 48)); A.pr[inc].nom = A.pr[inc].c[0]; A.pr[inc].solo = true; A.pr[inc].mate = s.presCareer?.mate || null; }
    if (year > 2028) {
      // Later cycles: the biggest names in each party with no incumbent take a shot.
      for (const p of ["D", "R"]) { if (A.pr[p].nom) continue;
        const pool = MEMBERS.filter((m) => m.p === p && !m.fictional && m.id !== s.youId && (FAME[`${m.last} ${m.st}`] || 0) >= 62 && YEAR + 1 - (m.born || 1960) < 76)
          .map((m) => [`m:${m.last} ${m.st}`, FAME[`${m.last} ${m.st}`]]);
        for (const row of FIELD28.filter((x) => x[0][0] === "f")) { const P = person(s, row[0]); if (P && P.p === p && YEAR + 1 - P.born < 76) pool.push([row[0], row[3]]); }
        pool.sort((a, b) => b[1] - a[1] + (r() - 0.5) * 20).slice(0, 6).forEach(([ref, fame]) => A.plans.push({ ref, kind: "pres", wk: wk(12, 48), row: [ref, 1, null, fame, 47] }));
      }
    }
  }
  return A;
}
function cand(P, fame, pop, x) { return { ...P, x: x ?? P.x ?? 0, fame, pop, sup: 0, del: 0, mom: 0, out: false }; }
// Open seat: if a real House member of that party in the state wants it, they run.
function stepUp(s, A, seat, p, r, chance) {
  const pick = HOUSE.filter((m) => m.st === seat.st && m.p === p && m.id !== s.youId && !A.out[m.id] && !m.fictional && YEAR + 1 - (m.born || 1960) < 72).sort((a, b) => (b.t.ambition + (FAME[`${b.last} ${b.st}`] || 0) / 100) - (a.t.ambition + (FAME[`${a.last} ${a.st}`] || 0) / 100))[0];
  if (!pick || r() > chance) return null;
  const P = person(s, `m:${pick.last} ${pick.st}`); if (!P) return null;
  A.out[pick.id] = { why: "senate", st: seat.st, wk: s.week - (s.termStart || 0), say: false };
  return { ...P, q: 0, how: "house" };
}
function senKey(A, st) { return (A.sen[st] = A.sen[st] || {}); }
// Fill open Senate seats with nominees once the field settles.
function openSeats(s, A, r, rw) {
  for (const m of SENATE) {
    if (!upNow(s, m) || m.id === s.youId) continue;
    const o = A.out[m.id], k = senKey(A, m.st);
    if (o && o.wk > rw) continue;                     // not public yet
    if (rw < 72 && r() > 0.2) continue;               // campaigns launch over the spring, not all at once
    if (o && !k[m.p] && k[`chal${m.p}`]) k[m.p] = k[`chal${m.p}`];
    if (o && !k[m.p]) { const P = stepUp(s, A, m, m.p, r, 0.6); if (P) { k[m.p] = P; newsBoth(s, (real) => `${ttl(P)}${pname(P, real)} launches a campaign for the open Senate seat in ${m.st}.`, "event"); } }
    const other = m.p === "D" ? "R" : "D";
    if (!k[other] && (o || Math.abs(m.dem - 50) < 5)) { const P = stepUp(s, A, m, other, r, o ? 0.35 : 0.15); if (P) { k[other] = P; newsBoth(s, (real) => `${ttl(P)}${pname(P, real)} (${other}) will run for Senate in ${m.st}.`, "event"); } }
  }
}
function announce(s, A, pl, r) {
  const P = person(s, pl.ref); pl.done = true; if (!P) return;
  const you = memberById[s.youId];
  if (pl.kind === "stay") { newsBoth(s, (real) => `${pname(P, real)} rules out a 2028 run for president: "Not this time."`); A.log.push({ wk: s.week, ref: pl.ref, kind: "stay" }); return; }
  if (pl.kind === "pres") {
    const row = pl.row, c = cand(P, row[3], row[4], row[2] ?? P.x);
    if (!A.pr || A.pr[P.p].solo) return;
    A.pr[P.p].c.push(c);
    const m = P.id && memberById[P.id]; if (m && upNow(s, m)) A.out[m.id] = { why: "pres", wk: s.week - s.termStart, say: false };
    newsBoth(s, (real) => `${ttl(P)}${pname(P, real)} announces a run for president in ${A.year}.${m && upNow(s, m) ? ` ${m.ch === "S" ? "The Senate seat" : "The House seat"} goes on the ballot without them.` : ""}`, "event");
    A.log.push({ wk: s.week, ref: pl.ref, kind: "pres", p: P.p });
    return;
  }
  // A Senate run.
  const [, st, , x, q, target, why] = pl.sen, seat = SENATE.find((m) => m.st === st && upNow(s, m)); if (!seat) return;
  const N = { ...P, x: x ?? P.x, q, why }, k = senKey(A, st);
  const m = P.id && memberById[P.id]; if (m) A.out[m.id] = { why: "senate", st, wk: s.week - s.termStart, say: false };
  A.log.push({ wk: s.week, ref: pl.ref, kind: "sen", st, p: P.p });
  if (seat.p === P.p && target === `${seat.last} ${seat.st}` && !seat.fictional) {
    // A primary challenge to a sitting senator.
    N.vs = seat.id; k[`chal${P.p}`] = N;
    newsBoth(s, (real) => `${ttl(P)}${pname(P, real)} will challenge ${nameOf(seat, real)} in the ${st} Senate primary. ${why}.`, "event");
    if (seat.id === s.youId) {
      s.pchal = { ...N, real: true, q: 0.85, cash: 2500, backer: P.p === "D" ? "jd" : "cfg", bio: why.toLowerCase(), since: s.week };
      inboxBoth(s, { kind: "pchal", from: "Your campaign manager", choices: ["Hit back now ($150K in contrast mail)", "Lock down endorsements (8 hours)", "Ignore it"] }, (real) => ({ title: `${pname(P, real)} is challenging you in the primary`,
        body: `It's official: ${pname(P, real)} is running against you for the nomination. This is not a gadfly. National money and a real following come with it. How do you answer?` }));
    } else if (r() < (RETIRE28[`${seat.last} ${seat.st}`] || 0.1) + 0.3) A.out[seat.id] = A.out[seat.id] || { why: "retire", wk: s.week - s.termStart + 3 + Math.floor(r() * 8), say: true, after: pname(P, false), afterR: pname(P, true) };
    return;
  }
  if (seat.p === P.p && !A.out[seat.id]) A.out[seat.id] = { why: "retire", wk: s.week - s.termStart + 1, say: true, quiet: true };   // a placeholder appointee steps aside
  k[P.p] = N;
  newsBoth(s, (real) => `${pname(P, real)} enters the Senate race in ${st}: ${why}.`, "event");
  if (seat.id === s.youId && s.opp) { Object.assign(s.opp, { first: P.sf, last: P.sl, rname: `${P.first} ${P.last}`, g: P.g, q: Math.max(s.opp.q, 0.85), bio: why, cash: s.opp.cash + 800 });
    inboxBoth(s, { kind: "staff", from: "Your campaign manager", done: true }, (real) => ({ title: `${pname(P, real)} is your opponent now`, body: `The other side cleared the field. ${pname(P, real)}, ${why}, is running for your seat, and the money is coming with them. This just became the race of the cycle.` })); }
}
// The race for the nomination, week by week.
function util(s, c, p, wkKey, spread = 0.25) {
  const you = c.you, fame = you ? s.profile * 0.9 : c.fame, pop = you ? youPop(s) : c.pop, cash = you ? Math.min(0.3, s.cash / 8000) : 0;
  return fame / 14 + (pop - 45) / 12 - Math.abs(c.x - BASE_X[p]) * 3.2 + c.mom + cash + noise(`${s.seed}:pr:${c.last}:${wkKey}`) * spread;
}
function shares(s, P, p, key, spread) {
  const act = P.c.filter((c) => !c.out); const u = act.map((c) => Math.exp(util(s, c, p, key, spread))), t = u.reduce((a, b) => a + b, 0) || 1;
  act.forEach((c, i) => (c._sh = u[i] / t)); return act;
}
function endorse(s, P, p, c) {
  const rest = P.c.filter((x) => !x.out && x !== c); if (!rest.length) return null;
  const to = rest.sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x) - (b.sup - a.sup) * 2)[0]; to.mom += 0.3 + c.sup * 3; c.endorse = { first: to.first, last: to.last, sf: to.sf, sl: to.sl, you: !!to.you }; return to;
}
function prWeek(s, A, r, rw) {
  for (const p of ["D", "R"]) {
    const P = A.pr[p]; if (P.nom || P.solo) continue;
    if (!P.c.length) continue;
    for (const c of P.c) c.mom *= 0.8;
    const act = shares(s, P, p, s.week);
    for (const c of act) c.sup = c.sup ? c.sup * 0.7 + c._sh * 0.3 : c._sh;
    // Polls and debates before the voting starts.
    if (rw < 55 && rw >= 34 && rw % 6 === 4 && act.length > 1) { const top = [...act].sort((a, b) => b.sup - a.sup).slice(0, 4); newsBoth(s, (real) => `New ${A.year} poll, ${p === "D" ? "Democratic" : "Republican"} primary: ${top.map((c) => `${c.you ? nameOf(memberById[s.youId], real) : pname(c, real)} ${Math.round(c.sup * 100)}%`).join(", ")}.`); }
    if ((rw === 44 || rw === 52) && act.length > 1 && !act.some((c) => c.you)) { const w = act[Math.floor(r() * Math.min(4, act.length))]; w.mom += 0.4; newsBoth(s, (real) => `${p === "D" ? "Democratic" : "Republican"} debate: ${pname(w, real)} has the night's best moment, and the clip is everywhere.`); }
  }
  const ev = A.pr.cal.find((x) => x.w === rw && !x.res); if (!ev) return;
  ev.res = {};
  for (const p of ["D", "R"]) {
    const P = A.pr[p]; if (P.nom || !P.c.length) continue;
    const act = shares(s, P, p, `c${rw}`, 0.7).sort((a, b) => b._sh - a._sh), tot = Math.round(DELS[p] * ev.f);
    // Democrats split delegates by vote above 15%; Republican states lean winner-take-all.
    const elig = p === "D" ? act.filter((c) => c._sh >= 0.15) : act, w = elig.map((c) => (p === "D" ? c._sh : c._sh ** 1.8)), wt = w.reduce((a, b) => a + b, 0) || 1;
    elig.forEach((c, i) => (c.del += Math.round((tot * w[i]) / wt)));
    act[0].mom += 0.8; if (act[1]) act[1].mom += 0.25;
    ev.res[p] = act.slice(0, 3).map((c) => ({ last: c.last, sl: c.sl, first: c.first, sf: c.sf, you: !!c.you, v: Math.round(c._sh * 100) }));
    const W = act[0];
    newsBoth(s, (real) => `${ev.name}: ${W.you ? `you win the ${p === "D" ? "Democratic" : "Republican"} vote` : `${pname(W, real)} wins the ${p === "D" ? "Democratic" : "Republican"} vote`} with ${Math.round(W._sh * 100)}%${act[1] ? `, ahead of ${act[1].you ? "you" : pname(act[1], real)} at ${Math.round(act[1]._sh * 100)}%` : ""}.`, act[0].you ? "good" : "event");
    // Dropouts.
    const idx = A.pr.cal.indexOf(ev), lead = Math.max(...act.map((c) => c.del));
    for (const c of act) {
      if (c === W) continue;
      const bar = idx === 0 ? 0.04 : idx === 1 ? 0.07 : idx === 2 ? 0.14 : 0.2;
      if (c._sh < bar || (idx >= 3 && c.del < lead / 3) || (idx >= 4 && act.filter((x) => !x.out).length > 2 && c !== act[1])) {
        c.out = rw; const to = endorse(s, P, p, c);
        if (c.you) youOut(s, A, to); else { const m = c.id && memberById[c.id]; if (m && A.out[m.id]?.why === "pres" && rw < 70) delete A.out[m.id];
          newsBoth(s, (real) => `${pname(c, real)} ends ${c.g === "F" ? "her" : "his"} campaign${to ? ` and endorses ${to.you ? nameOf(memberById[s.youId], real) : pname(to, real)}` : ""}.`, to?.you ? "good" : ""); }
      }
    }
    const left = P.c.filter((c) => !c.out), top = [...left].sort((a, b) => b.del - a.del)[0];
    if (top && (top.del > DELS[p] / 2 || left.length === 1 || idx === A.pr.cal.length - 1)) clinch(s, A, p, top);
  }
}
function clinch(s, A, p, c) {
  const P = A.pr[p]; P.nom = c; P.clinchW = s.week - s.termStart;
  for (const x of P.c) if (x !== c && !x.out) { x.out = s.week - s.termStart; if (x.you) youOut(s, A, null, c); }
  if (c.you) {
    s.runFor = "pres"; s.profile = clamp(s.profile + 20, 0, 100); s.clout += 10;
    newsBoth(s, (real) => `${nameOf(memberById[s.youId], real)} clinches the ${p === "D" ? "Democratic" : "Republican"} nomination for president.`, "good");
    pushInbox(s, { kind: "staff", from: "Your campaign chair", done: true, title: "You're the nominee", body: `You have the delegates. The convention is a coronation now. ${memberById[s.youId].ch === "H" || upNow(s, memberById[s.youId]) ? "Your own seat goes on the ballot without you." : "Win or lose in November, your Senate seat is safe until it's up."} Everything now is November.` });
    s.toast = { title: "You're the nominee", text: "You won the nomination for president. Now the general election.", tone: "good" };
  } else newsBoth(s, (real) => `${pname(c, real)} clinches the ${p === "D" ? "Democratic" : "Republican"} nomination for president.`, "event");
}
function youOut(s, A, to, winner = null) {
  const you = memberById[s.youId];
  if (winner) newsBoth(s, (real) => `${nameOf(you, real)} concedes the nomination to ${pname(winner, real)}.`, "bad");
  else newsBoth(s, (real) => `${nameOf(you, real)} drops out of the presidential race${to ? ` and endorses ${pname(to, real)}` : ""}.`, "bad");
  s.youPres = "out"; s.profile = clamp(s.profile + 4, 0, 100);
  pushInbox(s, { kind: "staff", from: "Your campaign chair", done: true, title: "The campaign is over", body: `${winner ? "The other side reached the magic number first. You concede and promise to campaign for the ticket." : "The delegate math stopped working, so you suspended."} ${upNow(s, you) ? "You filed for re-election to your own seat in time, so that race is still yours to win." : "You go back to your day job with a bigger name than you had."} ${to ? "Your endorsement was worth something; that campaign will remember it." : ""}` });
}
// Your own primary challenger: a real person when one is in the data, otherwise someone new with a backer and a message.
const CHAL_BIO = {
  left: [["a 31-year-old tenant organizer with a viral launch video", "jd"], ["a state legislator and DSA member", "dsa"], ["a former Sunrise organizer who now sits on the city council", "sunrise"]],
  center: [["a former prosecutor backed by crypto money", "fairshake"], ["a self-funding health care executive", null], ["a state senator who says you've lost touch with the district", "aipac"]],
  right: [["a combat veteran and talk-radio regular who calls you a RINO", "cfg"], ["a MAGA influencer with a million followers", "tpusa"], ["a state senator with Club money behind him", "cfg"]],
  estab: [["a former county judge backed by business groups", "uscc"], ["a farm-bureau president running as the grown-up in the room", "afp"]],
  young: [["a 34-year-old state legislator running on generational change", null], ["a 38-year-old veteran who says it's time to pass the torch", null]] };
const CHAL_LINE = { young: "You've served long enough. It's time for a new generation.", left: "You've gone soft. This district deserves a fighter.", center: "You're out of step with the people who actually live here.", right: "You voted with Democrats when it counted.", estab: "You're more interested in TV than in getting anything done." };
function makeChallenger(s, r) {
  const you = memberById[s.youId], side = yourAge(s) >= 72 && r() < 0.6 ? "young" : you.p === "D" ? (you.x > -0.5 ? "left" : "center") : (you.x < 0.75 ? "right" : "estab");
  const [bio, backer] = CHAL_BIO[side][Math.floor(r() * CHAL_BIO[side].length)], g = /\bhim\b|his\b/.test(bio) ? "M" : r() < 0.5 ? "F" : "M";
  let first = PF[Math.floor(r() * PF.length)]; const last = PL[Math.floor(r() * PL.length)];
  const fit = 1 - Math.min(1, Math.abs(you.x - BASE_X[you.p]) * 1.6), q = clamp(0.2 + r() * 0.4 + (1 - fit) * 0.3 + (55 - s.baseApproval) / 60, 0.1, 0.95);
  s.pchal = { first, last, sf: first, sl: last, g, side, bio, backer, q, cash: Math.round(80 + q * 900), since: s.week, line: CHAL_LINE[side], fictional: true };
  const org = backer && orgById[backer];
  pushInbox(s, { kind: "pchal", from: "Your campaign manager", choices: ["Hit back now ($150K in contrast mail)", "Lock down endorsements (8 hours)", "Ignore it"],
    title: `${first} ${last} files to run against you in the primary`,
    body: `${first} ${last}, ${bio}, is challenging you for the ${you.p === "D" ? "Democratic" : "Republican"} nomination.${org ? ` ${org.name} is behind the campaign.` : ""} The pitch: "${CHAL_LINE[side]}" ${q > 0.6 ? "This one is real. They're raising fast." : q > 0.35 ? "Credible enough to cost you money and attention." : "Probably a nuisance, unless you give them oxygen."}` });
  pushNews(s, `${first} ${last} launches a primary challenge to ${nameOf(you)}.`, "event");
}
function answerChal(s, m, choice) {
  const c = s.pchal; if (!c) return;
  if (choice === 0 && s.cash >= 150) { s.cash -= 150; c.q = clamp(c.q - 0.15, 0.05, 1); s.integrity -= 1; s.toast = { title: "You go negative early", text: "The mailers land before they've introduced themselves. Their numbers stall.", tone: "good" }; }
  else if (choice === 1 && s.hours >= 8) { s.hours -= 8; s.pchalLock = (s.pchalLock || 0) + 4; s.loyalty += 1; s.toast = { title: "Endorsements locked", text: "The local party, the unions and the mayor sign on with you. The challenger's path narrows.", tone: "good" }; }
  else { c.q = clamp(c.q + 0.06, 0, 1); s.toast = { title: "You ignore it", text: "No oxygen for them. Unless they find it on their own.", tone: "" }; }
}
// Marquee primaries across the country: some incumbents lose.
function primaryNight(s, A) {
  const year = A.year; let lost = 0; const names = [];
  for (const m of MEMBERS) {
    if (m.id === s.youId || !upNow(s, m) || A.out[m.id] || m.vacant) continue;
    const k = m.ch === "S" ? A.sen[m.st]?.[`chal${m.p}`] : null;
    if (k && k.vs === m.id) {   // a named challenger (AOC against Schumer, say)
      const win = rng(hash(`${s.seed}:named:${m.id}:${year}`))() < (k.ref === "m:Ocasio-Cortez NY" ? 0.6 : 0.4);
      if (win) { A.out[m.id] = { why: "primary", by: k }; senKey(A, m.st)[m.p] = k; lost++; newsBoth(s, (real) => `Upset in ${m.st}: ${pname(k, real)} defeats ${nameOf(m, real)} in the Senate primary.`, "event"); }
      else { newsBoth(s, (real) => `${nameOf(m, real)} holds off ${pname(k, real)} in the ${m.st} Senate primary.`, "event"); }
      continue;
    }
    if (!primaryLoss(s, m)) continue;
    const c = chalName(s, m); A.out[m.id] = { why: "primary", by: c }; lost++;
    if (notable(m)) names.push(m);
  }
  for (const m of names.slice(0, 4)) { const c = A.out[m.id].by; newsBoth(s, (real) => `Primary upset: ${titleOf(m)} ${nameOf(m, real)} loses the ${m.p === "D" ? "Democratic" : "Republican"} nomination to ${c.first} ${c.last}.`, "event"); }
  pushNews(s, `Primary season wraps up: ${lost} incumbent${lost === 1 ? "" : "s"} lost renomination this year, and ${Object.values(A.out).filter((o) => o.why === "retire").length} members are retiring.`);
  A.prim = lost;
}
function ambitionWeek(s, r) {
  if (roleOf(s) === "P" && !s.presCareer) return;
  const rw = s.week - (s.termStart || 0), you = memberById[s.youId];
  if (!s.amb || s.amb.year !== electionYear(s)) { s.amb = ambSeed(s); s.pchal = null; s.pchalLock = 0; s.pdebate = 0; s.youPres = null; }
  const A = s.amb;
  for (const pl of A.plans) if (!pl.done && pl.wk === rw) announce(s, A, pl, r);
  for (const [id, o] of Object.entries(A.out)) if (o.why === "retire" && o.say && o.wk === rw && !o.said) { o.said = true; const m = memberById[id]; if (!m) continue;
    if (o.quiet) newsBoth(s, (real) => `${titleOf(m)} ${nameOf(m, real)}, appointed to the seat, says ${m.g === "F" ? "she" : "he"} won't run to keep it.`);
    else newsBoth(s, (real) => `${titleOf(m)} ${nameOf(m, real)} (${m.p}-${m.st}) won't seek re-election${o.after ? `, ending a primary fight with ${real ? o.afterR : o.after} before it starts` : ""}.${m.ch === "S" ? " The Senate seat is open." : ""}`, "event"); }
  if (rw >= 40 && rw <= 72) openSeats(s, A, r, rw);
  if (A.pr && rw >= 30) prWeek(s, A, r, rw);
  if (rw === 76) primaryNight(s, A);
  if (A.pr) conventions(s, A, r, rw);
  if (roleOf(s) === "P") return;
  // You: a presidential run, if you're big enough.
  if (A.pr && rw === 30 && isMem(roleOf(s)) && !s.runFor && !A.pr[you.p].solo && (s.profile >= 70 || (you.ch === "S" && s.profile >= 50 && s.clout >= 70)) && !A.pr[you.p].c.some((c) => c.id === you.id))
    pushInbox(s, { kind: "presrun", from: "Your political director", choices: ["Run for president", "Not this time"], title: `The ${A.year} question`,
      body: `Donors are calling and the early-state chairs want a meeting. With your profile you'd start in the conversation, not at the kids' table. A run means debates, Iowa and New Hampshire, and months away from Washington. ${upNow(s, you) ? "If it goes badly early enough, you can still file for your own seat." : "Your Senate seat is safe either way."}` });
  if (s.youPres === "in" && A.pr && !A.pr[you.p].nom) { s.hours = Math.max(0, s.hours - 6); if (rw === 44 || rw === 52) { const top = A.pr[you.p].c.filter((c) => !c.out && !c.you).sort((a, b) => b.sup - a.sup)[0]; if (top) pushScene(s, "pdebate", { pres: true, opp: pname(top, false), oppR: pname(top, true), oppG: top.g, oppId: "pr" + top.last, side: Math.abs(top.x - you.x) < 0.2 ? "center" : (you.p === "D" ? (top.x < you.x ? "left" : "center") : (top.x > you.x ? "right" : "estab")) }, `${A.year} primary debate`, "Your campaign chair"); } }
  // Your own primary.
  if (upNow(s, you) && !s.runFor && s.youPres !== "in") {
    if (rw === 42 && !s.pchal) { const fit = 1 - Math.min(1, Math.abs(you.x - BASE_X[you.p]) * 1.6), est = s.baseApproval + fit * 8 - (you.prisk > 0.5 ? 6 : 0); if (r() < clamp((64 - est) / 20, 0, 0.75) + 0.12) makeChallenger(s, r); }
    if (s.pchal && rw > 42 && rw < PRIMARY_WEEK) s.pchal.q = clamp(s.pchal.q + 0.004, 0, 1);
    if (s.pchal && rw === PRIMARY_WEEK - 3) pushScene(s, "pdebate", { opp: pname(s.pchal, false), oppR: s.pchal.real ? pname(s.pchal, true) : null, oppG: s.pchal.g, oppId: "pc" + s.pchal.last, side: s.pchal.side || "left", line: s.pchal.line, ch: you.ch }, `Primary debate against ${pname(s.pchal, false)}`, "Your campaign manager");
  }
}
// How much a nominee helps or hurts their ticket in November, in points.
// Home state of a candidate, when we know it.
const HOME = { Newsom: "CA", Harris: "CA", Shapiro: "PA", Pritzker: "IL", Beshear: "KY", Moore: "MD", Whitmer: "MI", Buttigieg: "MI", Walz: "MN", Emanuel: "IL", Kemp: "GA", DeSantis: "FL", Youngkin: "VA", Haley: "SC",
  Greene: "GA", Ramaswamy: "OH", Vance: "OH", Rubio: "FL", Sununu: "NH", Hogan: "MD", Lamb: "PA", Klobuchar: "MN", Hochul: "NY", Obama: "IL" };
function homeOf(s, c) { if (!c) return null; if (c.you || c.ref === "potus") { const y = s.presCareer?.from || memberById[s.youId]; return c.st || y?.st || null; } return c.st || HOME[c.last] || null; }
// Running mates: rivals who did well, or a senator from a swing state, picked to balance the ticket.
function mateOptions(s, A, p, nom) {
  const pool = A.pr[p].c.filter((c) => c !== nom && !c.you && c.ref !== "potus").map((c) => ({ ...c, how: "rival" }));
  for (const m of SENATE) { if (m.p !== p || m.fictional || m.id === s.youId || Math.abs(m.dem - 50) > 4 || YEAR + 1 - (m.born || 1960) > 70) continue; const P = person(s, `m:${m.last} ${m.st}`); if (P && !pool.some((x) => x.last === P.last)) pool.push({ ...P, fame: FAME[`${m.last} ${m.st}`] || 50, pop: 50, how: "senator" }); }
  const target = BASE_X[p] * 0.55, nx = nom.you ? memberById[s.youId]?.x ?? nom.x : nom.x;
  const score = (c) => (c.pop - 46) * 0.12 + (c.fame - 60) * 0.03 + (c.del || 0) / 800 - Math.abs(c.x - (target * 2 - nx)) * 1.5 + (homeOf(s, c) && STATE_DEM[homeOf(s, c)] && Math.abs(STATE_DEM[homeOf(s, c)] - 50) < 3 ? 1 : 0);
  return pool.map((c) => ({ c, sc: score(c) })).sort((a, b) => b.sc - a.sc).map((x) => x.c);
}
function setMate(s, A, p, c) {
  const P = A.pr[p]; P.mate = c; const nom = P.nom;
  if (c.id && memberById[c.id]?.last === c.last) { /* a member on the ticket keeps the seat unless the ticket wins */ }
  newsBoth(s, (real) => `${nom.you ? nameOf(memberById[s.youId], real) : pname(nom, real)} picks ${pname(c, real)} as running mate.`, nom.you ? "good" : "event");
}
function conventions(s, A, r, rw) {
  for (const p of ["D", "R"]) {
    const P = A.pr[p]; if (!P.nom || P.mate) continue;
    if (P.solo && P.nom.ref === "potus") { P.mate = P.mate || s.presCareer?.mate || null; continue; }
    const opts = mateOptions(s, A, p, P.nom);
    if (P.nom.you) {
      if (!P.asked && opts.length) { P.asked = true; P.opts = opts.slice(0, 3); inboxBoth(s, { kind: "vpick", from: "Your campaign chair", choices: P.opts.map((c) => pname(c, false)), rchoices: P.opts.map((c) => pname(c, true)) }, (real) => ({ title: "Pick your running mate",
        body: `The vetting is done. Your shortlist: ${P.opts.map((c) => `${pname(c, real)} (${c.how === "rival" ? (c.del ? `ran against you and won ${c.del.toLocaleString()} delegates` : "ran against you") : `senator from ${c.st}, a swing state`})`).join("; ")}. A good pick helps a little nationally and a bit more in their home state. If you don't choose, your chair will make the call before the convention.` })); }
      if (rw === (p === "D" ? 80 : 78) && opts.length) setMate(s, A, p, (P.opts || opts)[0]);
    } else if (rw >= P.clinchW + 6 || rw >= 77) { if (opts.length) setMate(s, A, p, opts[Math.floor(r() * Math.min(2, opts.length))]); }
  }
  // The conventions: Republicans in July, Democrats in August, each with a short-lived bounce.
  for (const [p, w] of [["R", 79], ["D", 81]]) if (rw === w && A.pr[p].nom) { const P = A.pr[p], k = 0.6 + r() * 1.4; P.bounce = k; s.mood = clamp(s.mood + (p === "D" ? 1 : -1) * k * 0.4, -12, 12);
    newsBoth(s, (real) => `The ${p === "D" ? "Democratic" : "Republican"} convention wraps up: ${P.nom.you ? nameOf(memberById[s.youId], real) : pname(P.nom, real)} accepts the nomination${P.mate ? `, with ${pname(P.mate, real)} on the ticket` : ""}. Polls show a ${k.toFixed(1)}-point bounce.`, P.nom.you ? "good" : "event"); }
  for (const p of ["D", "R"]) if (A.pr[p].bounce && rw > 82) A.pr[p].bounce *= 0.85;
}
// ════════ Vacancies: resignations, appointments, special elections and party switches ════════
// No real person dies in the game. Seats open when members resign: a new job, their health, a scandal, or a post in the administration.
const LEAVE = [["resigns to take a job in the private sector", 0.3], ["steps down, citing health", 0.25], ["resigns amid an ethics investigation", 0.15], ["resigns to run a university", 0.05], ["resigns to join the administration", 0.25]];
const ctrl = () => ({ H: { D: HOUSE.filter((m) => m.p === "D").length, R: HOUSE.filter((m) => m.p === "R").length }, S: { D: SENATE.filter((m) => m.p === "D").length, R: SENATE.filter((m) => m.p === "R").length } });
function pickLeaver(s, ch, r) {
  const pool = MEMBERS.filter((m) => m.ch === ch && !m.vacant && m.id !== s.youId && !(m.lead || []).some((t) => /Speaker|Leader/.test(t)));
  const w = pool.map((m) => 1 + Math.max(0, YEAR - (m.born || 1960) - 65) * 0.15), t = w.reduce((a, b) => a + b, 0); let x = r() * t;
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; } return pool[0];
}
function vacancyWeek(s, r) {
  const rw = s.week - (s.termStart || 0), year = gameYear(s);
  for (const m of MEMBERS) { const v = m.vacant; if (!v) continue;
    if (v.appoint && s.week >= v.appoint) appointSenator(s, m, r);
    else if (v.special && s.week >= v.special) specialElection(s, m, r); }
  if (rw < 6 || rw > 84) return;
  for (const [ch, p] of [["H", 0.085], ["S", 0.012]]) if (r() < p) {
    const m = pickLeaver(s, ch, r); if (!m) continue;
    let why = LEAVE[LEAVE.length - 1][0]; { let x = r(); for (const [w, q] of LEAVE) { x -= q; if (x <= 0) { why = w; break; } } }
    if (/administration/.test(why) && m.p !== PP) why = LEAVE[0][0];
    if (/ethics/.test(why) && !m.fictional) why = "resigns to spend more time with family";   // no invented scandals for real people
    const was = { first: m.first, last: m.last, sf: m.sf, sl: m.sl, p: m.p, seat: m.seat, ch: m.ch, fictional: !!m.fictional };
    const you = memberById[s.youId], offer = ch === "S" && you?.ch === "H" && you.st === m.st && you.p === (SAME_PARTY_APPT.has(m.st) ? m.p : govParty(s, m.st)) && !s.runFor && s.youPres !== "in";
    const special = ch === "H" ? s.week + 14 + Math.floor(r() * 10) : null, late = special && special - (s.termStart || 0) > 90;
    m.vacant = { why, since: s.week, was, special: late ? null : special, appoint: ch === "S" ? s.week + (offer ? 3 : 1) : null };
    keep(s, m); rebuildChambers(); clearCaches();
    const c = ctrl(), maj = ch === "H" ? `The House now stands at ${c.H.D} Democrats, ${c.H.R} Republicans, with one seat empty${HOUSE.length < 434 ? ` (${435 - HOUSE.length} empty in all)` : ""}.` : "";
    newsBoth(s, (real) => `${ch === "H" ? "Rep." : "Sen."} ${pname(was, real)} (${m.p}-${ch === "H" ? m.seat : m.st}) ${why}. ${ch === "H" ? (late ? "The seat stays empty until November." : `A special election is set for ${fmtDate(special)}.`) : "The governor will name a replacement."}${maj ? ` ${maj}` : ""}`, "event");
    if (offer) pushInbox(s, { kind: "senapt", seat: m.id, from: "Your chief of staff", choices: ["Ask the governor for the appointment", "Stay in the House"], title: `A Senate seat in ${m.st} just opened`,
      body: `With ${pname(was, false)} gone, the governor will appoint a ${m.p === "D" ? "Democrat" : "Republican"} to the seat within days. You're on the list. Asking costs nothing but pride; getting it means giving up your House seat, which goes to a special election. ${m.cls === cycleClass(s.term) || rw < 70 ? "The appointee has to run to keep the seat." : ""}`, rbody: null });
  }
  if (r() < 0.003) partySwitch(s, r);
}
function appointSenator(s, m, r) {
  const was = m.vacant?.was, rw = s.week - (s.termStart || 0), sy = rw < 70 ? electionYear(s) : electionYear(s) + 2;
  const gp = SAME_PARTY_APPT.has(m.st) ? (was?.p || m.p) : govParty(s, m.st), flipped = gp !== (was?.p || m.p);
  newcomer(s, m, gp, gameYear(s) - 1); m.appointee = true; if (m.cls !== cycleClass(s.term) || sy !== electionYear(s)) m.specialYear = sy; keep(s, m);
  rebuildChambers(); regroup(); clearCaches();
  newsBoth(s, (real) => `${s.govs?.[m.st] ? `Governor ${pname(s.govs[m.st], real)}` : `The governor of ${m.st}`} appoints ${nameOf(m, real)} (${m.p}) to the Senate seat${was ? ` left by ${pname(was, real)}` : ""}${flipped ? `, flipping it to ${m.p === "D" ? "Democrats" : "Republicans"}` : ""}. A special election follows in ${m.specialYear || electionYear(s)}.`, flipped ? "event" : "");
}
function specialElection(s, m, r) {
  const was = m.vacant.was, out = PP === "D" ? "R" : "D";
  const margin = houseLean(m) + s.mood * 0.9 + (out === "D" ? 4 : -4) + noise(`${s.seed}:sp:${m.id}:${s.week}`) * 6, winner = margin > 0 ? "D" : "R";
  newcomer(s, m, winner, gameYear(s) - 1); m.since = gameYear(s); keep(s, m); rebuildChambers(); regroup(); clearCaches();
  const c = ctrl();
  newsBoth(s, (real) => `Special election in ${m.seat}: ${nameOf(m, real)} (${winner}) wins by ${Math.abs(Math.round(margin * 10) / 10)} points${winner !== was.p ? `, flipping a seat ${was.p === "D" ? "Democrats" : "Republicans"} held` : ""}. The House is now ${c.H.D}-${c.H.R}.`, winner !== was.p ? "event" : "");
}
function partySwitch(s, r) {
  const pool = MEMBERS.filter((m) => m.ch && !m.vacant && m.id !== s.youId && !m.lead?.length && ((m.p === "D" && m.dem < 46 && m.x > -0.25) || (m.p === "R" && m.dem > 54 && m.x < 0.3)));
  const m = pool[Math.floor(r() * pool.length)]; if (!m) return;
  const before = ctrl(), old = m.p, nw = old === "D" ? "R" : "D";
  m.p = nw; m.x = Math.round((m.x * 0.6 + BASE_X[nw] * 0.25) * 1000) / 1000; for (const c of m.comm || []) c.role = c.title = ""; derive(m); m.fund = fundOf(m); keep(s, m);
  rebuildChambers(); regroup(); clearCaches();
  const after = ctrl(), ch = m.ch, flip = (before[ch].D > before[ch].R) !== (after[ch].D > after[ch].R);
  if (memberById[s.youId]?.p === old) s.rel[m.id] = clamp((s.rel[m.id] || 0) - 0.3, -1, 1);
  newsBoth(s, (real) => `${titleOf(m)} ${nameOf(m, real)} of ${m.st} switches parties, from ${old === "D" ? "Democrat" : "Republican"} to ${nw === "D" ? "Democrat" : "Republican"}: "My district hasn't changed. My party did."${flip ? ` Control of the ${ch === "H" ? "House" : "Senate"} changes hands.` : ""}`, "event");
  if (flip) flipTitles(ch, after[ch].D > after[ch].R ? "D" : "R");
}
function answerSenApt(s, m, choice) {
  const seat = memberById[m.seat]; if (!seat?.vacant || !seat.vacant.appoint) return;
  if (choice !== 0) { seat.vacant.appoint = s.week; return; }
  const you = memberById[s.youId], r = R(s, "apt"), odds = clamp(0.2 + s.clout / 200 + s.profile / 250 + s.loyalty * 0.02 + (s.govRel || 0) * 0.25, 0.08, 0.75);
  if (r() >= odds) { seat.vacant.appoint = s.week; s.toast = { title: "The governor goes another way", text: "A thank-you call, a promise to keep you in mind. The seat goes to someone else.", tone: "" }; return; }
  const rw = s.week - (s.termStart || 0), sy = rw < 70 ? electionYear(s) : electionYear(s) + 2, was = seat.vacant.was, sen = { dem: seat.dem, cls: seat.cls };
  // Your old House seat becomes the empty one, headed for a special election.
  const mine = { first: you.first, last: you.last, sf: you.sf, sl: you.sl, p: you.p, seat: you.seat, ch: "H", fictional: !!you.fictional };
  Object.assign(seat, { ch: "H", st: you.st, d: you.d, dem: you.dem, cls: undefined }); derive(seat);
  seat.vacant = { why: "was appointed to the Senate", since: s.week, was: mine, special: rw < 78 ? s.week + 16 : null }; keep(s, seat);
  Object.assign(you, { ch: "S", d: undefined, dem: sen.dem, cls: sen.cls, appointee: true }); if (sen.cls !== cycleClass(s.term) || sy !== electionYear(s)) you.specialYear = sy;
  you.comm = []; you.lead = []; derive(you); keep(s, you); s.role = "S"; s.opp = null; s.camp = null; s.pchal = null;
  rebuildChambers(); regroup(); clearCaches();
  newsBoth(s, (real) => `The governor of ${you.st} appoints ${nameOf(you, real)} to the Senate seat left by ${pname(was, real)}.`, "good");
  s.toast = { title: "Senator", text: `You're appointed to the Senate. You'll have to win the seat in ${upThisTerm(s, you) ? electionYear(s) : you.specialYear || "the next election"}. Your House seat goes to a special election.`, tone: "good" };
}
export const STATE_NAME = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
// ════════ The Speaker: the floor vote, motions to vacate, and running for the top job ════════
// Each new House elects its Speaker on the floor. The majority's nominee needs a majority of members voting for a person;
// with a thin majority a handful of holdouts can force ballot after ballot, and the price of ending it is usually a
// rule that lets a single member force a vote to remove the Speaker (2023). Under the 2025 rules it takes nine.
const isSpeaker = (m) => /^Speaker of the House/.test(m.lead?.[0] || "");
function topOf(p) { return HOUSE.filter((m) => m.p === p).sort((a, b) => (isSpeaker(b) ? 3 : /Leader/.test(b.lead?.[0] || "") && !/Assistant|Former|Running/.test(b.lead[0]) ? 2 : /Whip/.test(b.lead?.[0] || "") ? 1 : 0) - (isSpeaker(a) ? 3 : /Leader/.test(a.lead?.[0] || "") && !/Assistant|Former|Running/.test(a.lead[0]) ? 2 : /Whip/.test(a.lead?.[0] || "") ? 1 : 0) || b.seniority - a.seniority)[0]; }
// Members likely to hold out: the far flank, the grudge-holders and the showhorses, the less loyal.
function holdoutOdds(m, maj) { const flank = maj === "D" ? m.x < -0.72 : m.x > 0.72; return clamp((flank ? 0.22 : 0.02) + (["grudge", "showhorse", "believer"].includes(m.t.label) ? 0.1 : 0) + (0.4 - m.t.loyalty) * 0.25, 0, 0.6); }
function seatSpeaker(s, m, ballots, conc) {
  for (const x of HOUSE) if (isSpeaker(x) && x !== m) { x.lead = x.p === m.p ? [] : x.lead; derive(x); keep(s, x); }
  m.lead = ["Speaker of the House"]; derive(m); keep(s, m);
  s.spk = { id: m.id, ballots, conc, bar: conc ? 1 : 9, anger: 0, since: s.week };
  clearCaches();
}
function speakerVote(s, r, nominee, why = "new") {
  const maj = nominee.p, min = maj === "D" ? "R" : "D", you = memberById[s.youId];
  const ours = HOUSE.filter((m) => m.p === maj), theirs = HOUSE.filter((m) => m.p === min).length;
  const spare = ours.length - Math.floor(HOUSE.length / 2) - 1;
  const mine = (s.spkVote?.choice ?? 0);                      // 0 nominee, 1 someone else, 2 present
  // Holdouts only bother when they can matter.
  let rebels = ours.filter((m) => m !== nominee && m.id !== s.youId && r() < holdoutOdds(m, maj) * (spare < 12 ? 1 : 0.15));
  if (you && you.ch === "H" && you.p === maj && you.id !== nominee.id && mine) rebels.push(you);
  let ballots = 0, conc = 0, present = 0;
  for (ballots = 1; ballots <= 15; ballots++) {
    present = rebels.filter((m, i) => i % 5 === 4 || (m === you && mine === 2)).length;
    const voting = HOUSE.length - present, need = Math.floor(voting / 2) + 1, yes = ours.length - rebels.length;
    if (yes >= need) break;
    // Each failed ballot, some holdouts take a deal.
    if (ballots >= 3) conc = 1;
    rebels = rebels.filter((m) => (m === you ? ballots < 3 : r() > 0.18 + ballots * 0.03));      // you hold out two ballots, then take the deal
  }
  if (ballots > 15) {   // the nominee withdraws; the conference turns to its next leader, who wins with the holdouts' blessing
    const alt = ours.filter((m) => m !== nominee && m.id !== s.youId).sort((a, b) => (b.lead?.length ? 1 : 0) - (a.lead?.length ? 1 : 0) || b.seniority - a.seniority)[0];
    newsBoth(s, (real) => `After fifteen failed ballots, ${nameOf(nominee, real)} withdraws from the race for Speaker.`, "bad");
    nominee = alt; ballots = 16; conc = 1; rebels = [];
  }
  const yes = ours.length - rebels.length;
  seatSpeaker(s, nominee, ballots, conc);
  newsBoth(s, (real) => `${nameOf(nominee, real)} is elected Speaker${ballots === 1 ? " on the first ballot" : ` on the ${ord(ballots)} ballot`}, with ${yes} votes to ${theirs} for the ${min === "D" ? "Democratic" : "Republican"} leader${present ? ` and ${present} present` : ""}.${conc ? " The price: any single member can now force a vote to remove the Speaker." : ""}`, ballots > 3 ? "event" : "");
  if (you?.ch === "H") {
    if (nominee.id === s.youId) { s.clout += 12; s.profile = clamp(s.profile + 15, 0, 100); s.toast = { title: "Speaker of the House", text: `You have the gavel${ballots > 1 ? `, after ${ballots} ballots` : ""}. Second in line to the presidency. Now hold your conference together.`, tone: "good" }; }
    else if (you.p === maj && mine && ballots > 1) { s.clout += 3; s.loyalty -= 3; s.rel[nominee.id] = clamp((s.rel[nominee.id] || 0) - 0.3, -1, 1); s.toast = { title: "You held out", text: `It took ${ballots} ballots. You extracted a promise or two, and the Speaker will not forget who made it hard.`, tone: "" }; }
    else if (you.p === maj && mine) { s.loyalty -= 2; s.rel[nominee.id] = clamp((s.rel[nominee.id] || 0) - 0.2, -1, 1); }
  }
  s.spkVote = null;
}
function speakerWeek(s, r) {
  const rw = s.week - (s.termStart || 0), you = memberById[s.youId];
  // The opening vote of a new House.
  if (rw === 1 && !(s.spk && s.spk.term === s.term)) {
    const maj = houseMaj(), nom = (isSpeaker(you || {}) && you.p === maj) ? you : HOUSE.find((m) => m.p === maj && isSpeaker(m)) || topOf(maj);
    if (nom) { speakerVote(s, r, nom, "new"); s.spk.term = s.term; }
  }
  const sp = s.spk && memberById[s.spk.id]; if (!sp || !isSpeaker(sp)) return;
  s.spk.anger = (s.spk.anger || 0) * 0.97;
  // A motion to vacate, called last week, comes to a vote.
  if (s.vacate && s.week >= s.vacate.week) return vacateVote(s, r, sp);
  // A new Speaker race after an ouster.
  if (s.spkRace && s.week >= s.spkRace.week) { const maj = houseMaj(), runner = s.spkRace.you ? you : null;
    let nom = topOf(maj); if (nom === sp || !nom) nom = HOUSE.filter((m) => m.p === maj && m !== sp).sort((a, b) => b.seniority - a.seniority)[0];
    if (runner) { const party = HOUSE.filter((m) => m.p === maj && m.id !== you.id), avgRel = party.reduce((a, m) => a + (s.rel[m.id] || 0), 0) / party.length;
      const odds = clamp(0.05 + s.clout / 250 + (you.seniority || 0) * 0.01 + avgRel * 3 + s.loyalty * 0.015 + (s.profile - 40) / 400, 0.03, 0.6);
      if (r() < odds) nom = you; else s.toast = { title: "The conference picks someone else", text: "You made your case behind closed doors. The votes went elsewhere.", tone: "" }; }
    s.spkRace = null; speakerVote(s, r, nom, "after"); return; }
  if (s.vacate || s.spkRace) return;
  if (rw < 8 || rw > 86 || sp.id === s.youId && false) return;
  const maj = sp.p, spare = HOUSE.filter((m) => m.p === maj).length - Math.floor(HOUSE.length / 2) - 1;
  if (spare > 12) return;
  if (r() < 0.0022 * (s.spk.bar === 1 ? 2.5 : 1) * (1 + s.spk.anger)) {
    const mover = HOUSE.filter((m) => m.p === maj && m !== sp && m.id !== s.youId).sort((a, b) => holdoutOdds(b, maj) - holdoutOdds(a, maj))[Math.floor(r() * 4)];
    if (!mover) return;
    s.vacate = { week: s.week + 1, mover: mover.id };
    newsBoth(s, (real) => `${titleOf(mover)} ${nameOf(mover, real)} files a motion to vacate the chair, forcing a vote on removing Speaker ${nameOf(sp, real)}.`, "event");
    if (you?.ch === "H") pushInbox(s, { kind: "vacate", from: "The whip's office", choices: ["Vote to keep the Speaker", "Vote to remove the Speaker"], title: sp.id === s.youId ? "A motion to remove you" : `The vote on removing ${nameOf(sp)}`,
      body: sp.id === s.youId ? `${nameOf(mover)} wants your gavel. The vote is next week. Your own conference decides it, unless the other side bails you out.` : `${nameOf(mover)} wants the Speaker out. The vote is next week. If it passes, the House stops until a new Speaker is elected.${you.p === maj ? " Leadership is counting on you." : " Your leaders are deciding whether to save the Speaker or let them fall."}` });
  }
}
function vacateVote(s, r, sp) {
  const v = s.vacate; s.vacate = null; const maj = sp.p, you = memberById[s.youId];
  const msg = s.inbox.find((m) => m.kind === "vacate" && !m.done) || s.inbox.find((m) => m.kind === "vacate" && m.week === s.week - 1);
  const yourYes = msg?.done ? msg.choice === 1 : false; if (msg && !msg.done) { msg.done = true; msg.choice = 0; }
  const rebels = HOUSE.filter((m) => m.p === maj && m !== sp && m.id !== s.youId && r() < holdoutOdds(m, maj) * 0.8).length + 1;
  const saveP = 0.25 + 0.45 * Math.min(1, (s.spk.anger || 0) / 2);        // the minority saves a Speaker who made deals with them
  const saved = r() < saveP, minYes = saved ? 0 : HOUSE.filter((m) => m.p !== maj).length;
  const yes = rebels + minYes + (yourYes && you?.p === maj ? 1 : 0), no = HOUSE.length - yes;
  if (yes > no) {
    sp.lead = ["Former Speaker"]; derive(sp); keep(s, sp); s.spk = null; clearCaches();
    newsBoth(s, (real) => `The House votes ${yes}-${no} to remove Speaker ${nameOf(sp, real)}, the chair is empty, and the floor stops until a new Speaker is elected.`, "bad");
    s.houseFrozen = s.week + 3; s.spkRace = { week: s.week + 3, you: false };
    if (sp.id === s.youId) { s.clout -= 15; s.profile = clamp(s.profile + 5, 0, 100); s.toast = { title: "You lost the gavel", text: "Your own conference turned on you. You're a former Speaker now.", tone: "bad" }; }
    else if (you?.ch === "H" && you.p === maj) pushInbox(s, { kind: "spkrun", from: "Your chief of staff", choices: ["Run for Speaker", "Stay out of it"], title: "The gavel is up for grabs",
      body: "The conference meets in two weeks to pick a nominee. Members are already calling you. Running means owning a broken majority; winning means the most powerful job in Congress." });
  } else newsBoth(s, (real) => `${saved ? `With help from ${maj === "D" ? "Republicans" : "Democrats"}, ` : ""}Speaker ${nameOf(sp, real)} survives a motion to vacate, ${no}-${yes}.`, "event");
}
// Running for the top job in your caucus (Speaker if your party has the House, leader otherwise).
function speakerBallot(s, you) {
  if (you?.ch !== "H") return; const maj = houseMaj(); if (you.p !== maj || isSpeaker(you)) return;
  const nom = HOUSE.find((m) => m.p === maj && isSpeaker(m)) || topOf(maj); if (!nom || nom.id === you.id) return;
  pushInbox(s, { kind: "spkvote", from: "The whip's office", choices: [`Vote for ${nameOf(nom)}`, "Vote for someone else", "Vote present"], title: "The vote for Speaker is the first thing the new House does",
    body: `${nameOf(nom)} is your party's nominee. With ${HOUSE.filter((m) => m.p === maj).length} members in your majority, ${HOUSE.filter((m) => m.p === maj).length - 218 < 10 ? "a handful of holdouts can drag this out for days, and holdouts get concessions" : "the votes are there unless something strange happens"}. Voting for someone else is a statement; leadership keeps a list.` });
}
function topRace(s) {
  const you = memberById[s.youId], r = R(s, "top"), ms = you.ch === "H" ? HOUSE : SENATE, maj = (you.ch === "H" ? houseMaj() : SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R");
  const party = ms.filter((m) => m.p === you.p && m.id !== you.id), avgRel = party.reduce((a, m) => a + (s.rel[m.id] || 0), 0) / party.length;
  const odds = clamp(0.02 + s.clout / 260 + (you.seniority || 0) * 0.012 + avgRel * 3 + s.loyalty * 0.02 + (s.profile - 40) / 400 + ((you.lead || []).some((t) => /Whip/.test(t)) ? 0.12 : 0), 0.02, 0.55);
  const title = you.ch === "H" ? (you.p === maj ? "Speaker of the House" : "House Minority Leader") : `Senate ${you.p === maj ? "Majority" : "Minority"} Leader`;
  if (r() >= odds) { s.clout -= 3; s.loyalty -= 2; s.toast = { title: "You came up short", text: "Your caucus stuck with the leader it has. They know you tried.", tone: "bad" }; return; }
  const old = party.find((m) => (m.lead || []).some((t) => (you.ch === "H" ? /^Speaker|Minority Leader|Republican Leader|Democratic Leader/ : /Senate (Majority|Minority) Leader/).test(t)));
  if (old) { old.lead = []; derive(old); keep(s, old); s.rel[old.id] = clamp((s.rel[old.id] || 0) - 0.5, -1, 1); }
  you.lead = [title]; derive(you); keep(s, you); clearCaches();
  if (title === "Speaker of the House") { s.toast = { title: "Your conference nominates you for Speaker", text: "Now you need the votes on the floor, from your own side.", tone: "good" }; pushNews(s, `${nameOf(you)} wins the ${you.p === "D" ? "Democratic" : "Republican"} nomination for Speaker${old ? `, ousting ${nameOf(old)}` : ""}.`, "good"); }
  else { s.clout += 20; s.profile = clamp(s.profile + 12, 0, 100); s.toast = { title, text: "You lead your party now. Every deal goes through you.", tone: "good" }; pushNews(s, `${nameOf(you)} is elected ${title}${old ? `, replacing ${nameOf(old)}` : ""}.`, "good"); }
}

// ════════ Governors ════════
// After the 2026 elections (AP calls through Nov 10, 2026). Alaska and Kansas were still uncalled; they show the candidate leading.
// first, last, party, gender, year of the next election, flags: tl = term-limited at the next election, lead = race not yet called.
const GOVS0 = { AL: ["Tommy", "Tuberville", "R", "M", 2030], AK: ["Jonathan", "Kreiss-Tomkins", "D", "M", 2030, "lead"], AZ: ["Katie", "Hobbs", "D", "F", 2030, "tl"], AR: ["Sarah Huckabee", "Sanders", "R", "F", 2030, "tl"],
  CA: ["Xavier", "Becerra", "D", "M", 2030], CO: ["Phil", "Weiser", "D", "M", 2030], CT: ["Ned", "Lamont", "D", "M", 2030], DE: ["Matt", "Meyer", "D", "M", 2028], FL: ["Byron", "Donalds", "R", "M", 2030],
  GA: ["Keisha Lance", "Bottoms", "D", "F", 2030], HI: ["Josh", "Green", "D", "M", 2030, "tl"], ID: ["Brad", "Little", "R", "M", 2030], IL: ["JB", "Pritzker", "D", "M", 2030], IN: ["Mike", "Braun", "R", "M", 2028],
  IA: ["Rob", "Sand", "D", "M", 2030], KS: ["Cindy", "Holscher", "D", "F", 2030, "lead"], KY: ["Andy", "Beshear", "D", "M", 2027, "tl"], LA: ["Jeff", "Landry", "R", "M", 2027], ME: ["Hannah", "Pingree", "D", "F", 2030],
  MD: ["Wes", "Moore", "D", "M", 2030, "tl"], MA: ["Maura", "Healey", "D", "F", 2030], MI: ["Jocelyn", "Benson", "D", "F", 2030], MN: ["Amy", "Klobuchar", "D", "F", 2030], MS: ["Tate", "Reeves", "R", "M", 2027, "tl"],
  MO: ["Mike", "Kehoe", "R", "M", 2028], MT: ["Greg", "Gianforte", "R", "M", 2028, "tl"], NE: ["Jim", "Pillen", "R", "M", 2030, "tl"], NV: ["Aaron", "Ford", "D", "M", 2030], NH: ["Kelly", "Ayotte", "R", "F", 2028],
  NJ: ["Mikie", "Sherrill", "D", "F", 2029], NM: ["Deb", "Haaland", "D", "F", 2030], NY: ["Kathy", "Hochul", "D", "F", 2030], NC: ["Josh", "Stein", "D", "M", 2028], ND: ["Kelly", "Armstrong", "R", "M", 2028],
  OH: ["Amy", "Acton", "D", "F", 2030], OK: ["Mike", "Mazzei", "R", "M", 2030], OR: ["Tina", "Kotek", "D", "F", 2030, "tl"], PA: ["Josh", "Shapiro", "D", "M", 2030, "tl"], RI: ["Helena", "Foulkes", "D", "F", 2030],
  SC: ["Alan", "Wilson", "R", "M", 2030], SD: ["Larry", "Rhoden", "R", "M", 2030], TN: ["Marsha", "Blackburn", "R", "F", 2030], TX: ["Gina", "Hinojosa", "D", "F", 2030], UT: ["Spencer", "Cox", "R", "M", 2028],
  VT: ["Phil", "Scott", "R", "M", 2028], VA: ["Abigail", "Spanberger", "D", "F", 2029, "tl"], WA: ["Bob", "Ferguson", "D", "M", 2028], WV: ["Patrick", "Morrisey", "R", "M", 2028], WI: ["David", "Crowley", "D", "M", 2030],
  WY: ["Eric", "Barlow", "R", "M", 2030] };
const TWO_YEAR = new Set(["VT", "NH"]);
// Term limits: none in these states, one term at a time in Virginia, two in a row (or two for life) everywhere else.
const GOV_NOLIMIT = new Set(["CT", "ID", "IL", "IA", "MA", "MN", "NY", "TX", "UT", "VT", "WA", "WI", "NH"]);
export const govLimit = (st) => (GOV_NOLIMIT.has(st) ? 0 : st === "VA" ? 1 : 2);
// Terms already served by the governor in office in January 2027 (counting the one that begins).
const GOV_TERMS0 = { AZ: 2, AR: 2, HI: 2, MD: 2, NE: 2, OR: 2, PA: 2, KY: 2, MS: 2, MT: 2, CT: 3, IL: 3, ID: 3, NY: 2, MA: 2, UT: 2, VT: 6, NH: 2 };
// States whose law makes the governor appoint a senator from the departing senator's party.
const SAME_PARTY_APPT = new Set(["AZ", "HI", "KY", "MD", "NC", "UT", "WV", "WY"]);
function govSeed(s) { if (s.govs) return; s.govs = {}; for (const [st, [first, last, p, g, next, flag]] of Object.entries(GOVS0)) { const [sf, sl] = swapPair(first.split(" ")[0], last); const terms = GOV_TERMS0[st] || 1; s.govs[st] = { first, last, sf: first.includes(" ") ? `${sf} ${first.split(" ").slice(1).join(" ")}` : sf, sl, p, g, next, terms, tl: govLimit(st) > 0 && terms >= govLimit(st), lead: flag === "lead", real: true }; } }
export const govOf = (s, st) => s.govs?.[st] || null;
export const govParty = (s, st) => s.govs?.[st]?.p || ((LEAN[st] ?? 0) >= 0 ? "D" : "R");
// One governor's race. The party out of the White House usually gains; incumbents run a few points ahead.
function govRace(s, st, year, youRun = null) {
  const g = s.govs[st], inc = !g.tl && (!youRun || g.you) && noise(`${s.seed}:govret:${st}:${year}`) > -0.8 ? g : null, r = rng(hash(`${s.seed}:gov:${st}:${year}`));
  const midterm = year % 4 === 2 || year % 2 === 1, outP = PP === "D" ? "R" : "D";
  let m = (LEAN[st] ?? 0) * 0.85 + s.mood * 0.6 + (midterm ? (outP === "D" ? 2 : -2) : 0) + (inc ? (inc.p === "D" ? 5 : -5) : 0) + noise(`${s.seed}:govm:${st}:${year}`) * 8;
  if (youRun) m += (youRun.p === "D" ? 1 : -1) * youRun.edge;
  if (youRun && g.you && inc) inc.you = true;
  const w = m > 0 ? "D" : "R", next = year + (TWO_YEAR.has(st) ? 2 : 4);
  const was = { ...g };
  const lim = govLimit(st);
  if (youRun && w === youRun.p) { const t = g.you ? (g.terms || 1) + 1 : 1; s.govs[st] = { first: youRun.first, last: youRun.last, sf: youRun.sf, sl: youRun.sl, p: w, g: youRun.g, next, terms: t, tl: lim > 0 && t >= lim, real: !youRun.fictional, you: true }; }
  else if (inc && w === inc.p) { const t = (g.terms || 1) + 1; s.govs[st] = { ...g, next, terms: t, tl: lim > 0 && t >= lim, lead: false }; }
  else { const first = PF[Math.floor(r() * PF.length)], last = PL[Math.floor(r() * PL.length)]; s.govs[st] = { first, last, sf: first, sl: last, p: w, g: r() < 0.45 ? "F" : "M", next, terms: 1, tl: lim === 1, real: false }; }
  return { st, was, now: s.govs[st], margin: Math.round(m * 10) / 10, flip: w !== was.p, held: inc && w === inc.p };
}
// Even-year races run on election night; Kentucky, Louisiana and Mississippi vote in odd years (and New Jersey and Virginia).
function govElections(s, year, youRun) {
  govSeed(s); const out = [];
  for (const st of Object.keys(s.govs)) if (s.govs[st].next === year) out.push(govRace(s, st, year, youRun && youRun.st === st ? youRun : null));
  s.lastGov = { year, races: out };
  return out;
}
function govWeek(s, r) {
  govSeed(s);
  const rw = s.week - (s.termStart || 0), you = memberById[s.youId];
  // Odd-year elections, the first Tuesday of November.
  if (rw === 44) { const y = gameYear(s); const res = govElections(s, y, null);
    for (const x of res) newsBoth(s, (real) => `Governor's race in ${STATE_NAME[x.st] || x.st}: ${pname(x.now, real)} (${x.now.p}) wins${x.flip ? `, flipping the state from ${x.was.p === "D" ? "Democrats" : "Republicans"}` : x.held ? ", a second term" : ""}.`, x.flip ? "event" : ""); }
  if (!isMem(roleOf(s)) || !you) return;
  // Your governor wants your vote.
  const g = s.govs[you.st]; if (!g || g.you) return;
  if (r() < 0.05) {
    const b = s.bills.find((x) => !x.dead && x.stage === "committee" && x.floorWeek - s.week >= 1 && x.floorWeek - s.week <= 3 && x.yourVote == null && !x.asked?.gov);
    if (b) { b.asked = b.asked || {}; b.asked.gov = true; const want = b.party === g.p;
      inboxBoth(s, { kind: "govask", bill: b.id, want, from: `Governor's office, ${you.st}`, choices: [want ? "Promise a yes" : "Promise a no", "Make no promises"] }, (real) => ({ title: `Governor ${pname(g, real)} on ${byId[b.pid].name}`,
        body: `${pname(g, real)} (${g.p}) calls about ${byId[b.pid].name}: "${want ? "This is good for our state. I need you with me." : "This would cost our state real money. I need you against it."}" ${g.p === you.p ? "A governor of your own party can help a lot: a phone bank, an endorsement, a word with the people who appoint senators." : "A governor of the other party can still praise you on local TV, and that plays well with swing voters."}` })); }
  }
}
function answerGov(s, m, choice) {
  const you = memberById[s.youId], g = s.govs?.[you.st]; if (!g) return;
  if (choice === 0) { s.govRel = clamp((s.govRel || 0) + 0.3, -1, 1); const b = s.bills.find((x) => x.id === m.bill); if (b) b.yourVote = m.want; s.toast = { title: "The governor is grateful", text: "You'll hear about it at your next event back home, and on local TV.", tone: "good" }; }
  else s.govRel = clamp((s.govRel || 0) - 0.15, -1, 1);
}
// States sue: when a law passes over the objection of the other party, its governors and attorneys general go to court.
function stateSuit(s, pid, party, r) {
  govSeed(s); const other = party === "D" ? "R" : "D", n = Object.values(s.govs).filter((g) => g.p === other).length;
  if (n < 10 || r() > 0.45 || !s.court || s.court.docket.some((k) => k.pid === pid && !k.done)) return;
  const y = gameYear(s), w = weekOfDate(s, y, 5, 26), when = w - s.week >= 16 ? w : weekOfDate(s, y + 1, 5, 26);
  s.court.docket.push({ id: `suit${pid}${s.week}`, name: `${n} states v. ${byId[pid].name}`, pid, kind: "law", week: when });
  pushNews(s, `${n} ${other === "D" ? "Democratic" : "Republican"}-led states sue to block ${byId[pid].name}. The case is headed for the Supreme Court.`, "event");
}
// Running for governor of your state.
function govNews(s, races) {
  if (!races?.length) return; const flips = races.filter((x) => x.flip), d = Object.values(s.govs).filter((g) => g.p === "D").length;
  newsBoth(s, (real) => `Governors: ${races.length} races this year${flips.length ? `; ${flips.map((x) => `${x.st} flips to ${pname(x.now, real)} (${x.now.p})`).join(", ")}` : ", and no state changed parties"}. Democrats now hold ${d} governorships, Republicans ${50 - d}.`, flips.length ? "event" : "");
}
function govOffer(s, you) {
  govSeed(s); const g = s.govs[you.st]; if (!g || g.next !== electionYear(s) || s.runFor) return;
  inboxBoth(s, { kind: "govrun", from: "Your political director", choices: [`Run for governor in ${electionYear(s)}`, "Stay in Congress"] }, (real) => ({ title: `The governor's race in ${STATE_NAME[you.st] || you.st}`,
    body: `${g.tl ? `${pname(g, real)} is term-limited, so the seat is open.` : `${pname(g, real)} (${g.p}) holds it${g.p === you.p ? " and would have to step aside or be beaten in a primary" : " and is running again"}.`} Governors run things: budgets, agencies, the National Guard, and the appointment when a senator leaves. ${you.ch === "H" ? "Running means giving up your House seat." : upNow(s, you) ? "Your Senate seat is up the same year; you can't run for both." : "Your Senate seat isn't up, so you keep it if you lose."}` }));
}
function govGeneral(s, r) {
  electionNight(s);
  const you = memberById[s.youId], st = you.st, lean = (you.p === "D" ? 1 : -1) * (LEAN[st] ?? 0) / 2, env = you.p === "D" ? s.mood : -s.mood;
  const edge = (s.approval - 50) * 0.25 + (s.profile - 30) * 0.08 + Math.min(5, s.cash / 1000) + (s.debateBonus || 0) + (r() - 0.5) * 4;
  const res = govElections(s, electionYear(s), { ...you, edge }).find((x) => x.st === st);
  const won = res && res.now.you;
  const margin = Math.round(((res?.margin || 0) * (you.p === "D" ? 1 : -1)) * 10) / 10;
  s.govDone = true;
  if (won) { s.over = true; s.result = { kind: "gov", won: true, margin, st }; newsBoth(s, (real) => `${nameOf(you, real)} is elected governor of ${STATE_NAME[st] || st} by ${Math.abs(margin)} points.`, "good"); return; }
  newsBoth(s, (real) => `${nameOf(you, real)} loses the race for governor of ${STATE_NAME[st] || st} to ${pname(res.now, real)}.`, "bad");
  if (upNow(s, you)) { s.over = true; s.result = { kind: "gov", won: false, margin, st }; return; }
  termReview(s, r); s.result.govLost = { margin, winner: pname(res.now, false), winnerR: pname(res.now, true) }; s.runFor = null;
}

// ════════ Senate rules: the nuclear option and the Vice President's tie-breaking vote ════════
// The legislative filibuster stands until a majority votes to change the precedent. Institutionalists (senior members,
// moderates, dealmakers) are the holdouts. In a 50-50 Senate the Vice President breaks ties, so the White House's party
// organizes the chamber and can go nuclear with exactly 50.
export const senMaj = () => { const d = SENATE.filter((m) => m.p === "D").length, r = SENATE.filter((m) => m.p === "R").length; return d > r ? "D" : r > d ? "R" : PP; };
function nukeOdds(m) { return clamp(0.04 + ((m.seniority || 0) > 18 ? 0.18 : 0) + (Math.abs(m.x) < 0.3 ? 0.25 : 0) + (m.t.label === "dealmaker" ? 0.12 : 0), 0, 0.7); }
function scheduleNuke(s, by) {
  const maj = senMaj(), you = memberById[s.youId], lead = SENATE.find((m) => m.p === maj && /Majority Leader/.test(m.lead?.[0] || ""));
  s.nuke = { week: s.week + 2, by };
  newsBoth(s, (real) => `${lead ? `Senate Majority Leader ${nameOf(lead, real)}` : "The Senate majority"} moves to end the legislative filibuster${s.filStreak ? ` after ${s.filStreak} of the party's bills were blocked` : ""}. The vote is in two weeks.`, "event");
  if (you?.ch === "S") pushInbox(s, { kind: "nuke", from: you.p === maj ? "Your leader's office" : "Your leader's office", choices: ["Vote to end the filibuster", "Vote to keep it"], title: "The nuclear option",
    body: you.p === maj ? `Your party wants to pass bills with 51 votes instead of 60. Every vote counts: with ${SENATE.filter((m) => m.p === maj).length} members, a few institutionalists can sink it. Voting no protects the minority's power, which you'll want back someday.` : `The majority wants to end the filibuster. Your side can't stop it alone; the question is how many of theirs get cold feet. Voting yes would be a strange signal from the minority.` });
}
function nukeVote(s, r) {
  const maj = senMaj(), you = memberById[s.youId]; s.nuke = null;
  const msg = s.inbox.find((m) => m.kind === "nuke" && s.week - m.week <= 4); const yourYes = msg?.done ? msg.choice === 0 : you?.p === maj; if (msg && !msg.done) msg.done = true;
  let yes = 0; for (const m of SENATE) { if (m.id === s.youId) { if (yourYes) yes++; continue; } if (m.p === maj && r() >= nukeOdds(m)) yes++; }
  const vp = yes === 50 && PP === maj, ok = yes >= 51 || vp, vpC = s.cab?.find((c) => c.id === "vp");
  s.filStreak = 0;
  if (ok) { s.filOff = { since: s.week, by: maj }; newsBoth(s, (real) => `The Senate votes ${yes}${vp ? `-50, with Vice President ${vpC ? cabName(vpC, real) : ""} breaking the tie,` : `-${100 - yes}`} to end the legislative filibuster. Bills now pass with a simple majority.`, "event"); }
  else { s.nukeFailed = s.week; } if (!ok) newsBoth(s, (real) => `The move to end the filibuster fails, ${yes}-${100 - yes}. ${SENATE.filter((m) => m.p === maj).length - yes} ${maj === "D" ? "Democrats" : "Republicans"} wouldn't go along.`, "event");
  if (you?.ch === "S") { if (you.p === maj) { if (yourYes) { s.loyalty += 2; s.baseApproval = clamp(s.baseApproval + 1.5, 5, 99); } else { s.loyalty -= 3; s.integrity += 2; s.baseApproval = clamp(s.baseApproval - 2, 5, 99); } } else if (yourYes) { s.loyalty -= 2; s.integrity += 1; } }
  if (you?.ch === "S" && yourYes !== undefined) s.moments.push({ week: s.week, text: `You voted ${yourYes ? "to end" : "to keep"} the filibuster. It ${ok ? "ended" : "survived"}.` });
}
function rulesWeek(s, r) {
  if (s.filOff) return;
  if (s.nuke && s.week >= s.nuke.week) return nukeVote(s, r);
  const maj = senMaj(), n = SENATE.filter((m) => m.p === maj).length, rw = s.week - (s.termStart || 0);
  // A failed attempt costs leaders a lot; they wait most of a year and a longer list of blocked bills before trying again.
  const cool = s.nukeFailed && s.week - s.nukeFailed < 40, bar = s.nukeFailed ? 6 : 4;
  if (!s.nuke && !cool && (s.filStreak || 0) >= bar && n >= 50 && rw < 88 && r() < 0.1) scheduleNuke(s, "leader");
}

// ════════ A Cabinet offer ════════
const CAB_FOR = [[/Armed Services/, "defense"], [/Foreign/, "state"], [/Ways and Means|Finance|Banking|Budget/, "treasury"], [/Judiciary/, "ag"], [/Homeland/, "dhs"], [/Energy and Commerce|Health|HELP/, "hhs"],
  [/Veterans/, "va"], [/Transportation|Commerce, Science/, "dot"], [/Natural Resources|Energy and Natural/, "interior"], [/Education|Labor/, "labor"], [/Intelligence/, "dni"], [/Agriculture|Small Business/, "commerce"]];
function cabOffer(s, you) {
  if (!s.newPres || s.newPres.party !== you.p || s.newPres.year !== electionYear({ ...s, term: s.term - 1 }) || s.presRec?.you) return;
  const r = R(s, "cabofr"), rival = !!s.amb?.pr?.[you.p]?.c.some((c) => c.you);
  const odds = clamp(0.03 + s.clout / 400 + s.profile / 400 + (you.seniority || 0) * 0.004 + s.loyalty * 0.01 + (rival ? 0.3 : 0), 0.03, 0.5);
  if (r() >= odds) return;
  const posts = (you.comm || []).map((c) => CAB_FOR.find(([re]) => re.test(c.n))?.[1]).filter(Boolean);
  const id = posts[0] || ["commerce", "labor", "hud", "va"][Math.floor(r() * 4)], c = s.cab.find((x) => x.id === id); if (!c) return;
  inboxBoth(s, { kind: "caboffer", post: id, from: "The President's transition team", choices: [`Accept: ${c.post}`, "Stay in Congress"] }, (real) => ({ title: `The President wants you as ${c.post}`,
    body: `${pname(PRES_M, real)} is calling. ${rival ? "You ran against each other in the primaries; this is the olive branch. " : ""}The job is ${c.post}. Saying yes means a Senate confirmation fight and giving up your seat${you.ch === "S" ? " (the governor appoints your replacement)" : " (a special election fills it)"}. Saying no keeps you here, with a President who now owes you less.` }));
}
function cabConfirm(s, r) {
  const n = s.cabNom; if (!n || s.week < n.week) return; s.cabNom = null;
  const you = memberById[s.youId], c = s.cab.find((x) => x.id === n.post);
  // Your own party votes for you; the other side splits on how much they like you.
  const v = chamberVote(s, SENATE.filter((m) => m.id !== s.youId), (m) => (m.p === PP ? 0.97 : clamp(0.12 + (s.rel[m.id] || 0) * 0.6 + (s.integrity - 60) / 150 + (you.ch === "S" ? 0.12 : 0), 0, 0.85)), `cab${s.week}`);
  if (v.yes >= 50) {
    newsBoth(s, (real) => `The Senate confirms ${nameOf(you, real)} as ${c.post}, ${v.yes}-${v.no}.`, "good");
    enterCabinet(s, n.post); s.toast = { title: `${c.post}`, text: `Confirmed ${v.yes}-${v.no}. You resign your seat and cross Pennsylvania Avenue.`, tone: "good" };
  } else { s.clout -= 6; s.toast = { title: "The Senate says no", text: `${v.yes}-${v.no}. You keep your seat, and everyone saw you try to leave it.`, tone: "bad" }; s.approval = clamp(s.approval - 2, 5, 95);
    newsBoth(s, (real) => `The Senate rejects ${nameOf(you, real)} for ${c.post}, ${v.yes}-${v.no}.`, "bad"); }
}

// ════════ Getting older ════════
export const yourAge = (s) => { const y = memberById[s.youId]; return y?.born ? gameYear(s) - y.born : 0; };
function agingWeek(s, r) {
  if (roleOf(s) === "P") return;
  const age = yourAge(s), you = memberById[s.youId];
  if (age >= 72 && r() < 0.0006 * (age - 70)) {
    s.hours = Math.max(0, s.hours - 15); s.approval = clamp(s.approval - 1.5, 5, 95); s.healthScares = (s.healthScares || 0) + 1;
    newsBoth(s, (real) => `${titleOf(you)} ${nameOf(you, real)}, ${age}, takes several days off after a health scare.${s.healthScares > 1 ? " Questions about the future are getting louder." : ""}`, "event");
    pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: "Take the week", body: `Doctor's orders: fewer hours this week. ${s.healthScares > 1 ? "The press is asking whether you'll run again, and some colleagues are quietly asking too." : "The staff has it covered. The story should pass."}` });
  }
  if (age >= 80) s.baseApproval = clamp(s.baseApproval - 0.02 * (age - 79), 5, 99);
}
function lastTermAsk(s, you) {
  const age = (gameYear(s) || 2027) - (you.born || 1970); if (age < 75 || !upNow(s, you)) return;
  pushInbox(s, { kind: "lastterm", from: "Your family", choices: ["Run again", "Make this my last term"], title: "The question everyone is asking",
    body: `You're ${age}. ${s.healthScares ? `You've had ${s.healthScares === 1 ? "a health scare" : `${s.healthScares} health scares`}. ` : ""}Your staff, your family and the reporters back home all want to know if you're running again. Announcing now lets your party recruit a successor and lets you finish on your own terms. Running again means a younger challenger will make your age the issue.` });
}

// ════════ Oversight with teeth: investigations, subpoenas and contempt ════════
// The party out of the White House investigates it. With a majority in the chamber, a committee can subpoena; without one,
// it can only write letters and hold press conferences. An administration that stonewalls risks contempt and a court fight.
const STAGE_NAME = { docs: "Document requests", subpoena: "Subpoena issued", contempt: "Contempt vote", hearing: "Public hearing", report: "Writing the report", done: "Closed" };
export const probeStage = (p) => STAGE_NAME[p.stage] || p.stage;
function openProbe(s, c, by, chamber) {
  (s.probes = s.probes || []).push({ id: `pr${s.week}${c.id}`, cab: c.id, by, ch: chamber, stage: "docs", next: s.week + 3, power: (chamber === "H" ? houseMaj() : senMaj()) !== PP });
}
function probeWeek(s, r) {
  const you = memberById[s.youId], role = roleOf(s);
  // The opposition's committees open investigations on their own.
  if (houseMaj() !== PP && r() < 0.05 && (s.probes || []).filter((p) => p.stage !== "done").length < 3) {
    const c = s.cab.filter((x) => !x.vacant && x.id !== "vp" && !(s.probes || []).some((p) => p.cab === x.id && p.stage !== "done")).sort((a, b) => b.heat - a.heat)[0];
    const chair = HOUSE.find((m) => m.p !== PP && (m.comm || []).some((k) => /Oversight/.test(k.n) && k.role === "Chair"));
    if (c) { openProbe(s, c, chair?.id || "comm", "H"); newsBoth(s, (real) => `${chair ? `Oversight Chair ${nameOf(chair, real)}` : "House Oversight"} opens an investigation into ${c.post} ${cabName(c, real)}.`, "event"); }
  }
  for (const p of s.probes || []) {
    if (p.stage === "done" || s.week < p.next) continue;
    const c = s.cab.find((x) => x.id === p.cab); if (!c || c.vacant) { p.stage = "done"; continue; }
    const mine = p.by === s.youId, who = (real) => `${c.post} ${cabName(c, real)}`;
    if (p.stage === "docs") {
      if (role === "P" || (role === "C" && c.you)) { pushInbox(s, { kind: "probedefy", probe: p.id, from: role === "C" ? "Your general counsel" : "White House Counsel", choices: ["Hand over the documents", "Claim executive privilege"], title: `Congress wants ${c.short} documents`,
          body: `House investigators want records from ${who(false)}. Complying feeds their story but ends the fight. Claiming privilege rallies your base and invites a subpoena, a contempt vote and a court case.` }); p.stage = "await"; p.next = s.week + 2; continue; }
      const stonewall = r() < 0.35 + c.loyal * 0.3;
      if (!stonewall) { p.stage = "hearing"; p.next = s.week + 3; newsBoth(s, (real) => `The administration turns over documents on ${who(real)} to congressional investigators.`); if (mine) pushScene(s, "hearing", { cab: c.id, mine: true }, `Your investigation's hearing: ${c.post} ${cabName(c)}`, "Committee staff"); }
      else if (p.power) { p.stage = "subpoena"; p.next = s.week + 3; newsBoth(s, (real) => `The administration refuses to turn over records. Investigators subpoena ${who(real)}.`, "event"); }
      else { p.stage = "report"; p.next = s.week + 4; newsBoth(s, (real) => `The administration ignores the minority's letters about ${who(real)}. Without subpoena power, all they can do is publish what they have.`); }
      continue;
    }
    if (p.stage === "await") { p.stage = "subpoena"; p.next = s.week + 2; continue; }        // the President never answered: treated as privilege
    if (p.stage === "subpoena") {
      if (r() < 0.5 || p.defied) { p.stage = "contempt"; p.next = s.week + 2; newsBoth(s, (real) => `${who(real)} defies a congressional subpoena.`, "event"); }
      else { p.stage = "hearing"; p.next = s.week + 3; newsBoth(s, (real) => `${who(real)} agrees to testify under subpoena.`); if (mine) pushScene(s, "hearing", { cab: c.id, mine: true }, `Your investigation's hearing: ${c.post} ${cabName(c)}`, "Committee staff"); }
      continue;
    }
    if (p.stage === "contempt") {
      const ms = p.ch === "H" ? HOUSE : SENATE, opp = PP === "D" ? "R" : "D";
      const v = chamberVote(s, ms, (m) => (m.p === opp ? 0.96 : 0.03), `cont${p.id}`, you?.ch === p.ch ? { [s.youId]: you.p === opp } : null);
      const need = Math.floor(ms.length / 2) + 1;
      if (v.yes >= need) { c.heat = clamp(c.heat + 0.12, 0, 1); s.presHeat = clamp(s.presHeat + 0.03, 0, 1);
        newsBoth(s, (real) => `The ${p.ch === "H" ? "House" : "Senate"} holds ${who(real)} in contempt of Congress, ${v.yes}-${v.no}. The administration's Justice Department declines to prosecute; the case goes to court.`, "event");
      }
      else newsBoth(s, (real) => `A contempt vote against ${who(real)} fails, ${v.yes}-${v.no}.`);
      p.stage = "report"; p.next = s.week + 4; continue;
    }
    if (p.stage === "hearing") { c.heat = clamp(c.heat + 0.06, 0, 1); p.stage = "report"; p.next = s.week + 4; continue; }
    if (p.stage === "report") {
      const bump = (p.power ? 0.08 : 0.04) + r() * 0.06; c.heat = clamp(c.heat + bump, 0, 1); p.stage = "done";
      newsBoth(s, (real) => `${p.power ? "Investigators" : "The committee minority"} release${p.power ? "" : "s"} a report on ${who(real)}${c.heat > 0.7 ? ", and calls for resignation grow" : ""}.`, c.heat > 0.7 ? "event" : "");
      if (mine) { s.profile = clamp(s.profile + (p.power ? 5 : 3), 0, 100); s.baseApproval = clamp(s.baseApproval + 2, 5, 99); s.rapport = clamp(s.rapport - 0.15, -1, 1); s.legis += 2;
        s.toast = { title: "Your report is out", text: `It lands on every front page for a day. ${c.short} heat: ${Math.round(c.heat * 100)}.`, tone: "good" }; }
      if (role === "P") s.presApproval = clamp(s.presApproval - 0.6, 20, 70);
    }
  }
}
function answerProbe(s, m, choice) {
  const p = (s.probes || []).find((x) => x.id === m.probe); if (!p) return;
  const c = s.cab.find((x) => x.id === p.cab);
  if (choice === 0) { p.stage = "hearing"; p.next = s.week + 3; if (c) c.heat = clamp(c.heat + 0.04, 0, 1); s.toast = { title: "Documents delivered", text: "The story runs, then fades. No subpoena, no contempt fight.", tone: "" }; }
  else { p.stage = p.power ? "subpoena" : "report"; p.defied = true; p.next = s.week + 2; s.baseApproval = clamp(s.baseApproval + 1, 5, 99); s.presHeat = clamp(s.presHeat + 0.04, 0, 1); s.toast = { title: "Executive privilege", text: p.power ? "Your base cheers. The committee is drafting a subpoena." : "The minority can't do much about it.", tone: "" }; }
}

// ════════ Serving in the Cabinet ════════
// You run a department: push its agenda in Congress, write rules, travel, keep scandal away, and keep the President's trust.
// You serve at the President's pleasure: lose their trust or let a scandal boil over and you're out. You stay through the
// midterms; after a presidential election you stay only if your party keeps the White House and the President keeps you.
export const isMem = (role) => role === "H" || role === "S";
export const CAB_M = { id: "CAB", first: "", last: "", sf: "", sl: "", p: "D", x: 0, born: 1970, g: "M", seat: "", own: 50, dem: 50, vuln: 0.5, prisk: 0.1, seniority: 0, base: { influence: 60, cash: 0 }, comm: [], lead: [], t: { ambition: 0.6, loyalty: 0.6, ego: 0.5, ethics: 0.6, deal: 0.5, label: "dealmaker" }, cabTitle: "Secretary" };
memberById.CAB = CAB_M;
function applyCab(s) { const C = s?.cabCareer; if (!C) return; const c = (s.cab || []).find((x) => x.id === C.post); Object.assign(CAB_M, C.me, { id: "CAB", seat: c?.post || "the Cabinet", cabTitle: (c?.post || "Secretary").replace(/ of .*/, "").replace("U.S. ", "") }); }
export const cabPost = (s) => (s.cabCareer ? s.cab.find((c) => c.id === s.cabCareer.post) : null);
function enterCabinet(s, post) {
  const you = memberById[s.youId], c = s.cab.find((x) => x.id === post), year = gameYear(s);
  const me = { first: you.first, last: you.last, sf: you.sf, sl: you.sl, p: you.p, x: you.x, born: you.born, g: you.g, look: you.look, st: you.st, t: you.t, fictional: !!you.fictional, custom: !!you.custom, from: you.ch === "S" ? `senator from ${you.st}` : `representative for ${you.seat}` };
  // Your old seat: a special election for the House, an appointment for the Senate.
  const was = { first: you.first, last: you.last, sf: you.sf, sl: you.sl, p: you.p, seat: you.seat, ch: you.ch, fictional: !!you.fictional };
  you.vacant = you.ch === "H" ? { why: "joined the Cabinet", since: s.week, was, special: s.week + 16 } : { why: "joined the Cabinet", since: s.week, was, appoint: s.week + 1 };
  keep(s, you); rebuildChambers(); clearCaches();
  Object.assign(c, { first: me.first, last: me.last, sf: me.sf, sl: me.sl, born: me.born, tone: me.look?.skin, vacant: false, heat: 0.12, loyal: 0.8, you: true, note: `Confirmed ${fmtDate(s.week)}. Formerly ${me.from}.` });
  s.cabCareer = { post, me, since: s.week, trust: 0.55, rules: [], wins: 0 };
  s.youId = "CAB"; s.role = "C"; applyCab(s);
  s.opp = null; s.camp = null; s.pchal = null; s.runFor = null; s.lastTerm = false; s.cabNom = null; s.youPres = null; s.polls = [];
  s.approval = 50; s.baseApproval = 70; s.profile = clamp(s.profile + 10, 0, 100); s.clout = clamp(s.clout + 5, 0, 100);
  for (const b of s.bills) b.yourVote = null;
  const area = (c.area || []).map((id) => byId[id]?.name).filter(Boolean);
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: `Welcome to the ${c.short || "department"}`,
    body: `You run ${c.post.replace(/^Secretary of (the )?/, "the Department of ").replace("Department of State", "the State Department")} now: thousands of employees, a budget bigger than most countries', and a President who can fire you with a post. ${area.length ? `Your fights: ${area.slice(0, 4).join(", ")}.` : ""} Lobby Congress for your agenda, write rules, get out of Washington, and keep scandal away from the building. Most of all, keep the President's trust.` });
}
const PRES_ASKS = [
  ["defend a policy you privately think is a mistake, on Sunday television", 0.15, -4, 0.04],
  ["slow-walk a rule Congress ordered your department to write", 0.18, -6, 0.07],
  ["fire a career official the President thinks leaked to the press", 0.2, -7, 0.08],
  ["headline a political rally in a swing state, on the taxpayers' dime", 0.12, -5, 0.06],
  ["steer a big grant to a state with a friendly governor", 0.15, -6, 0.07],
  ["say publicly that the economy is stronger than your own numbers show", 0.1, -3, 0.03],
];
function cabWeek(s, r) {
  const C = s.cabCareer, c = cabPost(s); if (!C || !c) return;
  C.trust = clamp(C.trust + (0.3 - C.trust) * 0.025 + (s.presApproval - 42) / 3000 - (c.heat - 0.4) / 300, -1, 1);   // trust has to be re-earned
  if (r() < 0.04) { const [what, tr, integ, heat] = PRES_ASKS[Math.floor(r() * PRES_ASKS.length)];
    pushInbox(s, { kind: "presask", tr, integ, heat, from: "The Oval Office", choices: ["Do it", "Push back privately", "Refuse, on the record"], title: `The President wants you to ${what}`,
      body: "It's not a request. Doing it buys trust and costs you something you can't see yet. Pushing back privately is how most Cabinet officers survive. Refusing in public makes you a hero to some and a target to the President." }); }
  // Opposition hearings: you're the witness now.
  const hostile = houseMaj() !== PP || senMaj() !== PP;
  if (hostile && r() < 0.03) pushInbox(s, { kind: "testify", from: "Legislative affairs", choices: ["Prepare and testify (8 hours)", "Send a deputy"], title: `${houseMaj() !== PP ? "House" : "Senate"} ${PP === "D" ? "Republicans" : "Democrats"} want you to testify`,
    body: "Five minutes per member, cameras on, and every one of them has a clip in mind. Preparing well can turn it around. Sending a deputy looks like hiding." });
  // Rules you wrote can be challenged in court.
  for (const x of C.rules) if (x.court && x.court === s.week && x.alive) { const ok = r() < 0.55; x.alive = ok; x.court = null; if (!ok) { C.trust -= 0.03; s.profile = clamp(s.profile - 1, 0, 100); }
    newsBoth(s, (real) => `A federal judge ${ok ? "upholds" : "blocks"} the ${c.short || "department"} rule on ${byId[x.pid]?.name || "your rule"}.`, ok ? "good" : "bad"); }
  // Out.
  if (!s.over && (C.trust < -0.5 || (c.heat > 0.92 && r() < 0.2))) {
    const fired = C.trust < -0.5; s.over = true; s.result = { kind: "cabout", won: false, why: fired ? "fired" : "scandal", post: c.post, weeks: s.week - C.since, rules: C.rules.filter((x) => x.alive).length, wins: C.wins };
    newsBoth(s, (real) => fired ? `The President fires ${c.post} ${nameOf(CAB_M, real)}.` : `${c.post} ${nameOf(CAB_M, real)} resigns under the weight of the scandal.`, "bad");
  }
}
function answerCabMode(s, m, choice) {
  const C = s.cabCareer, c = cabPost(s); if (!C || !c) return;
  if (m.kind === "presask") {
    if (choice === 0) { C.trust = clamp(C.trust + m.tr, -1, 1); s.integrity += m.integ; c.heat = clamp(c.heat + m.heat, 0, 1); s.toast = { title: "Done", text: "The President is pleased. Somewhere, someone is writing it down.", tone: "" }; }
    else if (choice === 1) { C.trust = clamp(C.trust - 0.04, -1, 1); s.toast = { title: "You push back, quietly", text: "The President grumbles and lets it go, this time.", tone: "" }; }
    else { C.trust = clamp(C.trust - 0.3, -1, 1); s.integrity += 5; s.profile = clamp(s.profile + 4, 0, 100); s.baseApproval = clamp(s.baseApproval - 4, 5, 99); s.approval = clamp(s.approval + 2, 5, 95);
      newsBoth(s, (real) => `${c.post} ${nameOf(CAB_M, real)} publicly refuses a request from the President.`, "event"); s.toast = { title: "On the record", text: "The press loves you this week. The President does not.", tone: "bad" }; }
  }
  if (m.kind === "testify") {
    if (choice === 0 && s.hours >= 8) { s.hours -= 8; const ok = R(s, "tst")() < 0.45 + s.integrity / 250 + s.profile / 400; c.heat = clamp(c.heat + (ok ? -0.06 : 0.07), 0, 1); s.profile = clamp(s.profile + 2, 0, 100); if (ok) C.trust = clamp(C.trust + 0.04, -1, 1);
      newsBoth(s, (real) => ok ? `${c.post} ${nameOf(CAB_M, real)} holds firm through a hostile hearing.` : `${c.post} ${nameOf(CAB_M, real)} stumbles under questioning on Capitol Hill.`, ok ? "good" : "bad"); }
    else { c.heat = clamp(c.heat + 0.04, 0, 1); }
  }
}
function cabAction(s, act, arg, r) {
  const C = s.cabCareer, c = cabPost(s); if (!C || !c) return;
  if (act === "dpush") {
    const b = s.bills.find((x) => !x.dead && x.stage === "committee" && (c.area || []).includes(x.pid)) || s.bills.find((x) => !x.dead && x.stage === "committee" && x.party === PP);
    if (!b) { s.toast = { title: "Nothing moving", text: "No bill in play needs your help right now. The time goes to meetings anyway.", tone: "" }; return; }
    b.wh = (b.wh || 0) + 0.18; C.trust = clamp(C.trust + (b.party === PP ? 0.02 : -0.02), -1, 1); s.profile = clamp(s.profile + 1, 0, 100); b.cabPush = (b.cabPush || 0) + 1;
    s.toast = { title: `You work the Hill on ${byId[b.pid].name}`, text: "Calls, meetings, a briefing for wavering members. It moves a few votes.", tone: "good" };
  }
  if (act === "drule") {
    if (C.rules.some((x) => s.week - x.week < 8)) { s.hours += ACTIONS.drule.hours; s.toast = { title: "Still in comment period", text: "Your last rule is still working through the process. One at a time.", tone: "" }; return; }
    const pid = (c.area || []).find((id) => !s.laws.includes(id) && !C.rules.some((x) => x.pid === id) && byId[id]);
    if (!pid) { s.toast = { title: "No rule to write", text: "Everything in your lane is already law or already a rule.", tone: "" }; return; }
    const court = r() < 0.45 ? s.week + 8 + Math.floor(r() * 12) : null; C.rules.push({ pid, week: s.week, court, alive: true }); s.boost[pid] = (s.boost[pid] || 0) + 0.04; C.trust = clamp(C.trust + 0.04, -1, 1); c.heat = clamp(c.heat + 0.02, 0, 1);
    newsBoth(s, (real) => `${c.post} ${nameOf(CAB_M, real)} issues a new rule: ${byId[pid].name}.${court ? " Opponents promise to sue." : ""}`, "event");
    s.toast = { title: "The rule is final", text: court ? "It takes effect, and the lawsuits are already being drafted." : "It takes effect. Nobody seems ready to sue.", tone: "good" };
  }
  if (act === "dtravel") { s.approval = clamp(s.approval + 1.5 + r(), 5, 95); s.profile = clamp(s.profile + 2, 0, 100); C.trust = clamp(C.trust + 0.01, -1, 1); s.toast = { title: "On the road", text: "A factory, a field office, a local TV interview. People like seeing someone from Washington show up.", tone: "good" }; }
  if (act === "dmanage") { c.heat = clamp(c.heat - 0.06, 0, 1); s.integrity += 1; s.toast = { title: "Running the building", text: "Inspector general reports answered, a bad contract cancelled, a manager reassigned. Quiet work that keeps scandals small.", tone: "good" }; }
}
function cabVerdict(s, r) {
  electionNight(s); const year = electionYear(s), C = s.cabCareer, c = cabPost(s);
  if (year % 4 !== 0) { s.over = true; s.result = { kind: "cabterm", won: true, post: c.post, house: s.night.houseD, sen: s.night.senD }; return; }
  const map = s.night.pres, nom = s.amb?.pr?.[PP]?.nom, stay = map.winner === PP && (nom?.ref === "potus" || r() < 0.35 + C.trust * 0.4);
  s.over = true;
  s.result = stay ? { kind: "cabterm", won: true, post: c.post, kept: true, newPres: nom?.ref !== "potus" } : { kind: "cabout", won: false, why: map.winner === PP ? "newteam" : "lost", post: c.post, weeks: s.week - C.since, rules: C.rules.filter((x) => x.alive).length, wins: C.wins };
}
function cabNextCongress(s) {
  s.career.push({ congress: 119 + s.term, year: electionYear(s), kind: "cabinet", role: "C" });
  const C = s.cabCareer, w = electWorld(s), c = s.cab.find((x) => x.id === C.post);
  Object.assign(c, { first: C.me.first, last: C.me.last, sf: C.me.sf, sl: C.me.sl, born: C.me.born, tone: C.me.look?.skin, vacant: false, you: true, heat: clamp(c.heat ?? 0.2, 0, 0.5), loyal: 0.8, note: `Serving since ${fmtDate(C.since)}.` });
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null;
  s.bills = []; s.youOwe = []; s.promises = []; s.inbox = []; s.trend = []; s.noms = s.noms.filter((x) => !x.done); s.imp = s.imp.filter((x) => !x.done); s.amb = null;
  seedBills(s); mpSeed(s); applyCab(s);
  govNews(s, w.gov);
  pushNews(s, `The ${ord(119 + s.term)} Congress convenes. ${w.presMsg} Democrats hold ${w.house} House seats and ${w.senate} Senate seats.`, "event");
  if (w.presMsgR) s.news[0].rt = `The ${ord(119 + s.term)} Congress convenes. ${w.presMsgR} Democrats hold ${w.house} House seats and ${w.senate} Senate seats.`;
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: s.career.length && w.presMsg && electionYear({ ...s, term: s.term - 1 }) % 4 === 0 ? "You're staying on" : "A new Congress",
    body: `${w.after.H === PP ? "Your party" : "The other party"} runs the House and ${w.after.S === PP ? "your party" : "the other party"} runs the Senate. ${w.after.H !== PP || w.after.S !== PP ? "Expect more hearings with your name on them." : "Friendlier committees, for now."}` });
  return s;
}

// ════════ Serving as governor ════════
// Win your state's governorship and you run it: pass budgets, tour the state, keep scandal out of the capitol, sue Washington
// when the other party holds the White House, decide on Medicaid expansion, and handle disasters. You appoint senators when
// a seat opens. You face the voters on your state's calendar until the term limit catches you.
export const GOV_M = { id: "GOV", first: "", last: "", sf: "", sl: "", p: "D", x: 0, born: 1970, g: "M", seat: "", own: 50, dem: 50, vuln: 0.5, prisk: 0.1, seniority: 0, base: { influence: 60, cash: 0 }, comm: [], lead: [], t: { ambition: 0.6, loyalty: 0.6, ego: 0.5, ethics: 0.6, deal: 0.5, label: "dealmaker" }, cabTitle: "Gov." };
memberById.GOV = GOV_M;
// States that had not expanded Medicaid as of 2026.
const NO_EXPANSION = new Set(["AL", "FL", "GA", "KS", "MS", "SC", "TN", "TX", "WI", "WY"]);
function applyGov(s) { const G = s?.govCareer; if (!G) return; Object.assign(GOV_M, G.me, { id: "GOV", seat: `Governor of ${STATE_NAME[G.st] || G.st}`, cabTitle: "Gov." }); }
function enterGovernor(s) {
  const you = memberById[s.youId], year = electionYear(s), st = you.st;
  const me = { first: you.first, last: you.last, sf: you.sf, sl: you.sl, p: you.p, x: you.x, born: you.born, g: you.g, look: you.look, st, t: you.t, fictional: !!you.fictional, custom: !!you.custom };
  s.career.push({ congress: 119 + s.term, year, kind: "gov", margin: s.result.margin, role: roleOf(s), laws: s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law").length });
  s.govDone = true; const w = electWorld(s);
  // Your old seat goes to someone of your party: a successor for the House seat, your own appointee for the Senate seat.
  const seat = memberById[you.id]; newcomer(s, seat, me.p, year); if (seat.ch === "S") { seat.appointee = true; seat.specialYear = year + 2; keep(s, seat); }
  s.govCareer = { st, me, since: year + 1, terms: 1, heat: 0.15, legacy: 0, budgets: 0, suits: 0, medicaid: !NO_EXPANSION.has(st), disasters: 0 };
  s.youId = "GOV"; s.role = "G"; applyGov(s);
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null;
  s.bills = []; s.youOwe = []; s.promises = []; s.inbox = []; s.trend = []; s.noms = s.noms.filter((x) => !x.done); s.imp = s.imp.filter((x) => !x.done); s.amb = null;
  s.opp = null; s.camp = null; s.pchal = null; s.runFor = null; s.lastTerm = false; s.cabNom = null; s.youPres = null; s.polls = [];
  s.approval = 55; s.baseApproval = 80; s.profile = clamp(s.profile + 10, 0, 100);
  seedBills(s); mpSeed(s);
  rebuildChambers(); regroup(); clearCaches();
  govNews(s, w.gov);
  pushNews(s, `${nameOf(GOV_M)} is sworn in as governor of ${STATE_NAME[st] || st}.`, "good"); s.news[0].rt = `${nameOf(GOV_M, true)} is sworn in as governor of ${STATE_NAME[st] || st}.`;
  const g = s.govs[st];
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: `Welcome to the governor's office`,
    body: `You run ${STATE_NAME[st] || st} now. Pass a budget, travel the state, keep scandal out of the capitol, and decide how hard to fight Washington. ${!s.govCareer.medicaid ? "Your state never expanded Medicaid; that decision is yours now. " : ""}${g?.tl ? "" : `You're on the ballot again in ${g?.next}.`} When a Senate seat opens in your state, you pick the replacement.` });
}
const GOV_DISASTERS = { coast: ["A hurricane", "Flooding"], west: ["A wildfire", "A drought emergency"], plains: ["Tornadoes", "A blizzard"], other: ["Flooding", "A severe storm"] };
const REGION = (st) => (["FL", "LA", "TX", "NC", "SC", "GA", "AL", "MS", "VA", "NJ", "NY"].includes(st) ? "coast" : ["CA", "OR", "WA", "NV", "AZ", "NM", "CO", "UT", "ID", "MT", "WY"].includes(st) ? "west" : ["KS", "OK", "NE", "SD", "ND", "IA", "MO", "MN"].includes(st) ? "plains" : "other");
function govModeWeek(s, r) {
  const G = s.govCareer; if (!G) return; const st = G.st;
  G.heat = clamp(G.heat + (r() - 0.5) * 0.03 + (r() < 0.012 ? 0.12 : 0) + (0.22 - G.heat) * 0.015, 0, 1);
  s.approval = clamp(s.approval + (50 + (GOV_M.p === "D" ? 1 : -1) * (LEAN[st] ?? 0) * 0.25 - s.approval) * 0.01 - (G.heat - 0.3) * 0.3, 15, 85);
  if (r() < 0.015) { const kind = GOV_DISASTERS[REGION(st)][Math.floor(r() * 2)]; G.disasters++;
    pushInbox(s, { kind: "gcrisis", from: "Your emergency management director", choices: ["Declare an emergency and ask Washington for help", "Handle it with state money"], title: `${kind} hits ${STATE_NAME[st] || st}`,
      body: `Damage is spreading and the cameras are coming. A federal disaster declaration brings money fast, if the President approves it${PP === GOV_M.p ? ", and the President is your ally" : ", and the President belongs to the other party"}. Paying for it yourself is slower and costs your budget, but nobody in Washington gets to say no.` }); }
  if (G.heat > 0.9 && r() < 0.08 && !s.over) { s.over = true; s.result = { kind: "govout", won: false, why: "scandal", st, terms: G.terms, legacy: G.legacy };
    newsBoth(s, (real) => `Gov. ${nameOf(GOV_M, real)} resigns as the scandal in ${STATE_NAME[st] || st} grows.`, "bad"); }
}
function answerGovMode(s, m, choice) {
  const G = s.govCareer; if (!G || m.kind !== "gcrisis") return;
  if (choice === 0) { const ok = PP === GOV_M.p ? R(s, "gaid")() < 0.9 : R(s, "gaid")() < 0.55;
    if (ok) { s.approval = clamp(s.approval + 3, 15, 85); s.profile = clamp(s.profile + 2, 0, 100); s.toast = { title: "Washington says yes", text: "Federal money and crews arrive within days. You're on every newscast in the state, in a windbreaker.", tone: "good" }; }
    else { s.approval = clamp(s.approval + 1, 15, 85); s.baseApproval = clamp(s.baseApproval + 2, 5, 99); s.profile = clamp(s.profile + 4, 0, 100); s.toast = { title: "The White House drags its feet", text: "You go on national TV to demand help. Your voters rally to you; the money comes late.", tone: "" };
      newsBoth(s, (real) => `Gov. ${nameOf(GOV_M, real)} accuses the White House of slow-walking disaster aid.`, "event"); } }
  else { s.approval = clamp(s.approval + 1.5, 15, 85); G.legacy += 1; s.toast = { title: "The state handles it", text: "Slower, costlier, and entirely yours. People notice who showed up.", tone: "good" }; }
}
function govAction(s, act, arg, r) {
  const G = s.govCareer; if (!G) return; const st = G.st;
  if (act === "gbudget") { const ok = r() < 0.45 + (s.approval - 50) / 80 + s.clout / 400;
    if (ok) { G.budgets++; G.legacy += 2; s.approval = clamp(s.approval + 1.5, 15, 85); s.toast = { title: "Your budget passes", text: "Schools, roads and a tax change with your name on it. The legislature grumbles and signs off.", tone: "good" }; newsBoth(s, (real) => `The ${STATE_NAME[st] || st} legislature passes Gov. ${nameOf(GOV_M, real)}'s budget.`, "good"); }
    else { s.approval = clamp(s.approval - 1, 15, 85); s.toast = { title: "Stalled in the legislature", text: "Leaders want changes you won't make. Try again when you have more leverage.", tone: "bad" }; } }
  if (act === "gtour") { s.approval = clamp(s.approval + 1.5 + r(), 15, 85); s.profile = clamp(s.profile + 1, 0, 100); s.toast = { title: "Every county", text: "Diners, plant floors, a county fair. Local TV follows you everywhere.", tone: "good" }; }
  if (act === "gmanage") { G.heat = clamp(G.heat - 0.06, 0, 1); s.integrity += 1; s.toast = { title: "Running the state", text: "Audits answered, a bad contractor dropped, an agency head replaced. Scandals stay small.", tone: "good" }; }
  if (act === "gsue") {
    if (PP === GOV_M.p) { s.hours += ACTIONS.gsue.hours; s.toast = { title: "Not against your own party", text: "Suing your own party's administration would end your career. Try a phone call.", tone: "" }; return; }
    const pid = [...s.laws].reverse().find((p) => byId[p]) || (s.eos || []).slice(-1)[0]?.pid;
    G.suits++; s.profile = clamp(s.profile + 3, 0, 100); s.baseApproval = clamp(s.baseApproval + 2, 5, 99); G.legacy += 1;
    newsBoth(s, (real) => `Gov. ${nameOf(GOV_M, real)} joins ${STATE_NAME[st] || st} to a multistate lawsuit against the administration${pid ? ` over ${byId[pid].name}` : ""}.`, "event");
    s.toast = { title: "See you in court", text: "Your attorney general files this afternoon. Your party's donors are thrilled; the White House is not.", tone: "good" }; }
  if (act === "gmedicaid") {
    if (G.medicaid) { s.hours += ACTIONS.gmedicaid.hours; s.toast = { title: "Already expanded", text: `${STATE_NAME[st] || st} expanded Medicaid years ago.`, tone: "" }; return; }
    G.medicaid = true; G.legacy += 3; const d = GOV_M.p === "D";
    s.approval = clamp(s.approval + 2, 15, 85); s.baseApproval = clamp(s.baseApproval + (d ? 3 : -5), 5, 99);
    newsBoth(s, (real) => `${STATE_NAME[st] || st} expands Medicaid under Gov. ${nameOf(GOV_M, real)}, covering hundreds of thousands of people.`, "good");
    s.toast = { title: "Medicaid expanded", text: d ? "A promise kept. Hospitals in rural counties breathe easier." : "Hospitals and county judges cheer. Your party's activists do not.", tone: "good" }; }
}
function govCareerVerdict(s, r) {
  electionNight(s); const G = s.govCareer, year = electionYear(s), g = s.govs[G.st];
  if (g.next !== year) { s.over = true; s.result = { kind: "govterm", won: true, st: G.st }; return; }
  if (g.tl) { s.over = true; s.result = { kind: "govout", won: true, why: "termlimit", st: G.st, terms: G.terms, legacy: G.legacy }; govElections(s, year, null); s.govDone = true; return; }
  const edge = (s.approval - 50) * 0.3 + (s.profile - 30) * 0.05 - G.heat * 6 + (r() - 0.5) * 4;
  const res = govElections(s, year, { ...GOV_M, edge }).find((x) => x.st === G.st); s.govDone = true;
  if (res?.now.you) { G.terms++; s.govs[G.st].terms = G.terms; s.govs[G.st].tl = govLimit(G.st) > 0 && G.terms >= govLimit(G.st); s.over = true; s.result = { kind: "govterm", won: true, reelected: true, st: G.st, margin: Math.abs(res.margin) };
    newsBoth(s, (real) => `Gov. ${nameOf(GOV_M, real)} wins re-election in ${STATE_NAME[G.st] || G.st}.`, "good"); }
  else { s.over = true; s.result = { kind: "govout", won: false, why: "lost", st: G.st, terms: G.terms, legacy: G.legacy, to: pname(res.now, false), toR: pname(res.now, true) };
    newsBoth(s, (real) => `Gov. ${nameOf(GOV_M, real)} loses re-election to ${pname(res.now, real)}.`, "bad"); }
}
function govNextCongress(s) {
  s.career.push({ congress: 119 + s.term, year: electionYear(s), kind: "governor", role: "G" });
  const w = electWorld(s); const G = s.govCareer;
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null;
  s.bills = []; s.youOwe = []; s.promises = []; s.inbox = []; s.trend = []; s.noms = s.noms.filter((x) => !x.done); s.imp = s.imp.filter((x) => !x.done); s.amb = null;
  seedBills(s); mpSeed(s); applyGov(s); govNews(s, w.gov);
  pushNews(s, `The ${ord(119 + s.term)} Congress convenes. ${w.presMsg} Democrats hold ${w.house} House seats and ${w.senate} Senate seats.`, "event"); if (w.presMsgR) s.news[0].rt = `The ${ord(119 + s.term)} Congress convenes. ${w.presMsgR} Democrats hold ${w.house} House seats and ${w.senate} Senate seats.`;
  const g = s.govs[G.st];
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: "Two more years", body: `${PP === GOV_M.p ? "Your party holds the White House: disaster aid comes faster, and you can't sue it." : "The other party holds the White House: lawsuits are your loudest tool."} ${g.tl ? "You're term-limited: this is your last stretch. Legacy now." : `You're on the ballot in ${g.next}.`}` });
  return s;
}

// ════════ Your presidency: the oath, the midterms and a second term ════════
export const canTakeOath = (s) => !!(s.over && s.result?.kind === "pres" && s.result.won && s.youId !== "POTUS");
const CAB_STYLE = ["Team of rivals", "Loyalists", "Seasoned hands"];
export function takeOath(s0) {
  const s = structuredClone(s0); if (!canTakeOath(s)) return s;
  const you = memberById[s.youId], year = electionYear(s), A = s.amb, mate = A?.pr?.[you.p]?.mate || null;
  const from = { first: you.first, last: you.last, sf: you.sf, sl: you.sl, p: you.p, born: you.born, g: you.g, look: you.look, x: you.x, st: you.st, seat: you.seat, fictional: !!you.fictional, custom: !!you.custom, id: you.id };
  s.career.push({ congress: 119 + s.term, year, kind: "pres", margin: s.result.margin, role: roleOf(s), laws: s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law").length });
  s.presCareer = { since: year + 1, terms: 1, from, mate, cabStyle: null };
  const w = electWorld(s);
  // Your old seat: the governor appoints a successor, or the district holds a special election.
  const seat = memberById[from.id]; newcomer(s, seat, from.p, year); if (seat.ch === "S") { seat.appointee = true; seat.specialYear = year + 2; keep(s, seat); }
  const rivals = (A?.pr?.[from.p]?.c || []).filter((c) => !c.you && c !== mate).sort((a, b) => b.del - a.del).slice(0, 3);
  s.youId = "POTUS"; s.role = "P"; s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null;
  s.bills = []; s.youOwe = []; s.promises = []; s.inbox = []; s.trend = []; s.noms = []; s.imp = []; s.runFor = null; s.youPres = null; s.pchal = null; s.amb = null; s.opp = null; s.camp = null; s.polls = [];
  s.wire = []; s.pres = []; s.news = s.news.slice(0, 20);
  s.eos = []; s.legacy = 0; s.vetoes = 0; s.signed = 0; s.presHeat = 0.15; s.presApproval = 54; s.approval = 54; s.baseApproval = 88; s.profile = 100; s.clout = 70; s.rapport = 0; s.rivals = 0;
  s.rel = {}; s.know = {}; s.owedToYou = {};
  for (const m of MEMBERS) { s.know[m.id] = m.lead?.length ? 1 : 0; if (m.p === PP) s.rel[m.id] = clamp(0.15 + 0.25 * (m.t.label === "follower" || m.t.label === "loyalist" ? 1 : 0) - 0.15 * Math.abs(m.x - from.x) - (m.vuln > 0.7 ? 0.1 : 0), -1, 1); }
  s.rivalPicks = rivals.map((c) => ({ first: c.first, last: c.last, sf: c.sf, sl: c.sl, born: c.born, g: c.g, look: c.look, id: c.id || null }));
  // The Vice President is your running mate.
  const vp = s.cab.find((c) => c.id === "vp");
  if (vp && mate) { Object.assign(vp, { first: mate.first, last: mate.last, sf: mate.sf, sl: mate.sl, born: mate.born, tone: mate.look?.skin, heat: 0.1, loyal: 0.85, note: `Your running mate. Sworn in January ${year + 1}.` }); const ms = mate.id && memberById[mate.id]; if (ms && ms.last === mate.last) { newcomer(s, ms, ms.p, year); if (ms.ch === "S") { ms.appointee = true; ms.specialYear = year + 2; keep(s, ms); } } }
  rebuildChambers(); regroup(); clearCaches(); applyPres(s);
  seedBills(s); mpSeed(s);
  const hMaj = w.after.H, sMaj = w.after.S;
  govNews(s, w.gov);
  { const t = `Inauguration Day. ${w.presMsg} ${hMaj === PP ? "Your party" : "The other party"} runs the House and ${sMaj === PP ? "your party" : "the other party"} runs the Senate.`; pushNews(s, t, "good"); if (w.presMsgR) s.news[0].rt = `Inauguration Day. ${w.presMsgR} ${hMaj === PP ? "Your party" : "The other party"} runs the House and ${sMaj === PP ? "your party" : "the other party"} runs the Senate.`; }
  pushInbox(s, { kind: "cabstyle", from: "Your transition chief", choices: CAB_STYLE, title: "How do you want to staff the government?",
    body: `Fifteen departments, four thousand appointments, and a Senate that has to confirm the big ones. ${rivals.length ? `A team of rivals brings the people you beat in the primaries inside the tent: State, Treasury and Defense.` : "A team of rivals means bringing in people who didn't back you."} Loyalists move fast and never leak, until they do. Seasoned hands know where the bodies are buried and keep scandals small.` });
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: "Welcome to the Oval Office", body: `You can sign or veto what Congress sends you, issue executive orders, call members, rally the country and fire your own Cabinet. ${hMaj === PP && sMaj === PP ? "Your party has both chambers: no excuses." : "Divided government: every big bill is a negotiation."} The midterms come in ${year + 2}, and if you want a second term, ${year + 4}.` });
  return s;
}
function answerCab(s, choice) {
  const style = CAB_STYLE[choice] || CAB_STYLE[2]; s.presCareer.cabStyle = style;
  if (choice === 0 && s.rivalPicks?.length) {
    ["state", "treasury", "defense"].forEach((post, i) => { const R0 = s.rivalPicks[i], c = s.cab.find((x) => x.id === post); if (!R0 || !c) return;
      Object.assign(c, { first: R0.first, last: R0.last, sf: R0.sf, sl: R0.sl, born: R0.born, tone: R0.look?.skin, loyal: 0.55, heat: 0.15, note: "Ran against you for the nomination. Now on your team." });
      const m = R0.id && memberById[R0.id]; if (m && m.last === R0.last) { newcomer(s, m, m.p, gameYear(s) - 1); if (m.ch === "S") { m.appointee = true; m.specialYear = electionYear(s); keep(s, m); } } });
    rebuildChambers(); regroup(); clearCaches(); s.clout += 5;
    newsBoth(s, () => "The new President names former primary rivals to run State, Treasury and Defense.", "event");
    s.toast = { title: "A team of rivals", text: "Your old opponents are inside the tent. Their friends in Congress are warmer. Their loyalty is not guaranteed.", tone: "good" };
  } else if (choice === 1) { for (const c of s.cab) if (c.id !== "vp") { c.loyal = 0.95; c.heat = clamp(c.heat + 0.12, 0, 1); } s.toast = { title: "Loyalists", text: "Nobody will leak. Nobody will tell you no, either. Expect more scandals.", tone: "" }; }
  else { for (const c of s.cab) if (c.id !== "vp") { c.loyal = 0.7; c.heat = clamp(c.heat - 0.08, 0, 1); } s.clout += 3; s.toast = { title: "Seasoned hands", text: "People who have done these jobs before. Fewer surprises.", tone: "good" }; }
}
function presCareerVerdict(s, r) {
  electionNight(s); const year = electionYear(s), n = s.night;
  if (year % 4 === 2) {
    const hD = n.houseD, sD = n.senD, own = PP === "D" ? [hD, sD] : [435 - hD, 100 - sD], keptH = own[0] >= 218, keptS = own[1] >= 51;
    s.over = true; s.result = { kind: "midterm", won: true, houseYours: own[0], senYours: own[1], keptH, keptS };
    pushNews(s, `Midterms ${year}: your party ends up with ${own[0]} House seats and ${own[1]} Senate seats. ${keptH && keptS ? "You keep both chambers." : !keptH && !keptS ? "You lose both chambers." : `You ${keptH ? "keep the House but lose the Senate" : "keep the Senate but lose the House"}.`}`, keptH || keptS ? "good" : "bad");
    return;
  }
  const map = n.pres, won = map.winner === PP, terms = s.presCareer.terms;
  s.over = true;
  if (terms >= 2) { s.result = { kind: "farewell", won: true, ev: map.ev, successor: map.winner === PP, approval: Math.round(s.presApproval), legacy: s.legacy, laws: s.laws.length };
    pushNews(s, `Election night ${year}: ${map.winner === PP ? "your party keeps" : "your party loses"} the White House, ${Math.max(map.ev.D, map.ev.R)} electoral votes to ${Math.min(map.ev.D, map.ev.R)}. Your two terms are over.`, map.winner === PP ? "good" : "bad"); return; }
  s.result = { kind: "pres", won, reelect: true, ev: map.ev[PP], evO: 538 - map.ev[PP], margin: Math.round(((map.ev[PP] - 269) / 5.38) * 10) / 10, approval: Math.round(s.presApproval), legacy: s.legacy, laws: s.laws.length, vetoes: s.vetoes, eos: (s.eos || []).filter((e) => e.alive).length };
  const other = s.amb?.pr?.[PP === "D" ? "R" : "D"]?.nom; s.result.opp = other ? pname(other, false) : "the challenger"; s.result.oppR = other ? pname(other, true) : "the challenger";
  newsBoth(s, (real) => `Election night ${year}: ${won ? "you win a second term" : "you lose your bid for a second term"}, ${map.ev[PP]} electoral votes to ${538 - map.ev[PP]}${other ? `, ${won ? "over" : "to"} ${pname(other, real)}` : ""}.`, won ? "good" : "bad");
}
function presNextCongress(s) {
  s.career.push({ congress: 119 + s.term, year: electionYear(s), kind: s.result.kind, role: "P", laws: s.laws.length });
  if (s.result.kind === "pres") s.presCareer.terms++;
  const w = electWorld(s);
  s.term++; s.termStart = Math.ceil((731 * (s.term - 1)) / 7); s.week = s.termStart; s.hours = HOURS; s.over = false; s.result = null;
  s.bills = []; s.youOwe = []; s.promises = []; s.inbox = s.inbox.filter((m) => !m.done).slice(0, 0); s.trend = []; s.noms = s.noms.filter((x) => !x.done); s.imp = s.imp.filter((x) => !x.done); s.amb = null;
  s.presHeat = clamp(s.presHeat - 0.1, 0, 1);
  seedBills(s); mpSeed(s);
  const hMaj = w.after.H, sMaj = w.after.S, congress = 119 + s.term;
  govNews(s, w.gov);
  pushNews(s, `The ${ord(congress)} Congress convenes. Democrats hold ${w.house} House seats and ${w.senate} Senate seats.`, "event");
  pushInbox(s, { kind: "staff", from: "Your chief of staff", done: true, title: `${s.presCareer.terms > 1 && congress % 2 === 1 && s.career[s.career.length - 1].kind === "pres" ? "Four more years" : `The ${ord(congress)} Congress`}`,
    body: `${hMaj === PP ? "Your party" : "The other party"} runs the House; ${sMaj === PP ? "your party" : "the other party"} runs the Senate. ${hMaj !== PP && sMaj !== PP ? "Expect subpoenas, and maybe worse." : ""} ${s.presCareer.terms >= 2 ? "You can't run again. Legacy now." : electionYear(s) % 4 === 0 ? `You're on the ballot in ${electionYear(s)}.` : ""}` });
  return s;
}
// Your favorability with the whole country: your record and reputation, not your numbers back home.
const youPop = (s) => roleOf(s) === "P" ? clamp(46 + (s.presApproval - 45) * 0.5, 34, 58) : 44 + clamp((s.approval - 50) * 0.15 + (s.integrity - 60) * 0.08, -6, 6);
function nomQ(c, s) { if (!c) return 0; if (c.ref === "potus" && s.presCareer) c = { ...c, you: true }; const fame = c.you ? s.profile * 0.9 : c.fame, pop = c.you ? youPop(s) + (s.debateBonus || 0) : c.pop; return (fame - 75) * 0.05 + (pop - 46) * 0.22 - Math.max(0, Math.abs(c.x) - 0.42) * 10; }
const mateQ = (c) => (c ? (c.pop - 46) * 0.08 + (c.fame - 60) * 0.01 : 0);
export function nomEdge(s) { const P = s.amb?.pr; if (!P || s.amb.year !== electionYear(s)) return 0; return clamp(nomQ(P.D.nom, s) - nomQ(P.R.nom, s) + mateQ(P.D.mate) - mateQ(P.R.mate) + (P.D.bounce || 0) - (P.R.bounce || 0), -6, 6); }
// Home states: a nominee runs a few points better at home, a running mate a little.
export function homeBump(s, st) { const P = s.amb?.pr; if (!P || s.amb.year !== electionYear(s)) return 0; let b = 0; for (const [p, sg] of [["D", 1], ["R", -1]]) { if (homeOf(s, P[p].nom) === st) b += 3 * sg; if (homeOf(s, P[p].mate) === st) b += 1.5 * sg; } return b; }
// A Senate seat's quality edge: named nominees bring their own following (or baggage).
function seatQ(s, m) { const k = s.amb?.year === electionYear(s) ? s.amb.sen?.[m.st] : null; if (!k || m.ch !== "S") return 0; return (k.D?.q || 0) - (k.R?.q || 0); }
const isOpen = (s, m) => !!m.vacant || !!(s.amb?.year === electionYear(s) && s.amb.out?.[m.id]);
function seatMargin(s, m) {
  const inc = m.p === "D" ? 1 : -1, n = noise(`${s.seed}:el${s.term}:${m.id}`), H = m.ch === "H";
  // Senate races start from the state's new lean; House districts from their 2024 vote, moved half as far as their state moved in 2026.
  const lean = H ? houseLean(m) : (LEAN[m.st] ?? (m.dem - 50) * 2);
  const against = Math.max(0, -inc * s.mood - 4), incB = Math.max(1.5, 4 - against * 0.5);   // incumbency shrinks in a wave
  return lean + s.mood * (H ? 0.9 : 0.8) + (isOpen(s, m) ? 0 : inc * incB) + n * (H ? 5 : 6) + aidPts(s, m) + seatQ(s, m);
}
// Put a real person into a seat (keeping the seat's id, state and lean). Used when a named candidate wins.
function install(s, seat, P, year) {
  const live = P.id && memberById[P.id] && memberById[P.id].last === P.last ? memberById[P.id] : null;
  const keepKeys = { ch: seat.ch, st: seat.st, d: seat.d, dem: seat.dem, id: seat.id, cls: seat.cls };
  const t = live?.t || P.t || { ambition: 0.8, loyalty: 0.5, ego: 0.6, ethics: 0.6, deal: 0.5, label: "showhorse" };
  const comm = (seat.comm || []).map((c) => ({ ...c, role: "", title: "" }));
  const rel = live ? s.rel[live.id] : undefined, know = live ? s.know[live.id] : undefined;
  for (const k of Object.keys(seat)) delete seat[k];
  Object.assign(seat, keepKeys, { first: P.first, last: P.last, sf: P.sf, sl: P.sl, p: P.p, x: Math.round((P.x ?? BASE_X[P.p] * 0.7) * 1000) / 1000, y: live?.y || 0, born: P.born, since: year + 1, comm, lead: [], t, g: P.g, look: P.look, fictional: false, new: true, real: true });
  derive(seat); seat.fund = fundOf(seat); keep(s, seat);
  for (const k of ["rel", "know", "owedToYou"]) delete s[k][seat.id];
  if (rel != null) s.rel[seat.id] = rel; if (know != null) s.know[seat.id] = know;
}

const FORMER = [
  ["Barack", "Obama", "D", 1961, "M", 4, "Former President", { influence: 92, legis: 70, pop: 58, profile: 99, integrity: 82, cash: 1500 }],
  ["Joe", "Biden", "D", 1942, "M", 0, "Former President", { influence: 40, legis: 90, pop: 38, profile: 78, integrity: 66, cash: 200 }],
  ["George W.", "Bush", "R", 1946, "M", 0, "Former President", { influence: 45, legis: 70, pop: 52, profile: 75, integrity: 68, cash: 300 }],
  ["Bill", "Clinton", "D", 1946, "M", 0, "Former President", { influence: 50, legis: 75, pop: 45, profile: 78, integrity: 40, cash: 400 }],
  ["Kamala", "Harris", "D", 1964, "F", 3, "Former Vice President", { influence: 55, legis: 30, pop: 42, profile: 88, integrity: 66, cash: 900 }],
  ["Mike", "Pence", "R", 1959, "M", 0, "Former Vice President", { influence: 22, legis: 30, pop: 33, profile: 55, integrity: 70, cash: 50 }],
  ["Hillary", "Clinton", "D", 1947, "F", 0, "Former Secretary of State", { influence: 50, legis: 50, pop: 41, profile: 88, integrity: 50, cash: 300 }],
  ["Nancy", "Pelosi", "D", 1940, "F", 0, "Speaker Emerita, retired", { influence: 70, legis: 92, pop: 36, profile: 80, integrity: 50, cash: 400 }],
  ["Mitch", "McConnell", "R", 1942, "M", 0, "Former Senate Leader, retired", { influence: 45, legis: 80, pop: 24, profile: 55, integrity: 45, cash: 200 }],
  ["Mitt", "Romney", "R", 1947, "M", 0, "Former Senator", { influence: 25, legis: 45, pop: 42, profile: 50, integrity: 78, cash: 100 }],
  ["Liz", "Cheney", "R", 1966, "F", 0, "Former Representative", { influence: 20, legis: 25, pop: 38, profile: 55, integrity: 85, cash: 300 }],
  ["Dick", "Durbin", "D", 1944, "M", 0, "Former Senate Whip, retired", { influence: 30, legis: 75, pop: 45, profile: 35, integrity: 72, cash: 50 }],
  ["Gavin", "Newsom", "D", 1967, "M", 0, "Former Governor of California", { influence: 70, legis: 50, pop: 46, profile: 90, integrity: 55, cash: 1200 }],
  ["Josh", "Shapiro", "D", 1973, "M", 0, "Governor of Pennsylvania", { influence: 55, legis: 45, pop: 57, profile: 70, integrity: 70, cash: 800 }],
  ["JB", "Pritzker", "D", 1965, "M", 0, "Governor of Illinois", { influence: 55, legis: 45, pop: 50, profile: 65, integrity: 60, cash: 3000 }],
  ["Gretchen", "Whitmer", "D", 1971, "F", 0, "Former Governor of Michigan", { influence: 50, legis: 40, pop: 52, profile: 65, integrity: 68, cash: 500 }],
  ["Ron", "DeSantis", "R", 1978, "M", 0, "Former Governor of Florida", { influence: 55, legis: 50, pop: 47, profile: 75, integrity: 55, cash: 900 }],
  ["Zohran", "Mamdani", "D", 1991, "M", 3, "Mayor of New York City", { influence: 55, legis: 15, pop: 48, profile: 95, integrity: 72, cash: 300 }],
  ["Pete", "Buttigieg", "D", 1982, "M", 0, "Former Secretary of Transportation", { influence: 45, legis: 25, pop: 47, profile: 85, integrity: 74, cash: 400 }],
  // The White House staff, recent Cabinet departures, and national figures out of office
  ["Stephen", "Miller", "R", 1985, "M", 0, "White House Deputy Chief of Staff", { influence: 90, legis: 20, pop: 35, profile: 80, integrity: 45, cash: 0 }],
  ["Nikki", "Haley", "R", 1972, "F", 2, "Former UN Ambassador", { influence: 38, legis: 30, pop: 42, profile: 74, integrity: 62, cash: 300 }],
  ["Marjorie Taylor", "Greene", "R", 1974, "F", 0, "Former Representative", { influence: 28, legis: 10, pop: 32, profile: 82, integrity: 45, cash: 200 }],
  ["Vivek", "Ramaswamy", "R", 1985, "M", 3, "Lost the 2026 Ohio governor's race", { influence: 26, legis: 5, pop: 38, profile: 70, integrity: 55, cash: 2000 }],
  ["Kevin", "McCarthy", "R", 1965, "M", 0, "Former Speaker", { influence: 28, legis: 55, pop: 30, profile: 52, integrity: 50, cash: 300 }],
  ["Paul", "Ryan", "R", 1970, "M", 0, "Former Speaker", { influence: 25, legis: 62, pop: 36, profile: 50, integrity: 65, cash: 200 }],
  ["Mike", "Pompeo", "R", 1963, "M", 0, "Former Secretary of State", { influence: 28, legis: 40, pop: 35, profile: 52, integrity: 55, cash: 100 }],
  ["Kristi", "Noem", "R", 1971, "F", 0, "Former Secretary of Homeland Security", { influence: 22, legis: 20, pop: 33, profile: 62, integrity: 40, cash: 100 }],
  ["Pam", "Bondi", "R", 1965, "F", 0, "Former Attorney General", { influence: 22, legis: 15, pop: 35, profile: 58, integrity: 45, cash: 50 }],
  ["Tulsi", "Gabbard", "R", 1981, "F", 2, "Former Director of National Intelligence", { influence: 22, legis: 25, pop: 38, profile: 62, integrity: 55, cash: 50 }],
  ["Greg", "Abbott", "R", 1957, "M", 0, "Former Governor of Texas (lost in 2026)", { influence: 36, legis: 50, pop: 40, profile: 60, integrity: 50, cash: 1500 }],
  ["Brian", "Kemp", "R", 1963, "M", 0, "Former Governor of Georgia", { influence: 34, legis: 45, pop: 50, profile: 50, integrity: 68, cash: 300 }],
  ["Tim", "Walz", "D", 1964, "M", 0, "Former Governor of Minnesota", { influence: 28, legis: 40, pop: 42, profile: 62, integrity: 58, cash: 100 }],
  ["Jasmine", "Crockett", "D", 1981, "F", 5, "Former Representative", { influence: 24, legis: 15, pop: 45, profile: 74, integrity: 60, cash: 300 }],
  ["Al", "Gore", "D", 1948, "M", 0, "Former Vice President", { influence: 14, legis: 45, pop: 45, profile: 48, integrity: 70, cash: 500 }],
  // Sitting and incoming governors
  ["Andy", "Beshear", "D", 1977, "M", 0, "Governor of Kentucky", { influence: 45, legis: 40, pop: 58, profile: 60, integrity: 70, cash: 300 }],
  ["Wes", "Moore", "D", 1978, "M", 5, "Governor of Maryland", { influence: 48, legis: 40, pop: 55, profile: 64, integrity: 68, cash: 400 }],
  ["Kathy", "Hochul", "D", 1958, "F", 0, "Governor of New York", { influence: 50, legis: 45, pop: 44, profile: 55, integrity: 60, cash: 600 }],
  ["Abigail", "Spanberger", "D", 1979, "F", 0, "Governor of Virginia", { influence: 40, legis: 35, pop: 52, profile: 52, integrity: 72, cash: 200 }],
  ["Mikie", "Sherrill", "D", 1972, "F", 0, "Governor of New Jersey", { influence: 40, legis: 35, pop: 50, profile: 50, integrity: 70, cash: 200 }],
  ["Amy", "Klobuchar", "D", 1960, "F", 0, "Governor-elect of Minnesota", { influence: 45, legis: 70, pop: 52, profile: 66, integrity: 70, cash: 600 }],
  ["Marsha", "Blackburn", "R", 1952, "F", 0, "Governor-elect of Tennessee", { influence: 40, legis: 50, pop: 50, profile: 55, integrity: 55, cash: 500 }],
  ["Gina", "Hinojosa", "D", 1973, "F", 2, "Governor-elect of Texas", { influence: 48, legis: 25, pop: 52, profile: 58, integrity: 70, cash: 300 }],
  ["Byron", "Donalds", "R", 1978, "M", 5, "Governor-elect of Florida", { influence: 48, legis: 25, pop: 48, profile: 62, integrity: 58, cash: 500 }],
  ["Xavier", "Becerra", "D", 1958, "M", 2, "Governor-elect of California", { influence: 52, legis: 50, pop: 47, profile: 52, integrity: 62, cash: 400 }],
  ["Keisha Lance", "Bottoms", "D", 1970, "F", 5, "Governor-elect of Georgia", { influence: 42, legis: 20, pop: 50, profile: 52, integrity: 64, cash: 200 }],
  ["Amy", "Acton", "D", 1965, "F", 0, "Governor-elect of Ohio", { influence: 40, legis: 15, pop: 52, profile: 48, integrity: 72, cash: 200 }],
  ["Jocelyn", "Benson", "D", 1977, "F", 0, "Governor-elect of Michigan", { influence: 40, legis: 25, pop: 50, profile: 46, integrity: 70, cash: 200 }],
  ["Deb", "Haaland", "D", 1960, "F", 3, "Governor-elect of New Mexico", { influence: 35, legis: 35, pop: 52, profile: 56, integrity: 70, cash: 100 }],
  ["Rob", "Sand", "D", 1982, "M", 0, "Governor-elect of Iowa", { influence: 32, legis: 15, pop: 52, profile: 42, integrity: 72, cash: 100 }],
  ["Rahm", "Emanuel", "D", 1959, "M", 0, "Former Ambassador to Japan", { influence: 32, legis: 45, pop: 40, profile: 58, integrity: 55, cash: 300 }],
  ["Chris", "Sununu", "R", 1974, "M", 0, "Former Governor of New Hampshire", { influence: 30, legis: 35, pop: 52, profile: 50, integrity: 66, cash: 200 }],
  ["Larry", "Hogan", "R", 1956, "M", 0, "Former Governor of Maryland", { influence: 22, legis: 35, pop: 50, profile: 45, integrity: 68, cash: 150 }],
  ["Conor", "Lamb", "D", 1984, "M", 0, "Former Representative", { influence: 12, legis: 20, pop: 50, profile: 30, integrity: 70, cash: 50 }],
  ["Glenn", "Youngkin", "R", 1966, "M", 0, "Former Governor of Virginia", { influence: 40, legis: 30, pop: 48, profile: 55, integrity: 65, cash: 800 }],
];
// National profile for members whose fame outruns their seniority (0-100), and the people already running for 2028.
const FAME = { "Ocasio-Cortez NY": 96, "Sanders VT": 95, "Warren MA": 86, "Cruz TX": 88, "Omar MN": 78, "Jordan OH": 80, "Hawley MO": 72, "Fetterman PA": 78, "Booker NJ": 78, "Paul KY": 76, "Schiff CA": 76,
  "Raskin MD": 70, "Murphy CT": 72, "Kennedy LA": 70, "Lee UT": 66, "Murkowski AK": 66, "Tlaib MI": 66, "Khanna CA": 68, "Talarico TX": 72, "Boebert CO": 70, "Luna FL": 62, "Moskowitz FL": 56, "Slotkin MI": 62, "Gallego AZ": 62,
  "Kelly AZ": 70, "Ossoff GA": 68, "Warnock GA": 66, "Crenshaw TX": 60, "Brown OH": 72, "Cotton AR": 64, "Scott SC": 66, "Johnson LA": 80, "Jeffries NY": 88, "Schumer NY": 90, "Thune SD": 72, "Pressley MA": 60, "Frost FL": 56, "Waters CA": 66 };
const CONTENDER = new Set(["Vance", "Rubio", "Newsom", "Shapiro", "Pritzker", "Whitmer", "DeSantis", "Ocasio-Cortez", "Harris", "Buttigieg", "Booker", "Kelly", "Ossoff", "Cruz", "Hawley", "Youngkin", "Beshear", "Moore", "Haley", "Klobuchar"]);
// Hand adjustments for standing the numbers miss: movement leaders with outsized followings, and newcomers still building a record.
const STANDING = { "Ocasio-Cortez": 38, "Cruz": 38, "Mamdani": -22 };
export const RANK_GROUPS = [["all", "Everyone"], ["H", "House"], ["S", "Senate"], ["X", "White House and Cabinet"], ["J", "Supreme Court"], ["F", "Former officials and governors"]];
export function allRankings(s) {
  const base = rankings(s), byId = {}; for (const r of base) byId[r.m.id] = r;
  const sponsored = {}; for (const b of s.bills) if (b.stage === "law") sponsored[b.sponsor] = (sponsored[b.sponsor] || 0) + 1;
  // The office you hold or held is most of a career's weight: a presidency outranks any senator's resume.
  const PRESTIGE = (t) => !t ? 0 : /^President$/.test(t) ? 160 : /Former President/.test(t) ? 160 : /Chief Justice/.test(t) ? 100 : /Former Vice President/.test(t) ? 70 : /Vice President/.test(t) ? 160 : /Speaker Emerita/.test(t) ? 60 : /^Speaker/.test(t) ? 125 : /Senate Majority Leader/.test(t) ? 85 : /Senate Minority Leader|Former Senate Leader/.test(t) ? 65 : /House (Majority|Minority) Leader|Republican Leader|Democratic Leader/.test(t) ? 60 : /Associate Justice/.test(t) ? 60 : /Former Secretary of State/.test(t) ? 40 : /Secretary of State/.test(t) ? 50 : /Former Speaker/.test(t) ? 30 : /Former Governor/.test(t) ? 22 : /Governor(-elect)? of (California|Florida|Texas|New York|Pennsylvania|Illinois|Michigan|Ohio|Georgia)/.test(t) ? 40 : /Mayor of New York/.test(t) ? 30 : /Former (Secretary|Attorney General|Director|UN)/.test(t) ? 15 : /Secretary|Attorney General|Chief of Staff/.test(t) ? 30 : /Governor/.test(t) ? 30 : /Former/.test(t) ? 12 : /Whip/.test(t) ? 35 : /Director|Administrator|Ambassador|Representative/.test(t) ? 15 : /Pro Tempore/.test(t) ? 10 : 0;
  const row = (m, me, x, title) => ({ m, me, ...x, prestige: PRESTIGE(title || m.lead?.[0]), score: Math.round(0.7 * (x.influence * 1.2 + x.legis * 1.1 + (x.pop - 40) * 0.8 + Math.min(40, x.cash / 60) + x.integrity * 0.3 + x.profile * 1.1) + PRESTIGE(title || m.lead?.[0]) + (CONTENDER.has(m.last) && !me ? 20 : 0) + Math.max(0, x.profile - 60) * 0.7 + Math.max(0, x.profile - 80) * 1.5) });
  const rows = [];
  // Every member of both chambers. Seniority counts, but national profile counts more.
  for (const m of MEMBERS) {
    if (m.vacant || !m.ch) continue;
    const me = m.id === s.youId, chair = (m.comm || []).some((c) => c.role === "Chair"), fame = FAME[`${m.last} ${m.st}`];
    const x = { influence: me ? s.clout : Math.round(10 + m.seniority * 0.8 + (m.lead?.length ? 40 : 0) + (chair ? 18 : 0) + m.t.ambition * 10 + (sponsored[m.id] || 0) * 6 + (fame ? fame * 0.25 : 0)),
      legis: me ? s.legis : (sponsored[m.id] || 0) * 12 + Math.round(m.seniority * 0.3 + (chair ? 6 : 0)), pop: me ? s.approval : Math.round(50 + (m.own - 50) * 0.5 + noise(m.id + "pop") * 6), cash: me ? s.cash : m.base.cash,
      integrity: me ? s.integrity : Math.round(45 + m.t.ethics * 50), profile: me ? s.profile : fame ?? Math.round(5 + m.seniority * 0.4 + (m.lead?.length ? 40 : 0) + m.t.ego * 15) };
    const r0 = row(m, me, x); r0.score += chair ? 6 : 0; rows.push({ ...r0, grp: m.ch });
  }
  // The President, the Vice President and the Cabinet.
  const P = PRES_M, meP = roleOf(s) === "P";
  rows.push({ ...row(P, meP, { influence: 100, legis: Math.round(55 + (s.laws || []).length * 2), pop: Math.round(s.presApproval), cash: 3000, integrity: Math.round(70 - s.presHeat * 50), profile: 100 }, "President"), grp: "X", title: "President" });
  const CABW = { vp: [72, 79], cos: [85, 55], state: [85, 85], treasury: [78, 65], defense: [68, 82], ag: [65, 60], hhs: [60, 88], dhs: [62, 70], fbi: [55, 72], omb: [62, 45], commerce: [55, 65], un: [45, 55] };
  for (const c of s.cab || []) { if (c.vacant) continue; const m = { id: "cab-" + c.id, first: c.first, last: c.last, sf: c.sf, sl: c.sl, p: PP, born: c.born, g: /Susie|Brooke|Linda|Pam|Jeanine|Kari|Tulsi|Kristi|Lori/.test(c.first) ? "F" : "M", look: c.tone !== undefined ? { skin: c.tone } : undefined, seat: c.short };
    const [inf, prof] = CABW[c.id] || [Math.round(35 + c.loyal * 20), Math.round(30 + c.heat * 30)];
    rows.push({ ...row(m, false, { influence: inf, legis: 10, pop: Math.round(c.id === "vp" ? 41 : 36 + (1 - c.heat) * 10), cash: c.id === "vp" ? 500 : 0, integrity: Math.round(80 - c.heat * 60), profile: prof }, c.post), grp: "X", title: c.post }); }
  // The Court.
  for (const j of onBench(s)) { const m = { id: j.id, first: j.first, last: j.last, sf: j.sf, sl: j.sl, p: j.by, born: j.born, g: j.g, look: j.skin != null ? { skin: j.skin } : undefined, seat: "Supreme Court" };
    const med = Math.abs(j.x - courtMedian(s)) < 0.12, yrs = gameYear(s) - j.since, lean = Math.abs(j.x);
    rows.push({ ...row(m, false, { influence: Math.round((j.chief ? 82 : med ? 75 : 50) + Math.min(15, yrs * 0.5) + lean * 8), legis: 20 + Math.min(20, yrs), pop: 45, cash: 0, integrity: 70, profile: Math.round(40 + Math.min(20, yrs * 0.6) + lean * 15 + (j.chief ? 15 : 0)) }, j.chief ? "Chief Justice" : "Associate Justice"), grp: "J", title: j.chief ? "Chief Justice" : "Associate Justice" }); }
  // Former officials and governors: they still move money, voters and members.
  const inOffice = new Set([...MEMBERS.map((m) => `${m.first} ${m.last}`), `${PRES_M.first} ${PRES_M.last}`]);
  for (const f of s.formers || []) { if (inOffice.has(`${f.first} ${f.last}`)) continue; inOffice.add(`${f.first} ${f.last}`); const m = { id: "fmr-" + f.last + f.first, first: f.first, last: f.last, sf: f.sf || f.first, sl: f.sl || f.last, p: f.p, born: f.born, g: f.g || "M", look: f.look, seat: f.title };
    const st = f.title === "Former President" ? { influence: 75, legis: 60, pop: 44, profile: 96, integrity: 40, cash: 2500 } : f.cab === "vp" ? { influence: 50, legis: 30, pop: 40, profile: 82, integrity: 55, cash: 400 } : { influence: 30, legis: 25, pop: 38, profile: 55, integrity: 55, cash: 100 };
    rows.push({ ...row(m, false, st, f.title), grp: "F", title: f.title }); }
  for (const [first, last, p, born, g, skin, title, st] of FORMER) { if (inOffice.has(`${first} ${last}`)) continue; const [sf, sl] = swapPair(first.split(" ")[0], last); const m = { id: "fmr-" + last + first, first, last, sf: first.includes(" ") ? `${sf} ${first.split(" ").slice(1).join(" ")}` : sf, sl, p, born, g, look: { skin }, seat: title };
    rows.push({ ...row(m, false, st, title), grp: "F", title }); }
  for (const r of rows) if (STANDING[r.m.last] && !r.me) r.score += STANDING[r.m.last];
  const keys = ["score", "influence", "legis", "pop", "cash", "integrity", "profile"];
  for (const k of keys) [...rows].sort((a, b) => b[k] - a[k]).forEach((x, i) => (x["a_" + k] = i + 1));
  return rows;
}
export { CABINET };
