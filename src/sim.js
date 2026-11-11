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
  for (const m of ms) {
    m.mix = mixFor(m.dem);
    m.pmix = primaryMix(m.mix, m.p);
    const own = m.p === "D" ? m.dem : 100 - m.dem;           // their party's 2024 share at home
    m.own = own;
    m.vuln = clamp(1 - (own - 49) / 14, 0.12, 1);             // thin margin = listens to the district
    m.prisk = clamp((own - 52) / 22, 0.08, 0.85);             // safe seat = fears the primary
    m.signer = m.p === "R" && noise(m.id + "pledge") > -0.75; // most Republicans signed the anti-tax pledge
    m.seat = m.ch === "H" ? `${m.st}-${m.d || "AL"}` : m.st;
    m.seniority = 2027 - (m.since || 2027);
    m.chair = (m.comm || []).find((c) => c.role === "Chair");
    m.base = { influence: Math.round(10 + m.seniority * 1.6 + (m.lead?.length ? 45 : 0) + (m.chair ? 22 : 0) + m.t.ambition * 10), cash: Math.round(300 + m.vuln * 1400 + m.seniority * 25 + m.t.ambition * 400) };
  }
  return ms;
}
export const MEMBERS = buildMembers();
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
  const A = m.p === "R" ? clamp(0.45 + 0.5 * m.x, 0.3, 0.95) : 0;
  const presS = clamp(bill.pres + (ctx.wh || 0), -1, 1);
  const X = m.p === "R" ? presS * A * (ctx.kind === "override" ? 2 : 1) : bill.bipartisan || bill.mustPass ? 0 : -bill.pres * 0.3;
  const F = factionC(bill, ctx.sponsor, m.faction, m.ch);
  const pledge = bill.tax && m.signer ? -1 : 0;
  const gp = groupPull(m, pid, noise);
  const G = gp.G;
  const B = (ctx.boost?.[pid] || 0) + (m.p === "R" ? Math.max(0, ctx.wh || 0) * 0.5 : 0) - (ctx.fil && m.ch === "S" && m.p === ctx.fil.p ? ctx.fil.w : 0);                           // public pressure after an event
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
  sign: { label: "Sign", hours: 0, role: "P" }, veto: { label: "Veto", hours: 0, role: "P" }};
