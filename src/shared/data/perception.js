// Phase 3: the perception gap.
// Each policy has two effects on a group:
//   belief     = the group's values reaction, minus whatever the other side's
//                media convinces them the policy does (an "attack")
//   experience = what the policy actually does to people like them
// After a policy takes effect, the attack fades and experience takes over.

import { DEMOGRAPHICS } from "./typology.js";

// Where each group gets news. Fox, CNN and NPR shares for the groups Pew
// reported are from Pew's 2026 typology report (March 2025 news survey).
// Values marked est are game estimates where Pew did not report the figure.
export const MEDIA = {
  nar: { fox: 0.73, cnn: 0.09, npr: 0.05 /* est */ },
  ffc: { fox: 0.65, cnn: 0.13, npr: 0.06 /* est */ },
  ur:  { fox: 0.48, cnn: 0.20 /* est */, npr: 0.10 /* est */ },
  ppr: { fox: 0.38, cnn: 0.30 /* est */, npr: 0.20 /* est */ },
  tom: { fox: 0.42, cnn: 0.30 /* est */, npr: 0.08 /* est */ },
  ool: { fox: 0.32, cnn: 0.46, npr: 0.15 /* est */ },
  lol: { fox: 0.23, cnn: 0.30 /* est */, npr: 0.20 /* est */ },
  ll:  { fox: 0.10, cnn: 0.51, npr: 0.58 },
  lp:  { fox: 0.04, cnn: 0.35 /* est */, npr: 0.47 },
};
export const MEDIA_SOURCE = "Pew Research Center 2026 typology report (news sources survey, March 2025). Some shares are game estimates.";

// Share of each group's members who are seniors, computed from Pew's age
// table and approximate adult age shares (18-29: 20%, 30-49: 33%, 50-64: 24%, 65+: 23%).
const ageMix = DEMOGRAPHICS.find((d) => d.lens === "Age").items;
const ADULT = { a18: 0.20, a30: 0.33, a50: 0.24, a65: 0.23 };
const seniorShare = (gid) => {
  const total = ageMix.reduce((a, it) => a + it.mix[gid] * ADULT[it.id], 0);
  return (ageMix.find((it) => it.id === "a65").mix[gid] * ADULT.a65) / total;
};

// How exposed each group is to each kind of material effect (0 to 1).
// seniors: computed from Pew. lowIncome for Tuned-Out Middle (56%) and rural for
// Faith First Conservatives (41%) are from Pew; the rest are game estimates.
const RAW = {
  nar: { lowIncome: 0.25, highIncome: 0.20, rural: 0.35, families: 0.25 },
  ffc: { lowIncome: 0.30, highIncome: 0.15, rural: 0.41, families: 0.30 },
  ur:  { lowIncome: 0.35, highIncome: 0.12, rural: 0.25, families: 0.40 },
  ppr: { lowIncome: 0.20, highIncome: 0.25, rural: 0.20, families: 0.15 },
  tom: { lowIncome: 0.56, highIncome: 0.03, rural: 0.15, families: 0.40 },
  ool: { lowIncome: 0.45, highIncome: 0.08, rural: 0.15, families: 0.40 },
  lol: { lowIncome: 0.45, highIncome: 0.05, rural: 0.15, families: 0.45 },
  ll:  { lowIncome: 0.15, highIncome: 0.30, rural: 0.10, families: 0.25 },
  lp:  { lowIncome: 0.30, highIncome: 0.15, rural: 0.08, families: 0.35 },
};
export const EXPOSURE = Object.fromEntries(Object.entries(RAW).map(([gid, e]) => [gid, { ...e, seniors: seniorShare(gid) }]));

export const EXPOSURE_LABELS = { lowIncome: "Lower-income households", highIncome: "High earners", rural: "Rural residents", families: "Parents of children", seniors: "Seniors" };

