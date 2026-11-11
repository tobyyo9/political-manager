// Interest groups and donors. Names are invented; the types and their tactics are modeled on real ones.
// cares: policy id -> +1 (wants it passed) or -1 (wants it killed).
// leans: who depends on the group. party "D" | "R" | "any"; wing = which end of that party listens most
// ("base" = safe seats and ideologues, "swing" = competitive seats, "all").
// tactic: "primary" groups fund challengers when crossed; "general" groups spend in the fall; "score" groups publish grades.
export const IGROUPS = [
  { id: "alliance", name: "Citizens for a Secure Alliance", model: "single-issue foreign policy lobby", party: "any", wing: "all", power: 0.9, budget: 900, tactic: "primary",
    cares: { war_powers: -1, iran_supp: 1, foreign_aid: 1, defense_cut: -1 }, note: "Spends heavily in primaries, in either party, on a short list of foreign policy votes." },
  { id: "lowtax", name: "Americans for Lower Taxes", model: "anti-tax pledge group", party: "R", wing: "all", power: 1, budget: 300, tactic: "primary",
    cares: { corp_rate: -1, top_rate: -1, wealth_tax: -1, carbon: -1, cap_gains: -1, all_rates: -1, vat: -1, gas_tax: -1, irs: -1, buyback_tax: -1 }, note: "Keeps the no-new-taxes pledge. Breaking it brings a challenger." },
  { id: "growth", name: "The Prosperity Club", model: "conservative primary enforcers", party: "R", wing: "base", power: 0.8, budget: 700, tactic: "primary",
    cares: { medicaid_restore: -1, aca: -1, min_wage: -1, debt_limit: -1, medicaid_cap: 1, ndd_grants: 1, tariffs_up: -1 }, note: "Funds challengers to Republicans who vote for spending." },
  { id: "insurgent", name: "New Majority Project", model: "progressive insurgents", party: "D", wing: "base", power: 0.7, budget: 350, tactic: "primary",
    cares: { m4a: 1, wealth_tax: 1, war_powers: 1, ice_limits: 1, iran_supp: -1, deport: -1, chained_cpi: -1, ss_age: -1 }, note: "Recruits challengers in safe Democratic seats." },
  { id: "pharma", name: "PharmaForward", model: "drug industry lobby", party: "any", wing: "all", power: 0.5, budget: 800, tactic: "general",
    cares: { drug_neg: -1, pbm: 1, m4a: -1, public_option: -1 }, note: "Donations, ads, and lobbyists with draft text." },
  { id: "energy", name: "The Frontier Energy Alliance", model: "oil and gas lobby", party: "R", wing: "all", power: 0.6, budget: 700, tactic: "general",
    cares: { carbon: -1, clean_energy: -1, permitting: 1, gas_tax: -1 }, note: "Strongest with members from energy states." },
  { id: "tech", name: "The Digital Future PAC", model: "tech and crypto money", party: "any", wing: "swing", power: 0.3, budget: 1000, tactic: "general",
    cares: { kids_online: -1, ai_rules: -1, ratepayer: -1, datacenter: -1 }, note: "New, rich, and willing to spend against anyone." },
  { id: "defense", name: "Arsenal Industries Council", model: "defense contractors", party: "any", wing: "all", power: 0.4, budget: 500, tactic: "general",
    cares: { defense_up: 1, defense_cut: -1, iran_supp: 1 }, note: "Jobs in a lot of districts." },
  { id: "chamber", name: "The National Enterprise Federation", model: "business federation", party: "R", wing: "swing", power: 0.5, budget: 600, tactic: "score",
    cares: { corp_rate: -1, min_wage: -1, price_gouging: -1, permitting: 1, tariff_repeal: 1, immigration: 1 }, note: "Endorsements and a scorecard donors read." },
  { id: "labor", name: "United Workers Federation", model: "unions", party: "D", wing: "all", power: 0.8, budget: 500, tactic: "general",
    cares: { min_wage: 1, medicaid_restore: 1, childcare: 1, chained_cpi: -1, ss_age: -1, tariff_repeal: -1 }, note: "Volunteers and turnout as much as money." },
  { id: "guns", name: "The Liberty Arms Association", model: "gun rights group", party: "R", wing: "all", power: 0.8, budget: 300, tactic: "score",
    cares: { background_checks: -1, aw_ban: -1, red_flag: -1, carry_reciprocity: 1 }, note: "A letter grade its voters recognize." },
  { id: "gunsafety", name: "Safer Communities Now", model: "gun safety group", party: "D", wing: "all", power: 0.5, budget: 400, tactic: "score",
    cares: { background_checks: 1, aw_ban: 1, red_flag: 1, carry_reciprocity: -1 }, note: "Grades members and spends in suburbs." },
  { id: "choice", name: "Reproductive Freedom Fund", model: "abortion rights group", party: "D", wing: "all", power: 0.7, budget: 500, tactic: "general",
    cares: { codify_roe: 1, abortion_15wk: -1 }, note: "Endorsements that move primary voters." },
  { id: "life", name: "Family First Coalition", model: "anti-abortion group", party: "R", wing: "base", power: 0.7, budget: 300, tactic: "primary",
    cares: { abortion_15wk: 1, codify_roe: -1, gender_care: 1 }, note: "Strong with religious conservatives." },
  { id: "green", name: "Clean Future Voters", model: "environmental group", party: "D", wing: "all", power: 0.5, budget: 400, tactic: "score",
    cares: { clean_energy: 1, carbon: 1, permitting: -1 }, note: "A scorecard and activist pressure." },
  { id: "seniors", name: "The Retirees' League", model: "seniors' lobby", party: "any", wing: "swing", power: 0.9, budget: 200, tactic: "score",
    cares: { ss_age: -1, chained_cpi: -1, partb: -1, drug_neg: 1, ss_payroll_250k: 1, no_tax_ss: 1 }, note: "Mail to older voters, who turn out." },
  { id: "border", name: "Secure Borders Action", model: "immigration restriction group", party: "R", wing: "base", power: 0.6, budget: 250, tactic: "primary",
    cares: { deport: 1, immigration: -1, ice_limits: -1, save_act: 1 }, note: "Punishes any vote that looks like amnesty." },
  { id: "reform", name: "Clean Government Project", model: "good-government group", party: "any", wing: "swing", power: 0.3, budget: 150, tactic: "score",
    cares: { stock_ban: 1, ethics: 1, pardon_reform: 1, voting_rights: 1 }, note: "Little money, but its grades make the local paper." },
];
const CORPORATE = new Set(["pharma", "energy", "tech", "defense", "chamber", "alliance"]);
export const groupById = Object.fromEntries(IGROUPS.map((g) => [g.id, g]));