export function newCareer(youId, seed = Math.floor(Math.random() * 1e9), custom = null, diff = null) {
  if (youId === "POTUS") return newPresidency(seed, diff);
  const you = memberById[youId];
  const know = {};
  for (const m of MEMBERS) if (m.id !== youId) know[m.id] = m.ch === you.ch && (m.st === you.st || (m.comm || []).some((c) => (you.comm || []).some((d) => d.c === c.c))) ? 1 : 0;
  const s = {
    seed, week: 0, youId, hours: HOURS, cash: custom?.cash ?? Math.round(you.base.cash * 0.4), approval: 50 + Math.round((you.own - 50) * 0.5), baseApproval: 62,
    profile: you.lead?.length ? 60 : Math.round(8 + you.seniority * 1.5), clout: Math.round(you.base.influence), integrity: 70, legis: 0, loyalty: 0,
    know, rel: {}, owedToYou: {}, youOwe: [], promises: [], bills: [], laws: [], news: [], inbox: [], pending: null, log: [], n: 0,
    econ: { growth: 1.6, inflation: 3.4, jobs: 4.6 }, presApproval: 39, mood: 5.3, reconUsed: {}, over: false, result: null, votesCast: [], tookMoney: 0,
    rapport: 0, pres: [], staff: makeStaff(seed), diff: diff || { info: "normal", world: "normal" }, boost: {}, groups: {}, flags: {}, usedEvents: [], moments: [],
    role: you.ch === "S" ? "S" : "H", cab: freshCabinet(), noms: [], presHeat: 0.35, imp: [],
  };
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
export const billCtx = (s, b, kind = "passage") => ({ sponsor: b.party, kind, route: b.route, seed: s.seed, deals: b.deals, boost: s.boost, wh: b.wh, fil: b.fil, trust: Object.fromEntries(Object.entries(s.rel).map(([id, v]) => [id, b.asked[id] ? v : 0])) });

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
          if (want) { s.youOwe.push({ id: `f${s.week}${s.youOwe.length}`, to: m.id, pid: want, due: Math.min(s.week + 14, ELECTION_WEEK - 2), status: "open", why: byId[b.pid].name }); ask = ` In return they want your vote for ${byId[want].name} when it comes up.`; }
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
  // 1. Floor votes scheduled for this week.
  for (const b of s.bills) {
    if (b.dead || b.stage !== "committee" || b.floorWeek > s.week) continue;
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
    s.mood = clamp(s.mood + (40 - s.presApproval) * 0.03 - 0.25 + (r() - 0.5) * 0.8, -6, 9);   // the thermostat pulls back toward the President's party over time
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
  // 6. Primary and general.
  if (roleOf(s) === "P") { if (s.week >= ELECTION_WEEK && !s.over) presVerdict(s, r); }
  else if (!upIn2028(you)) { if (s.week >= ELECTION_WEEK && !s.over) termReview(s, r); }
  else { if (s.week === PRIMARY_WEEK) primary(s, r); if (s.week >= ELECTION_WEEK && !s.over) general(s, r); }
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
  const challenged = strength < 62 || r() < 0.15;
  const share = clamp(50 + (strength - 55) * 0.9 + (r() - 0.5) * 6, 20, 92);
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
  const margin = lean2 + env * 0.9 + 3 + (s.approval - 50) * 0.45 + Math.min(4, s.cash / 900) + gg.net * 0.5 + (r() - 0.5) * 5;
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
    if (kind === "primary" && s.week < PRIMARY_WEEK) { s.rivals = (s.rivals || 0) + 1; s.baseApproval = clamp(s.baseApproval - 2, 5, 95); pushNews(s, `${nameOf(m)} is quietly helping a primary challenger to ${nameOf(you)}, people close to both say.`, "bad"); s.moments.push({ week: s.week, text: `${nameOf(m)} backed a primary challenger against you.` }); }
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
  const score = info.pres + (b.wh || 0) + (b.sponsor === s.youId ? 0.15 * s.rapport : 0);
  const bar = b.party === "D" && !info.bipartisan ? 0.1 : -0.05;
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
  if (hot && HOUSE.filter((m) => m.p === "D").length >= 218) {
    hot.imp = true; s.imp.push({ id: `i${s.week}`, who: hot.id, stage: "house", week: s.week + 3 });
    pushNews(s, `House Democrats file articles of impeachment against ${hot.post} ${cabName(hot)}.`, "event");
    if (role === "H") pushInbox(s, { kind: "impeach", imp: `i${s.week}`, from: "Your legislative director", title: `Impeach ${cabName(hot)}?`, body: `The floor vote is ${fmtDate(s.week + 3)}. ${you.p === "D" ? "Leadership wants every Democrat. Your swing-seat colleagues are nervous." : "Your party will vote no. A yes would make national news."}`, choices: ["Vote to impeach", "Vote no"] });
  }
  if (s.presHeat >= 0.9 && s.presApproval < 36 && !s.imp.some((i) => i.who === "POTUS")) {
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
      const st = PRESIDENT_STANCE[v.pid] ?? 0; if (Math.abs(st) < 0.5) continue;
      const withHim = (st > 0) === v.vote;
      if (you.p === "R" && !withHim && s.week - (s.lastAttack ?? -99) > 8 && r() < 0.35 + Math.abs(st) * 0.2 - Math.max(0, s.rapport) * 0.4) { s.lastAttack = s.week; s.baseApproval = clamp(s.baseApproval - 3, 5, 95); s.rivals = (s.rivals || 0) + 0.5; s.rapport = clamp(s.rapport - 0.2, -1, 1); presPost(s, `The President attacks ${nameOf(you)} by name: "${titleOf(you)} ${you.sl}" is "a RINO who should be primaried" after the vote on ${byId[v.pid].name}.`, v.pid); pushNews(s, `The President calls for a primary challenge to ${nameOf(you)}.`, "bad"); }
      else if (you.p === "R" && withHim && s.rapport > 0.15 && r() < 0.18 && !s.endorsed) { s.endorsed = true; s.baseApproval = clamp(s.baseApproval + 5, 5, 95); presPost(s, `"Complete and Total Endorsement" for ${titleOf(you)} ${you.sl}, the President posts after the vote on ${byId[v.pid].name}.`, v.pid); pushNews(s, `The President endorses ${nameOf(you)}.`, "good"); }
      else if (you.p === "D" && !withHim && r() < 0.12) { s.baseApproval = clamp(s.baseApproval + 2, 5, 95); s.profile = clamp(s.profile + 2, 0, 100); presPost(s, `The President mocks ${titleOf(you)} ${you.sl} over ${byId[v.pid].name}. Your fundraising email goes out within the hour.`, v.pid); s.cash += 60; }
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
    cab: freshCabinet(), noms: [], presHeat: 0.35, imp: [], eos: [], legacy: 0, vetoes: 0, signed: 0,
  };
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
  const margin = (s.presApproval - 44) * 0.9 + (s.econ.growth - 1.6) * 1.5 - (s.econ.inflation - 3) * 1.2 + Math.min(4, (s.legacy || 0) * 0.25) + (r() - 0.5) * 4;
  s.over = true;
  s.result = { kind: "pres", won: margin > 0, margin: Math.round(margin * 10) / 10, approval: Math.round(s.presApproval), laws: s.laws.length, vetoes: s.vetoes, eos: (s.eos || []).filter((e) => e.alive).length, legacy: s.legacy };
  pushNews(s, `Election night 2028: the Republican nominee ${margin > 0 ? "wins" : "loses"} the White House by ${Math.abs(s.result.margin)} points.`, margin > 0 ? "good" : "bad");
}
// Senators who aren't on the 2028 ballot: a verdict on the term instead of an election.
function termReview(s, r) {
  const score = s.clout * 0.4 + s.legis * 0.6 + s.profile * 0.3 + (s.baseApproval - 50) * 0.5 + s.integrity * 0.2 + (r() - 0.5) * 6;
  s.over = true;
  s.result = { kind: "term", won: true, score: Math.round(score), next: memberById[s.youId].cls === 1 ? 2030 : 2032 };
  pushNews(s, `The 120th Congress ends. ${nameOf(memberById[s.youId])} heads toward ${s.result.next} with a ${score > 70 ? "strong" : score > 45 ? "mixed" : "weak"} record.`);
}
export { POLICIES, PRESIDENT_STANCE };