// Per-policy perception data.
// m: material effect by exposure type (-1 to 1). risk: how easily the other
// side's media can paint it as something scary (0 to 1), per frame.
// tangible: how quickly people feel the real effect once enacted.
const f = (label, risk) => ({ label, risk });
export const PERCEPTION = {
  corp_rate: { m: { highIncome: -0.3 }, frames: [f("Corporate tax increase", 0.35), f("Make big corporations pay their fair share", 0.25)], tangible: "slow" },
  top_rate: { m: { highIncome: -0.4 }, frames: [f("Raise the top tax rate", 0.35), f("End the tax break for millionaires", 0.25)], tangible: "slow" },
  all_rates: { m: { lowIncome: -0.3, highIncome: -0.3, families: -0.2 }, frames: [f("Income tax increase", 0.5)], tangible: "fast" },
  niit: { m: { highIncome: -0.3 }, frames: [f("Close the pass-through loophole", 0.3)], tangible: "slow" },
  cap_gains: { m: { highIncome: -0.3 }, frames: [f("Capital gains tax increase", 0.4), f("Tax investment income like work", 0.3)], tangible: "slow" },
  step_up: { m: { highIncome: -0.2, rural: -0.1 }, frames: [f("End stepped-up basis", 0.45), f("Close the inherited-wealth loophole", 0.35)], tangible: "slow" },
  ss_payroll_250k: { m: { highIncome: -0.5, seniors: 0.3 }, frames: [f("Lift the payroll tax cap", 0.35), f("Make the rich pay into Social Security", 0.25)], tangible: "medium" },
  itemized: { m: { highIncome: -0.6, families: -0.2 }, frames: [f("Eliminate deductions", 0.6)], tangible: "fast" },
  vat: { m: { lowIncome: -0.6, seniors: -0.3, families: -0.3 }, frames: [f("National sales tax", 0.6), f("Value-added tax with household rebates", 0.45)], tangible: "fast" },
  carbon: { m: { rural: -0.6, lowIncome: -0.4 }, frames: [f("Carbon tax", 0.75), f("Make polluters pay", 0.55), f("Carbon dividend: checks to every household", 0.5)], tangible: "fast" },
  ftt: { m: { highIncome: -0.2 }, frames: [f("Wall Street speculation tax", 0.3)], tangible: "slow" },
  gas_tax: { m: { rural: -0.5, lowIncome: -0.3 }, frames: [f("Gas tax increase", 0.6), f("Fix our roads and bridges fund", 0.45)], tangible: "fast" },
  wealth_tax: { m: { highIncome: -0.2 }, frames: [f("Wealth tax", 0.45), f("Billionaire minimum tax", 0.25)], tangible: "slow" },
  irs: { m: { highIncome: -0.1 }, frames: [f("IRS funding", 0.6), f("Make tax cheats pay what they owe", 0.35)], tangible: "slow" },
  tariffs_up: { m: { lowIncome: -0.4, rural: -0.3, families: -0.3 }, frames: [f("Tariffs", 0.55), f("Make foreign countries pay", 0.4)], tangible: "fast" },
  immigration: { m: {}, frames: [f("Comprehensive immigration reform", 0.8), f("Earned legal status with border security", 0.55)], tangible: "slow" },
  defense_cut: { m: {}, frames: [f("Cut defense", 0.6), f("End Pentagon waste", 0.35)], tangible: "slow" },
  medicare_adv: { m: { seniors: -0.3 }, frames: [f("Medicare Advantage cuts", 0.6), f("Stop insurer overbilling", 0.35)], tangible: "medium" },
  medicaid_cap: { m: { lowIncome: -0.8, seniors: -0.3, families: -0.3 }, frames: [f("Medicaid cuts", 0.6), f("Give states flexibility", 0.4)], tangible: "fast" },
  partb: { m: { seniors: -0.7 }, frames: [f("Higher Medicare premiums", 0.4)], tangible: "fast" },
  site_neutral: { m: { seniors: 0.1 }, frames: [f("Same price for the same service", 0.15)], tangible: "medium" },
  drug_neg: { m: { seniors: 0.7 }, frames: [f("Lower drug prices", 0.1)], tangible: "fast" },
  ss_age: { m: { seniors: -0.4, lowIncome: -0.3 }, frames: [f("Raise the retirement age", 0.3), f("Modernize retirement for longer lives", 0.25)], tangible: "medium" },
  chained_cpi: { m: { seniors: -0.5 }, frames: [f("Social Security benefit cut", 0.35), f("A more accurate inflation measure", 0.3)], tangible: "medium" },
  ss_progressive: { m: { highIncome: -0.2 }, frames: [f("Means-test Social Security", 0.4), f("Protect benefits for those who need them", 0.3)], tangible: "slow" },
  ndd_grants: { m: { lowIncome: -0.3, families: -0.3 }, frames: [f("Cut education and transit grants", 0.5), f("Return power to the states", 0.35)], tangible: "medium" },
  aca: { m: { lowIncome: 0.6, families: 0.3, rural: 0.2 }, frames: [f("Obamacare subsidies", 0.55), f("Lower premiums for working families", 0.3)], tangible: "fast" },
  ctc: { m: { families: 0.9, lowIncome: 0.5 }, frames: [f("Expanded Child Tax Credit", 0.45), f("Family tax cut", 0.25)], tangible: "fast" },
  public_option: { m: { lowIncome: 0.5 }, frames: [f("Government-run health plan", 0.65), f("Medicare Choice", 0.35)], tangible: "medium" },
  m4a: { m: { lowIncome: 0.9, families: 0.5, highIncome: -0.4 }, frames: [f("Medicare for All", 0.8), f("Guaranteed health care, no medical bills", 0.55), f("American Health Security Act", 0.5)], tangible: "fast" },
  infrastructure: { m: { rural: 0.3, lowIncome: 0.1 }, frames: [f("Infrastructure spending", 0.3), f("Rebuild America", 0.2)], tangible: "slow" },
  student_debt: { m: { lowIncome: 0.2, families: 0.2 }, frames: [f("Student debt cancellation", 0.6), f("Relief for public servants and Pell grantees", 0.4)], tangible: "fast" },
  clean_energy: { m: { rural: 0.2 }, frames: [f("Green energy subsidies", 0.65), f("American energy manufacturing jobs", 0.4)], tangible: "slow" },
  no_tax_ss: { m: { seniors: 0.6 }, frames: [f("No tax on Social Security", 0.2)], tangible: "fast" },
  ss_rate: { m: { lowIncome: -0.3, families: -0.3, seniors: 0.4 }, frames: [f("Payroll tax increase", 0.5), f("Save Social Security", 0.35)], tangible: "fast" },
  pbm: { m: { seniors: 0.2 }, frames: [f("Crack down on drug middlemen", 0.15)], tangible: "medium" },
  tariff_repeal: { m: { lowIncome: 0.4, rural: 0.3, families: 0.3 }, frames: [f("Repeal tariffs", 0.5), f("Cut prices at the checkout", 0.35)], tangible: "fast" },
  childcare: { m: { families: 0.7 }, frames: [f("Child care subsidies", 0.4), f("Help working parents", 0.25)], tangible: "fast" },
  home_sale: { m: { highIncome: 0.2, seniors: 0.2 }, frames: [f("Tax break for home sellers", 0.4), f("Unlock housing for young families", 0.3)], tangible: "medium" },
  health_extenders: { m: { rural: 0.2, lowIncome: 0.2 }, frames: [f("Keep community clinics open", 0.15)], tangible: "medium" },
  highways: { m: { rural: 0.2 }, frames: [f("Highway bill", 0.2)], tangible: "slow" },
  iran_supp: { m: {}, frames: [f("War funding", 0.6), f("Restock our defenses", 0.4)], tangible: "slow" },
  deport: { m: { lowIncome: -0.1 }, frames: [f("Mass deportation", 0.7), f("Remove criminals first", 0.4)], tangible: "medium" },
  community_college: { m: { families: 0.3, lowIncome: 0.3 }, frames: [f("Free college", 0.5), f("Job training at community colleges", 0.3)], tangible: "medium" },
  school_choice: { m: { families: 0.3 }, frames: [f("Vouchers", 0.55), f("Let parents choose their school", 0.35)], tangible: "medium" },
  codify_roe: { m: {}, frames: [f("Codify Roe", 0.5), f("Keep politicians out of medical decisions", 0.4)], tangible: "slow" },
  abortion_15wk: { m: {}, frames: [f("National abortion ban", 0.7), f("15-week limit with exceptions", 0.5)], tangible: "slow" },
  aw_ban: { m: {}, frames: [f("Assault weapons ban", 0.6), f("Keep weapons of war off our streets", 0.5)], tangible: "slow" },
};

export const DEFAULT_PERCEPTION = { m: {}, frames: null, tangible: "medium", risk: 0.3 };

// How much of the gap between belief and experience closes, by years since enactment.
// Fast-felt policies (a premium drop, a tax credit check) close the gap sooner.
const CURVE = { 0: 0, 1: 0.2, 2: 0.4, 4: 0.7 };
const SPEED = { fast: 1.3, medium: 1, slow: 0.6 };
export function drift(years, tangible) {
  const keys = Object.keys(CURVE).map(Number);
  let base = 0;
  for (let i = 0; i < keys.length; i++) {
    if (years >= keys[i]) base = CURVE[keys[i]];
    if (years > keys[i] && keys[i + 1] !== undefined && years < keys[i + 1]) {
      const t = (years - keys[i]) / (keys[i + 1] - keys[i]);
      base = CURVE[keys[i]] + t * (CURVE[keys[i + 1]] - CURVE[keys[i]]);
    }
  }
  return Math.min(0.9, base * (SPEED[tangible] ?? 1));
}

// Years from enactment (early 2027) to the November 2028 election.
export const YEARS_TO_ELECTION = 1.75;