// How much a member depends on a group, 0 to 1: party fit, which wing they sit in, and a little personal history.
export function dependence(m, g, noise) {
  if (g.party !== "any" && g.party !== m.p) return 0;
  const wing = g.wing === "all" ? 0.8 : g.wing === "base" ? 0.35 + 0.65 * m.prisk : 0.35 + 0.65 * m.vuln;
  const personal = 0.75 + 0.25 * noise(m.id + g.id);
  // Money: members who live on PAC checks listen harder to the industries that write them; small-dollar members listen less.
  const F = m.fund, corp = CORPORATE.has(g.id);
  const money = !F ? 1 : corp ? (F.pledge ? 0.45 : (0.6 + 1.2 * F.pac) * (F.sectors.includes(g.id) ? 1.35 : 1)) : g.id === "labor" ? 0.8 + 0.5 * F.small : 1;
  return Math.max(0, Math.min(1, g.power * wing * personal * money));
}
// The G term for one member on one bill: what the groups they rely on want, weighted by how much they rely on them.
export function groupPull(m, pid, noise) {
  let s = 0; const who = [];
  for (const g of IGROUPS) {
    const st = g.cares[pid]; if (!st) continue;
    const d = dependence(m, g, noise); if (d < 0.05) continue;
    s += st * d; who.push({ g: g.id, v: st * d });
  }
  return { G: Math.max(-1, Math.min(1, s)), who };
}
