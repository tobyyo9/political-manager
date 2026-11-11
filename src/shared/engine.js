import { BASELINE, OUTLOOK, SOCIAL_SECURITY as SS } from "./data/baseline.js";
import { POLICIES, WINDOW_ADJUST } from "./data/policies.js";
import { GROUPS, DEMOGRAPHICS } from "./data/typology.js";
import { CONGRESS } from "./data/congress.js";
import { electoralVotes } from "./data/states.js";
import { AGENDA_GOALS } from "./data/agenda.js";
import { MEDIA, EXPOSURE, PERCEPTION, DEFAULT_PERCEPTION, drift } from "./data/perception.js";
import { PRESIDENT_STANCE, PRESIDENT_PULL } from "./data/president.js";

export const byId = Object.fromEntries(POLICIES.map((p) => [p.id, p]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── Budget ──────────────────────────────────────────────────
// Spread a 10-year score across 2027-2036 in proportion to GDP, with a
// two-year phase-in, after moving it to the 2027-2036 window.
const RAMP = [0.6, 0.85, 1, 1, 1, 1, 1, 1, 1, 1];
const WEIGHTS = (() => {
  const w = BASELINE.map((y, i) => y.gdp * RAMP[i]);
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
})();

// One-time spending (like a war supplemental) lands in the first two years.
const FRONT = BASELINE.map((_, i) => (i === 0 ? 0.6 : i === 1 ? 0.4 : 0));

export function tenYearOf(id, level) {
  const p = byId[id];
  return p.levels[level].tenYear * (p.adjust ?? WINDOW_ADJUST);
}

// Share of Social Security's 75-year gap the plan closes (estimates).
export function ssClosure(selection) {
  return Object.keys(selection).reduce((a, id) => a + (byId[id].ssClose || 0), 0);
}

// Automatic benefit cut under current law if the gap is not closed.
export function ssCutByYear(selection) {
  const gap = Math.max(0, 1 - ssClosure(selection));
  return BASELINE.map((b) => b.year >= SS.insolvencyYear
    ? SS.outlays2026 * Math.pow(1 + SS.growth, b.year - 2026) * SS.oasiShare * SS.cutPct * gap : 0);
}

export function project(selection, opts = {}) {
  const ids = Object.keys(selection);
  const cut = opts.ssCurrentLaw ? ssCutByYear(selection) : BASELINE.map(() => 0);
  // Shocks from events (a recession, a default) add to a year's deficit.
  const shock = BASELINE.map((b) => (opts.shocks || []).reduce((a, x) => a + (x.year === b.year ? x.amount : 0), 0));
  const primary = BASELINE.map((_, i) =>
    ids.reduce((sum, id) => sum + tenYearOf(id, selection[id]) * (byId[id].front ? FRONT[i] : WEIGHTS[i]), 0) + cut[i] - shock[i]);
  let cumReduction = 0;
  let debt = OUTLOOK.debtEnd2026;
  const years = BASELINE.map((b, i) => {
    const interestSaved = cumReduction * b.avgRate;
    const deficit = b.deficit - primary[i] - interestSaved;
    cumReduction += primary[i] + interestSaved;
    debt += deficit;
    return {
      year: b.year, gdp: b.gdp,
      baseDeficit: b.deficit, deficit,
      baseDebt: b.debt, debt,
      primarySaved: primary[i], interestSaved,
      baseDebtPct: (b.debt / b.gdp) * 100, debtPct: (debt / b.gdp) * 100,
      deficitPct: (deficit / b.gdp) * 100,
    };
  });
  const last = years[years.length - 1];
  const sum = (k) => years.reduce((a, y) => a + y[k], 0);
  return {
    years,
    primarySaved: sum("primarySaved"),
    interestSaved: sum("interestSaved"),
    tenYearDeficits: sum("deficit"),
    baseTenYearDeficits: sum("baseDeficit"),
    debtPct2036: last.debtPct,
    baseDebtPct2036: last.baseDebtPct,
    deficitPct2036: last.deficitPct,
    ssCut: cut.reduce((a, b) => a + b, 0),
  };
}

// ── Public opinion ─────────────────────────────────────────
// A group's reaction to one policy = base popularity + the dot product of the
// policy's value loadings with the group's value profile, scaled by how far
// the policy is pushed. A package combines reactions with tanh so that piling
// on more of the same has diminishing effect.
export function policyScore(id, level, group) {
  const p = byId[id];
  let s = p.base;
  for (const [d, w] of Object.entries(p.vec)) s += w * (group.values[d] ?? 0);
  // Where Pew measured a group's view of the issue directly, use it.
  if (p.pew?.for) s += (p.pew.for[group.id] - 50) / 50;
  if (p.pew?.against) s += (50 - p.pew.against[group.id]) / 50;
  const intensity = intensityOf(p, level);
  // Hot-button issues (abortion, guns, deportation) move people more than tax tables.
  return clamp(s, -1.5, 1.5) * intensity * (p.salience ?? 1);
}

// ── Perception gap ─────────────────────────────────────────
// What a group believes about a policy on day one = its values reaction minus
// whatever the other side's media tells it. The other side attacks a policy
// only as hard as its own base dislikes it, scaled by how scary the frame is
// and how much of the group watches that media. Once enacted, people start to
// feel the real effect, and the attack fades:
//   effective = values - attack x (1 - drift) + material x drift
const ATTACK_SCALE = 1.2;   // game assumption
const MATERIAL_SCALE = 1.6; // game assumption
const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

export function perceptionOf(id) {
  const P = { ...DEFAULT_PERCEPTION, ...(PERCEPTION[id] || {}) };
  if (!P.frames) P.frames = [{ label: byId[id].name, risk: P.risk }];
  return P;
}
const intensityOf = (p, level) => (p.levels.length === 1 ? 1 : 0.5 + 0.5 * (level / (p.levels.length - 1)));

// How hard the opposition goes after a policy (0 to 1, before media reach).
export function attackStrength(id, level, sponsor, fr = {}) {
  const P = perceptionOf(id);
  const core = groupById[sponsor === "R" ? "ll" : "nar"];
  const dislike = clamp(-policyScore(id, level, core) / 1.2, 0, 1);
  const risk = (P.frames[fr.frame ?? 0] || P.frames[0]).risk;
  return dislike * risk * (fr.messenger ? 0.6 : 1);
}

export function policyParts(id, level, group, ctx = {}) {
  const p = byId[id];
  const P = perceptionOf(id);
  const values = policyScore(id, level, group);
  const intensity = intensityOf(p, level);
  const med = MEDIA[group.id];
  const reach = ctx.sponsor === "R" ? Math.max(med.cnn, med.npr) : med.fox;
  const attack = ctx.sponsor ? attackStrength(id, level, ctx.sponsor, ctx.framing?.[id]) * reach * ATTACK_SCALE * intensity : 0;
  const ex = EXPOSURE[group.id];
  const material = Object.entries(P.m).reduce((a, [k, v]) => a + v * (ex[k] ?? 0), 0) * MATERIAL_SCALE * intensity;
  // Heavy viewers of hostile media let go of the spin more slowly, and give
  // less credit for benefits they do feel (they may not know who to thank).
  const hostile = ctx.sponsor ? reach : 0;
  const d = drift(ctx.yearsById?.[id] ?? ctx.years ?? 0, P.tangible) * (1 - DRIFT_DRAG * hostile);
  const credit = 1 - CREDIT_LOSS * hostile;
  return { values, attack, material, drift: d, credit, effective: values - attack * (1 - d) + material * d * credit };
}

// Calibration (game assumptions):
const DRIFT_DRAG = 0.5;    // a group that is 100% hostile-media viewers drifts at half speed
const CREDIT_LOSS = 0.6;   // ...and credits only 40% of the benefit to the party that passed it
const PACKAGE_DAMP = 0.5;  // a package of n policies is judged as sum / n^0.5, not a plain sum
// Policy matters less to the vote than news events and the economy do.
const POLICY_VOTE_WEIGHT = 0.6;
// Attention: one policy barely registers at the ballot box; a big agenda does.
const attentionOf = (ids) => 1 - Math.exp(-ids.reduce((a, id) => a + (byId[id].salience ?? 1), 0) / 3);

// Sum one group's reaction to a whole package, split into its parts.
function groupRaw(selection, g, opts) {
  const ids = Object.keys(selection);
  const acc = { values: 0, attack: 0, material: 0, effective: 0, credited: 0 };
  for (const id of ids) {
    const r = policyParts(id, selection[id], g, opts);
    acc.values += r.values; acc.attack += r.attack; acc.material += r.material; acc.effective += r.effective;
  }
  // People judge a package as a whole: piling on more items has diminishing effect.
  // For the vote, scale by how much attention the agenda gets.
  const k = (ids.length > 1 ? Math.pow(ids.length, -PACKAGE_DAMP) : 1) * (opts.vote ? POLICY_VOTE_WEIGHT * attentionOf(ids) : 1);
  for (const key of ["values", "attack", "material", "effective"]) acc[key] *= k;
  // If the 2032 cut is allowed to happen, every group reacts to a benefit cut
  // in proportion to how much it values Social Security.
  const gap = opts.ssCurrentLaw ? Math.max(0, 1 - ssClosure(selection)) : 0;
  if (gap > 0) {
    const cut = clamp(-0.3 - 1.2 * (g.values.entitle ?? 0), -1.5, 1.5) * 1.5 * gap;
    acc.values += cut; acc.effective += cut;
  }
  // Event effects in Campaign mode (opinion of the party in charge).
  const m = opts.mood?.[g.id] || 0;
  if (m) { acc.values += m; acc.effective += m; }
  acc.any = ids.length > 0 || gap > 0 || m !== 0;
  return acc;
}

const squash = (x) => Math.tanh(x / 1.5);

// opts: { ssCurrentLaw, sponsor: "D" | "R", framing: { [id]: { frame, messenger } }, years }
export function groupScores(selection, opts = {}) {
  return Object.fromEntries(GROUPS.map((g) => {
    const r = groupRaw(selection, g, opts);
    return [g.id, r.any ? squash(r.effective) : 0];
  }));
}

// For the Perception tab: belief on day one, what people will actually feel,
// and where they land at the chosen time.
export function groupDetail(selection, opts = {}) {
  return GROUPS.map((g) => {
    const r = groupRaw(selection, g, opts);
    if (!r.any) return { g, belief: 0, reality: 0, now: 0, values: 0, attack: 0, material: 0 };
    return {
      g, values: r.values, attack: r.attack, material: r.material,
      belief: squash(r.values - r.attack),
      reality: squash(r.values + r.material),
      now: squash(r.effective),
    };
  });
}

const VOTER_WEIGHT = Object.fromEntries(GROUPS.map((g) => [g.id, g.share * g.turnout2024]));
const VW_SUM = Object.values(VOTER_WEIGHT).reduce((a, b) => a + b, 0);

// Swing curve (game assumption): nearly linear for ordinary plans, steeper when
// discontent or enthusiasm is broad. x is the average vote-relevant reaction among
// persuadable voters (-1 to 1). Ordinary plans: 1-3 points. A crisis: 8-12.
const SWING_LINEAR = 6.5, SWING_CUBIC = 14;
export const swingCurve = (x) => SWING_LINEAR * x + SWING_CUBIC * x * x * x;

// voteScores: group scores computed with { vote: true } (attention-weighted).
// Persuadable voters who mostly watch media hostile to the governing party are
// harder to move: partisan media locks in their vote.
export function publicSummary(scores, governingParty, voteScores = scores, envShift = 0) {
  const net = GROUPS.reduce((a, g) => a + scores[g.id] * VOTER_WEIGHT[g.id], 0) / VW_SUM;
  let num = 0, den = 0;
  for (const g of GROUPS) {
    const m = MEDIA[g.id];
    const hostile = governingParty === "R" ? Math.max(m.cnn, m.npr) : m.fox;
    const w = VOTER_WEIGHT[g.id] * g.persuadable * (1 - LOCK_IN * hostile);
    num += voteScores[g.id] * w; den += w;
  }
  const x = num / den;
  const swing = swingCurve(x);
  // envShift: the national mood the race starts from (positive = toward Democrats).
  const planSwing = governingParty === "D" ? swing : -swing;
  const demSwing = planSwing + envShift;
  return { net, x, swing, planSwing, envShift, demSwing, ev: electoralVotes(demSwing) };
}
const LOCK_IN = 0.3;

// How much hostile media stands between a group and the governing party.
export function mediaWall(gid, sponsor) {
  const m = MEDIA[gid];
  const hostile = sponsor === "R" ? Math.max(m.cnn, m.npr) : m.fox;
  return { hostile, credit: 1 - CREDIT_LOSS * hostile, speed: 1 - DRIFT_DRAG * hostile, persuade: 1 - LOCK_IN * hostile };
}

export function demographicScores(scores) {
  return DEMOGRAPHICS.map((lens) => ({
    lens: lens.lens,
    items: lens.items.map((it) => {
      const tot = Object.values(it.mix).reduce((a, b) => a + b, 0);
      const s = Object.entries(it.mix).reduce((a, [gid, pct]) => a + scores[gid] * pct, 0) / tot;
      return { ...it, score: s };
    }),
  }));
}

// ── Congress ───────────────────────────────────────────────
// Each party's caucus is made of typology "wings" in proportion to how many
// of that party's voters each group supplies. A wing votes yes in proportion
// to its reaction, shifted by party cues and any whipping you spend on.
function wings(party) {
  // Members answer to primary voters, so weight by engagement (turnout squared).
  const w = GROUPS.map((g) => ({ g, w: g.share * g.turnout2024 ** 2 * (party === "D" ? g.dem : g.rep) }));
  const s = w.reduce((a, x) => a + x.w, 0);
  return w.map((x) => ({ ...x, w: x.w / s }));
}
const WINGS = { D: wings("D"), R: wings("R") };

// How many of a party's seats each faction holds, rounded so they add up.
export function caucusSeats(party, size) {
  const raw = WINGS[party].map(({ g, w }) => ({ g, x: w * size }));
  const out = raw.map((r) => ({ g: r.g, seats: Math.floor(r.x), rem: r.x - Math.floor(r.x) }));
  let left = size - out.reduce((a, r) => a + r.seats, 0);
  [...out].sort((a, b) => b.rem - a.rem).slice(0, left).forEach((r) => r.seats++);
  return out.map(({ g, seats }) => ({ g, seats }));
}

// Each party's caucus by wing: how much of the caucus it is, and how it feels
// about what you have done. Wings under 5% of a caucus are folded out.
export function factions(scores) {
  return Object.fromEntries(["D", "R"].map((p) => [p, WINGS[p].filter((x) => x.w >= 0.05).sort((a, b) => b.w - a.w).map(({ g, w }) => ({ g, strength: w, mood: scores[g.id] }))]));
}

// whip may hold per-wing pressure under "w_<groupId>" from targeted whipping.
function wingYes(scores, g, cue, whip = {}) {
  return clamp(0.5 + 0.75 * (scores[g.id] + cue + (whip["w_" + g.id] || 0)), 0, 1);
}
function yesShare(party, scores, cue, whip) {
  return WINGS[party].reduce((a, { g, w }) => a + w * wingYes(scores, g, cue, whip), 0);
}

// The President's own view of a bill: his priorities, blended with his base.
// One item he hates weighs heavily.
export function presidentView(ids, scores) {
  const st = ids.map((id) => PRESIDENT_STANCE[id]).filter((x) => x !== undefined);
  const base = 0.6 * scores.nar + 0.4 * scores.ffc;
  if (!st.length) return { score: base, stance: null };
  const mean = st.reduce((a, b) => a + b, 0) / st.length;
  const stance = mean + 0.5 * Math.min(0, ...st);
  return { score: 0.4 * base + 0.6 * stance, stance };
}

// For targeted whipping: each wing of a party, how many are already yes, and how open the rest are.
export function wingsFor(party, scores, cue, whip = {}) {
  return WINGS[party].map(({ g, w }) => {
    const yes = wingYes(scores, g, cue, whip);
    return { g, w, yes, open: scores[g.id] + 0.5 * (1 - Math.abs(yes - 0.5) * 2) };
  });
}

export function billScores(ids, selection, ctx = {}) {
  const sub = Object.fromEntries(ids.map((id) => [id, selection[id]]));
  return groupScores(sub, ctx);
}

// Tax increases (not tariffs) that trigger the anti-tax pledge.
const TAX_HIKES = new Set(["corp_rate", "top_rate", "all_rates", "niit", "cap_gains", "step_up", "ss_payroll_250k", "itemized", "vat", "carbon", "ftt", "gas_tax", "intl_corp", "wealth_tax", "irs", "carried_interest", "buyback_tax", "datacenter", "ss_rate"]);
export const TAX_PLEDGE = 0.35;
export const OVERRIDE_PULL = 0.2;

// pres: your standing with the President. rapport (-1..1) carries across bills;
// sway is what a meeting about this bill won; trade means one of his priorities rides along.
export function voteOnBill({ ids, selection, route, whip = {}, role, framing = {}, boost = {}, pres = {} }) {
  const sponsor = role === "white_house" ? "R" : "D";
  // Members vote on what their voters believe today, not what they will feel in two years.
  const scores = billScores(ids, selection, { sponsor, framing, years: 0 });
  // A cross-party cosponsor gives the other side cover to vote yes.
  const messenger = ids.some((id) => framing[id]?.messenger);
  // Events (a scandal, a shooting) can put pressure on members of both parties for a quarter.
  const push = Math.max(0, ...ids.map((id) => boost[id] || 0));
  // Party cues: members strongly follow their own leadership and resist the other side's bills.
  // Members also resist rules that limit themselves (stock bans, term limits).
  const insider = Math.max(0, ...ids.map((id) => byId[id].insider || 0));
  // Must-pass bills (the debt limit) get far less resistance from the other party.
  // Only a clean bill gets this; attach other items and it becomes a partisan fight.
  const mustPass = ids.every((id) => byId[id].mustPass);
  // Riders: other items attached to a must-pass bill. Blocking it means a default,
  // so both the other party and the President swallow more than usual.
  const rider = !mustPass && ids.some((id) => byId[id].mustPass);
  // Bills written by both parties (co-led in committee) draw far less resistance from the other side.
  const bipart = ids.every((id) => byId[id].bipartisan);
  const pv = presidentView(ids, scores);
  // He is easiest to move where he has no fixed view; firm stances barely budge.
  const st = ids.map((id) => PRESIDENT_STANCE[id]).filter((x) => x !== undefined);
  const flex = st.length ? 1 - 0.7 * (st.reduce((a, x) => a + Math.abs(x), 0) / st.length) : 1;
  const sway = (pres.sway || 0) * flex;
  const presBonus = role === "white_house" ? 0 : 0.2 * (pres.rapport || 0) + sway + (pres.trade ? 0.15 : 0);
  // Republican members feel the President's pull on what he cares about.
  const presPull = pv.stance === null ? 0 : PRESIDENT_PULL * pv.stance;
  // Most Republicans in Congress have signed the Taxpayer Protection Pledge and vote
  // against tax increases almost as a bloc, whatever their voters say in polls.
  const taxHike = ids.some((id) => TAX_HIKES.has(id) && tenYearOf(id, selection[id]) > 0);
  // Reconciliation bills are party-line affairs: the other side has no say in writing them.
  const partisanRoute = route === "reconciliation" ? -0.2 : 0;
  // Once he says he likes it, Republicans in Congress follow.
  const blessing = role === "white_house" ? 0 : Math.max(0, sway + (pres.trade ? 0.1 : 0)) * 0.5;
  const cue = (party) => (party === sponsor ? 0.35 : (mustPass ? -0.05 : rider ? -0.3 : bipart ? -0.15 : -0.45) + (messenger ? 0.15 : 0) + partisanRoute) + (whip[party] || 0) + push - insider + (party === "R" ? presPull + blessing - (taxHike ? TAX_PLEDGE : 0) : 0);
  // The same pressures, itemized: why members vote differently from their voters.
  const pressures = (party) => {
    const own = party === sponsor;
    const list = [
      [own ? "Their party's leaders back it" : mustPass ? "Must-pass: blocking it risks a default" : rider ? "Riding on a must-pass bill" : bipart ? "Co-written by both parties" : "The other party's bill", own ? 0.35 : mustPass ? -0.05 : rider ? -0.3 : bipart ? -0.15 : -0.45],
      !own && messenger && ["Cross-party cosponsor gives cover", 0.15],
      !own && partisanRoute && ["Reconciliation is a party-line fight", partisanRoute],
      whip[party] && ["Your whipping and public pitches", whip[party]],
      push && ["Events this quarter", push],
      insider && ["It limits members themselves", -insider],
      party === "R" && presPull + blessing && ["The President's position", presPull + blessing],
      party === "R" && taxHike && ["Anti-tax pledge", -TAX_PLEDGE],
    ];
    return list.filter((x) => x && Math.abs(x[1]) >= 0.01);
  };
  const tally = (ch) => {
    const D = Math.round(CONGRESS[ch].D * yesShare("D", scores, cue("D"), whip));
    const R = Math.round(CONGRESS[ch].R * yesShare("R", scores, cue("R"), whip));
    return { D, R, yes: D + R };
  };
  const house = tally("house");
  const senate = tally("senate");
  const amendment = route === "amendment";
  // War powers resolutions are privileged: no filibuster.
  const simple = ids.every((id) => byId[id].simpleMajority);
  const senateNeed = route === "reconciliation" || simple ? CONGRESS.senate.majority : amendment ? CONGRESS.senate.override : CONGRESS.senate.cloture;
  const houseNeed = amendment ? CONGRESS.house.override : CONGRESS.house.majority;
  const passesHouse = house.yes >= houseNeed;
  const passesSenate = senate.yes >= senateNeed;
  // The President's decision is modeled on the two groups at the core of his
  // coalition. If you are the White House, you sign your own bills.
  const presScore = pv.score + presBonus;
  // A bill that limits the President himself gets vetoed, whoever sends it.
  const coversPresident = ids.some((id) => byId[id].levels[selection[id]]?.presVeto);
  // The President won't hand Democrats a win his own voters don't actively want.
  // A Republican cosponsor makes it a shared win and lowers the bar.
  const routine = ids.every((id) => byId[id].routine);
  const creditBar = sponsor === "D" && !mustPass && !routine ? (messenger || bipart ? 0 : 0.1) : -0.05;
  // Constitutional amendments skip the President and go to the states.
  const bar = rider ? -0.3 : creditBar;
  const signs = amendment || (!coversPresident && (mustPass || role === "white_house" || presScore >= bar));
  const vetoReason = signs ? null : coversPresident ? "covers" : rider ? "rider" : presScore >= -0.05 ? "credit" : "policy";
  // If you're the White House, Democratic leaders decide what reaches the floor.
  const dLead = 0.5 * scores.ll + 0.3 * scores.lp + 0.2 * scores.ool;
  const floorBlocked = role === "white_house" && !mustPass && !messenger && dLead < 0.05;
  // On a veto override, members of the President's party face extra pressure to stand with him.
  const presParty = CONGRESS.president.party;
  // Some members of his party who vote yes won't defy him once he vetoes.
  const overTally = (ch) => {
    const v = { D: 0, R: 0 };
    for (const p of ["D", "R"]) v[p] = Math.round(CONGRESS[ch][p] * yesShare(p, scores, cue(p) - (p === presParty ? OVERRIDE_PULL : 0), whip));
    return { ...v, yes: v.D + v.R };
  };
  const overHouse = overTally("house"), overSenate = overTally("senate");
  const overridable = role !== "white_house" && overHouse.yes >= CONGRESS.house.override && overSenate.yes >= CONGRESS.senate.override;
  const passes = !floorBlocked && passesHouse && passesSenate;
  return { scores, cueD: cue("D"), cueR: cue("R"), presStance: pv.stance, house, senate, senateNeed, houseNeed, amendment, passesHouse, passesSenate, passes, signs, vetoReason, floorBlocked, insider, presScore, presBar: bar, taxPledge: taxHike, pressures: { D: pressures("D"), R: pressures("R") }, rider, flex, overridable, overHouse, overSenate, vetoed: passes && !signs, enacted: passes && signs };
}

// ── Goals (Fiscal Ship style) ──────────────────────────────
export const GOALS = [
  { id: "stabilize", label: "Stabilize the debt", desc: "Debt in 2036 no higher than today's 101% of GDP",
    test: (ctx) => ctx.proj.debtPct2036 <= OUTLOOK.debtPctGdp2026 },
  { id: "three", label: "Deficit at 3% of GDP", desc: "The target many budget experts use",
    test: (ctx) => ctx.proj.deficitPct2036 <= 3 },
  { id: "shrink", label: "Shrink government", desc: "At least $2T in spending cuts and no new spending",
    test: (ctx) => ctx.cuts >= 2000 && ctx.spend === 0 },
  { id: "inequality", label: "Reduce inequality", desc: "$2T+ from taxes on high earners, no cuts to safety-net programs",
    test: (ctx) => ctx.taxRichRev >= 2000 && !ctx.hits.govSizeCut },
  { id: "retirees", label: "Protect retirees", desc: "No cuts to Social Security or Medicare benefits",
    test: (ctx) => !ctx.hits.entitleCut },
  { id: "middle", label: "No middle-class tax increase", desc: "No broad-based taxes",
    test: (ctx) => !ctx.hits.broadTax },
  { id: "defense", label: "Strong defense", desc: "No defense cuts",
    test: (ctx) => !ctx.hits.defenseCut },
  { id: "climate", label: "Act on climate", desc: "At least one climate policy enacted",
    test: (ctx) => ctx.hits.climate },
  ...AGENDA_GOALS.map((g) => ({ ...g, area: "agenda", test: (ctx) => ctx.hits[g.hit] })),
];

export function goalContext(selection, proj, opts = {}) {
  let cuts = 0, spend = 0, taxRichRev = 0;
  const hits = { govSizeCut: false, entitleCut: false, broadTax: false, defenseCut: false, climate: false };
  const has = (id) => id in selection;
  let gunLimit = false;
  for (const [id, lv] of Object.entries(selection)) {
    const p = byId[id], v = p.vec, amt = tenYearOf(id, lv);
    if (p.category === "cut") cuts += amt;
    if (p.category === "spend" || (p.category === "agenda" && amt < 0)) spend += -amt;
    if ((v.guns || 0) <= -0.3) gunLimit = true;
    if ((v.taxRich || 0) >= 0.6 && p.category === "revenue") taxRichRev += amt;
    if ((v.govSize || 0) <= -0.5) hits.govSizeCut = true;
    if ((v.entitle || 0) <= -0.5) hits.entitleCut = true;
    if ((v.broadTax || 0) >= 0.4) hits.broadTax = true;
    if ((v.defense || 0) <= -0.5) hits.defenseCut = true;
    if ((v.climate || 0) >= 0.5) hits.climate = true;
  }
  Object.assign(hits, {
    border: has("deport"),
    pathway: has("immigration"),
    gunSafety: gunLimit,
    gunRights: !gunLimit && has("carry_reciprocity"),
    abortionRights: has("codify_roe"),
    protectLife: has("abortion_15wk"),
    cleanGov: has("stock_ban") || has("term_limits"),
    americaFirst: !has("ukraine") && !has("immigration") && (has("foreign_aid") || has("nato_exit")),
    ssFixed: ssClosure(selection) >= 1,
    endWar: has("war_powers") && !has("iran_supp"),
    noDefault: has("debt_limit"),
  });
  if (opts.ssCurrentLaw && ssClosure(selection) < 1) hits.entitleCut = true;
  return { proj, cuts, spend, taxRichRev, hits };
}

// ── Polls: "if the election were held now" ─────────────────
const TRUMP_2024 = Object.fromEntries(GROUPS.map((g) => {
  const m = /(\d+)%\s*(Trump|Harris)/.exec(g.vote2024 || "");
  return [g.id, !m ? 0.5 : m[2] === "Trump" ? Number(m[1]) / 100 : 1 - Number(m[1]) / 100];
}));
const NATIONAL_D_2024 = 49.25; // two-party share: Trump won the 2024 popular vote by about 1.5 points

// Spread the national swing across groups by how much each one moves, then
// add the starting mood evenly. Returns two-party Democratic share by group.
export function pollByGroup(voteScores, pub, governingParty) {
  const sign = governingParty === "D" ? 1 : -1;
  const w = Object.fromEntries(GROUPS.map((g) => [g.id, mediaWall(g.id, governingParty).persuade * g.persuadable]));
  const wAvg = GROUPS.reduce((a, g) => a + VOTER_WEIGHT[g.id] * w[g.id], 0) / VW_SUM;
  const raw = Object.fromEntries(GROUPS.map((g) => [g.id, sign * swingCurve(voteScores[g.id]) * w[g.id] / wAvg]));
  const mean = GROUPS.reduce((a, g) => a + VOTER_WEIGHT[g.id] * raw[g.id], 0) / VW_SUM;
  const fit = (v) => (Math.abs(mean) > 0.05 ? v * clamp(pub.planSwing / mean, 0, 3) : v + (pub.planSwing - mean));
  const groups = Object.fromEntries(GROUPS.map((g) => [g.id, clamp(100 * (1 - TRUMP_2024[g.id]) + (fit(raw[g.id]) + pub.envShift) / 2, 1, 99)]));
  return { national: clamp(NATIONAL_D_2024 + pub.demSwing / 2, 1, 99), groups };
}
