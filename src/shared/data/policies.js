// Policy menu.
// tenYear: 10-year deficit effect in $B. Positive = reduces deficits.
// Most scores come from CBO "Options for Reducing the Deficit: 2025 to 2034"
// (Dec 2024). They were estimated before the 2025 reconciliation act and use
// a 2025-2034 window, so the engine applies WINDOW_ADJUST to move them to
// 2027-2036 and flags options the 2025 law changed.
//
// vec: how the policy loads on the value dimensions in typology.js.
// base: across-the-board popularity independent of ideology (from polling
// where noted, otherwise an estimate).
// reconcilable: can pass through budget reconciliation (Byrd rule).

import { AGENDA_POLICIES } from "./agenda.js";

export const WINDOW_ADJUST = 1.15; // CRFB re-estimated CBO options ~15% larger one window later

export const SOURCE_TYPES = {
  cbo: { label: "CBO score", confidence: "high" },
  official: { label: "Other official score", confidence: "high" },
  independent: { label: "Independent estimate", confidence: "medium" },
  derived: { label: "Derived from CBO", confidence: "medium" },
  estimate: { label: "Game estimate", confidence: "low" },
};

const CBO = "CBO, Options for Reducing the Deficit: 2025 to 2034 (Dec 2024)";

export const CATEGORIES = [
  { id: "revenue", label: "Raise revenue" },
  { id: "cut", label: "Cut spending" },
  { id: "spend", label: "New spending or tax cuts" },
  { id: "agenda", label: "Beyond the budget" },
];

const BUDGET_POLICIES = [
  // ── Revenue ───────────────────────────────────────────────
  { id: "corp_rate", category: "revenue", name: "Raise the corporate tax rate",
    desc: "The rate has been 21% since 2017. CBO scores each percentage point at about $136B over ten years.",
    levels: [{ label: "22%", tenYear: 136 }, { label: "25%", tenYear: 544 }, { label: "28%", tenYear: 952 }],
    vec: { taxRich: 1 }, base: 0.15, reconcilable: true,
    source: { type: "cbo", cite: CBO + "; higher rates scaled linearly from the 1-point estimate" },
    pros: ["Most Americans support it, including a majority of Pragmatic and Polite Right (Pew 2026)"], cons: ["Some of the cost falls on workers and shareholders, not only corporations", "Encourages profit shifting abroad"] },

  { id: "top_rate", category: "revenue", name: "Restore the 39.6% top income tax rate",
    desc: "The 2025 law made the 37% top rate permanent. This restores 39.6% on income above $400K ($450K for couples).",
    levels: [{ label: "39.6% above $400K", tenYear: 367 }],
    vec: { taxRich: 1 }, base: 0.1, reconcilable: true,
    source: { type: "official", cite: "Treasury General Explanations of the FY2025 Budget (approximate)" },
    pros: ["Affects roughly the top 1-2% of filers"], cons: ["Small business owners filing as individuals pay it too"] },

  { id: "all_rates", category: "revenue", name: "Raise every income tax bracket by one point",
    desc: "A broad increase that every income taxpayer feels.",
    levels: [{ label: "+1 point", tenYear: 1185 }],
    vec: { broadTax: 0.9 }, base: -0.1, reconcilable: true,
    source: { type: "cbo", cite: CBO },
    pros: ["Large, predictable revenue"], cons: ["Raises taxes on the middle class"] },

  { id: "niit", category: "revenue", name: "Apply the 3.8% investment tax to pass-through income",
    desc: "Closes a gap where some high-earning business owners avoid both payroll tax and the Net Investment Income Tax.",
    levels: [{ label: "Close the gap", tenYear: 420 }],
    vec: { taxRich: 0.8 }, base: 0, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Targets high earners"], cons: ["Complex for small business owners"] },

  { id: "cap_gains", category: "revenue", name: "Raise capital gains tax rates",
    desc: "CBO scores a 2-point increase. Larger increases raise less per point because people sell less often.",
    levels: [{ label: "+2 points", tenYear: 103 }],
    vec: { taxRich: 0.8 }, base: 0, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Gains are concentrated at the top"], cons: ["Investors delay selling, which limits revenue"] },

  { id: "step_up", category: "revenue", name: "End stepped-up basis at death",
    desc: "Heirs would owe tax on gains that built up before they inherited assets.",
    levels: [{ label: "Carryover basis", tenYear: 197 }],
    vec: { taxRich: 0.6, broadTax: 0.2 }, base: -0.1, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Closes a large loophole for inherited wealth"], cons: ["Unpopular with family farms and small businesses"] },

  { id: "ss_payroll_250k", category: "revenue", name: "Apply Social Security tax to earnings above $250K",
    desc: "Today the 12.4% payroll tax stops at about $184,500 of wages.",
    levels: [{ label: "Above $250K", tenYear: 1400 }],
    vec: { taxRich: 0.9, entitle: 0.4 }, base: 0.2, reconcilable: false, ssClose: 0.5,
    source: { type: "cbo", cite: CBO + ". Social Security changes cannot pass through reconciliation" },
    pros: ["Extends Social Security solvency", "Broadly popular in polling"], cons: ["Large tax increase on high earners in high-cost states"] },

  { id: "itemized", category: "revenue", name: "Eliminate itemized deductions",
    desc: "Ends deductions for mortgage interest, state and local taxes, and charity. CBO scored this before the 2025 law raised the SALT cap.",
    levels: [{ label: "Eliminate", tenYear: 3400 }],
    vec: { broadTax: 0.7, taxRich: 0.4 }, base: -0.3, reconcilable: true,
    source: { type: "cbo", cite: CBO + ". Pre-2025-law estimate", stale: true },
    pros: ["Very large revenue", "Simplifies the tax code"], cons: ["Hits homeowners and charities", "Concentrated in high-tax states"] },

  { id: "vat", category: "revenue", name: "Create a value-added tax",
    desc: "A national consumption tax like those used by every other rich democracy.",
    levels: [{ label: "2.5%", tenYear: 1690 }, { label: "5%", tenYear: 3380 }],
    vec: { broadTax: 1 }, base: -0.25, reconcilable: true,
    source: { type: "cbo", cite: CBO + "; 2.5% scaled from the 5% estimate" },
    pros: ["Raises a lot while barely affecting incentives to work or invest"], cons: ["Regressive unless paired with rebates", "Raises prices once"] },

  { id: "carbon", category: "revenue", name: "Carbon tax",
    desc: "$25 per metric ton, rising 5% a year above inflation.",
    levels: [{ label: "$25/ton", tenYear: 919 }],
    vec: { climate: 1, broadTax: 0.5 }, base: -0.1, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Cuts emissions at low cost per ton"], cons: ["Raises energy prices, which hit rural and lower-income households harder"] },

  { id: "ftt", category: "revenue", name: "Financial transactions tax",
    desc: "A small tax on trades of stocks, bonds and derivatives.",
    levels: [{ label: "0.1%", tenYear: 297 }],
    vec: { taxRich: 0.7 }, base: 0.05, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Mostly paid by high-frequency traders and wealthy investors"], cons: ["Reduces trading volume and market liquidity"] },

  { id: "gas_tax", category: "revenue", name: "Raise the federal gas tax",
    desc: "Up 15 cents a gallon and indexed to inflation. The tax has been 18.4 cents since 1993.",
    levels: [{ label: "+15 cents", tenYear: 212 }],
    vec: { broadTax: 0.7, climate: 0.3 }, base: -0.3, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Funds highways"], cons: ["Visible at the pump every week"] },

  { id: "intl_corp", category: "revenue", name: "Tax all foreign profits of U.S. companies at 21%",
    desc: "Ends the lower rate on profits booked overseas.",
    levels: [{ label: "Full rate", tenYear: 340 }],
    vec: { taxRich: 0.6 }, base: 0.1, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Reduces profit shifting"], cons: ["Could push companies to move headquarters abroad"] },

  { id: "wealth_tax", category: "revenue", name: "Annual wealth tax on fortunes above $50M",
    desc: "2% a year above $50M, 3% above $1B. CBO has not scored this. Independent estimates range widely because of valuation and avoidance.",
    levels: [{ label: "2% / 3%", tenYear: 2000 }],
    vec: { taxRich: 1.2 }, base: 0.1, reconcilable: true,
    source: { type: "independent", cite: "Saez and Zucman (2019) estimated $2.75T; the game uses $2.0T to allow for avoidance. Constitutionality is disputed." },
    pros: ["Directly targets extreme wealth concentration"], cons: ["Hard to value private assets", "Likely Supreme Court challenge"] },

  { id: "irs", category: "revenue", name: "Fund IRS enforcement",
    desc: "Add $80B for audits of high-income filers and corporations. The 2025 law rescinded much of the earlier funding.",
    levels: [{ label: "+$80B", tenYear: 124 }],
    vec: { taxRich: 0.5, govSize: 0.2 }, base: 0, reconcilable: true,
    source: { type: "official", cite: "CBO scored the 2022 IRS funding at about $204B revenue for $80B cost, net $124B" },
    pros: ["Collects taxes already owed"], cons: ["Seen by many on the right as targeting ordinary taxpayers"] },

  { id: "tariffs_up", category: "revenue", name: "Raise tariffs back to early-2026 levels",
    desc: "The Supreme Court struck down the IEEPA tariffs in Feb 2026. Current Section 301 tariffs average about 10%. This restores the higher rates.",
    levels: [{ label: "Restore", tenYear: 700 }], adjust: 1,
    vec: { trade: 1, broadTax: 0.4 }, base: -0.1, reconcilable: true,
    source: { type: "derived", cite: "CBO tariff update (Aug 2026): trade changes added $0.7T to 2027-2036 primary deficits ($0.9T with interest)" },
    pros: ["Revenue without an income tax increase", "Supported by much of the President's base"], cons: ["Paid largely by U.S. buyers through higher prices", "Invites retaliation against farm exports"] },

  { id: "immigration", category: "revenue", name: "Comprehensive immigration reform",
    desc: "Legal status path plus more work visas, modeled on the 2013 Senate bill.",
    levels: [{ label: "S.744 model", tenYear: 175 }],
    vec: { immig: -1 }, base: 0, reconcilable: false,
    source: { type: "official", cite: "CBO score of S.744 (2013): -$175B deficits over 10 years, about -$700B in the second decade" },
    pros: ["Expands the tax base", "Most groups support a path to legal status (Pew 2026)"], cons: ["Strong opposition from No Apologies Right and Faith First Conservatives", "Not a budget bill, so it needs 60 Senate votes"] },

  // ── Spending cuts ─────────────────────────────────────────
  { id: "defense_cut", category: "cut", name: "Reduce the defense budget",
    desc: "CBO's option trims about $1T in budget authority over ten years.",
    levels: [{ label: "Half", tenYear: 550 }, { label: "Full CBO option", tenYear: 1100 }],
    vec: { defense: -1 }, base: 0, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["The U.S. outspends the next several countries combined"], cons: ["Job losses in defense communities", "Weakens deterrence in the view of most right-leaning groups"] },

  { id: "medicare_adv", category: "cut", name: "Reduce Medicare Advantage overpayments",
    desc: "Private Medicare plans are paid more per enrollee than traditional Medicare.",
    levels: [{ label: "Cut benchmarks 10%", tenYear: 489 }, { label: "Fix risk coding", tenYear: 1000 }],
    vec: { entitle: -0.5, govSize: -0.2 }, base: 0, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Targets insurer payments, not beneficiaries directly"], cons: ["Plans may cut extra benefits like dental and vision"] },

  { id: "medicaid_cap", category: "cut", name: "Cap federal Medicaid spending",
    desc: "Limits federal funding growth to inflation, per enrollee or overall.",
    levels: [{ label: "Overall cap", tenYear: 742 }, { label: "Per-enrollee cap", tenYear: 893 }],
    vec: { govSize: -1, entitle: -0.3 }, base: -0.2, reconcilable: true,
    source: { type: "cbo", cite: CBO + ". The 2025 law already cut Medicaid, so savings would be smaller now", stale: true },
    pros: ["Gives states fixed budgets and flexibility"], cons: ["States cut coverage when costs outgrow the cap"] },

  { id: "partb", category: "cut", name: "Raise Medicare Part B premiums",
    desc: "Beneficiaries would cover 35% of Part B costs instead of 25%.",
    levels: [{ label: "35%", tenYear: 510 }],
    vec: { entitle: -0.8, broadTax: 0.3 }, base: -0.2, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Returns to the original 1960s cost split"], cons: ["Direct cost increase for seniors"] },

  { id: "site_neutral", category: "cut", name: "Site-neutral Medicare payments",
    desc: "Pay the same rate for a service whether it happens in a hospital outpatient department or a doctor's office.",
    levels: [{ label: "All outpatient sites", tenYear: 157 }],
    vec: { entitle: -0.1 }, base: 0.15, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Bipartisan support in Congress"], cons: ["Hospitals lobby hard against it"] },

  { id: "drug_neg", category: "cut", name: "Expand Medicare drug price negotiation",
    desc: "Negotiate prices for more drugs each year than the 2022 law allows.",
    levels: [{ label: "Double the drugs", tenYear: 100 }],
    vec: { entitle: 0.5, govSize: 0.2 }, base: 0.5, reconcilable: true,
    source: { type: "estimate", cite: "CBO scored the original 2022 negotiation provision at about $99B; doubling is a rough extrapolation. KFF polling shows broad bipartisan support." },
    pros: ["One of the most popular policies in polling across parties"], cons: ["Drugmakers say it reduces investment in new medicines"] },

  { id: "ss_age", category: "cut", name: "Raise the Social Security retirement age to 70",
    desc: "Phased in gradually, so savings in the first decade are small and grow later.",
    levels: [{ label: "To 70", tenYear: 95 }],
    vec: { entitle: -1 }, base: -0.3, reconcilable: false, ssClose: 0.35,
    source: { type: "cbo", cite: CBO + ". Social Security changes cannot pass through reconciliation" },
    pros: ["Large long-term savings"], cons: ["Hardest on workers in physical jobs and those with shorter lives"] },

  { id: "chained_cpi", category: "cut", name: "Use chained CPI for cost-of-living adjustments",
    desc: "A slower inflation measure for Social Security and other indexed programs and tax brackets.",
    levels: [{ label: "Switch", tenYear: 278 }],
    vec: { entitle: -0.6, broadTax: 0.2 }, base: -0.1, reconcilable: false, ssClose: 0.17,
    source: { type: "cbo", cite: CBO }, pros: ["Many economists consider it more accurate"], cons: ["Benefit cuts compound with age"] },

  { id: "ss_progressive", category: "cut", name: "Slow Social Security benefit growth for high earners",
    desc: "Future benefits grow more slowly for workers with higher lifetime earnings.",
    levels: [{ label: "Progressive indexing", tenYear: 197 }],
    vec: { entitle: -0.3, taxRich: 0.3 }, base: 0, reconcilable: false, ssClose: 0.2,
    source: { type: "cbo", cite: CBO }, pros: ["Protects lower-income retirees"], cons: ["Weakens the program's broad support over time"] },

  { id: "va_means", category: "cut", name: "Means-test VA disability compensation",
    desc: "Reduce disability payments for veterans with high household income.",
    levels: [{ label: "Means-test", tenYear: 384 }],
    vec: { defense: -0.4, govSize: -0.3 }, base: -0.4, reconcilable: true,
    source: { type: "cbo", cite: CBO }, pros: ["Targets benefits to those with less income"], cons: ["Broadly unpopular across groups"] },

  { id: "ndd_grants", category: "cut", name: "Cut grants to states for education and transportation",
    desc: "Reduces these grants by one third.",
    levels: [{ label: "-1/3", tenYear: 339 }],
    vec: { govSize: -0.8 }, base: -0.1, reconcilable: false,
    source: { type: "cbo", cite: CBO + ". Discretionary cuts go through annual appropriations, not reconciliation" },
    pros: ["Shrinks the federal role"], cons: ["States raise their own taxes or cut services"] },

  { id: "foreign_aid", category: "cut", name: "Reduce international affairs spending",
    desc: "Diplomacy and foreign aid, already cut sharply in 2025.",
    levels: [{ label: "CBO option", tenYear: 187 }],
    vec: { govSize: -0.3, defense: -0.2 }, base: 0.1, reconcilable: false,
    source: { type: "cbo", cite: CBO, stale: true }, pros: ["Popular with America-first voters"], cons: ["Less U.S. influence abroad"] },

  // ── New spending or tax cuts ──────────────────────────────
  { id: "aca", category: "spend", name: "Restore enhanced ACA premium subsidies",
    desc: "The larger marketplace subsidies expired at the end of 2025.",
    levels: [{ label: "Make permanent", tenYear: -350 }],
    vec: { govSize: 0.8 }, base: 0.2, reconcilable: true,
    source: { type: "official", cite: "CBO estimate of permanent extension, about $350B" },
    pros: ["Keeps about 4 million people insured"], cons: ["Adds to deficits"] },

  { id: "ctc", category: "spend", name: "Expand the Child Tax Credit",
    desc: "Bring back the 2021 version, fully refundable at up to $3,600 per child.",
    levels: [{ label: "2021 version", tenYear: -1600 }],
    vec: { govSize: 0.8 }, base: 0.1, reconcilable: true,
    source: { type: "independent", cite: "CRFB estimate of permanent 2021-style credit" },
    pros: ["Cut child poverty sharply in 2021"], cons: ["Very costly", "Critics argue it reduces work"] },

  { id: "public_option", category: "spend", name: "Create a public health insurance option",
    desc: "A government plan sold on the ACA marketplaces.",
    levels: [{ label: "Public option", tenYear: -750 }],
    vec: { govSize: 0.9 }, base: 0.1, reconcilable: true,
    source: { type: "estimate", cite: "Biden 2020 campaign estimate ($750B); not CBO-scored" },
    pros: ["More choice and competition"], cons: ["Insurers and hospitals oppose lower payment rates"] },

  { id: "m4a", category: "spend", name: "Medicare for All",
    desc: "Single-payer coverage for everyone. Federal costs rise sharply, while premiums and out-of-pocket costs paid by households and employers fall by a similar amount.",
    levels: [{ label: "Single payer", tenYear: -34000 }],
    vec: { govSize: 1.5, taxRich: 0.3 }, base: -0.1, reconcilable: false,
    source: { type: "independent", cite: "Urban Institute (2019) estimate of new federal spending" },
    pros: ["Universal coverage", "Ends medical debt"], cons: ["Requires very large new taxes", "Ends private insurance for about 150 million people"] },

  { id: "infrastructure", category: "spend", name: "New infrastructure package",
    desc: "Roads, bridges, water, broadband and grid, similar in size to the 2021 law.",
    levels: [{ label: "$550B", tenYear: -550 }],
    vec: { govSize: 0.5 }, base: 0.3, reconcilable: false,
    source: { type: "estimate", cite: "Sized to the 2021 IIJA's new spending" },
    pros: ["Broadly popular", "Supports long-run growth"], cons: ["Adds to deficits", "Projects often run over budget"] },

  { id: "defense_up", category: "spend", name: "Increase the defense budget",
    desc: "About 10% more per year than CBO's baseline.",
    levels: [{ label: "+10%", tenYear: -1000 }],
    vec: { defense: 1 }, base: 0, reconcilable: true,
    source: { type: "estimate", cite: "10% of projected DoD outlays" },
    pros: ["Priority for No Apologies Right and Faith First Conservatives"], cons: ["Adds to deficits"] },

  { id: "student_debt", category: "spend", name: "Cancel student debt",
    desc: "Up to $10K per borrower, $20K for Pell recipients.",
    levels: [{ label: "$10K/$20K", tenYear: -400 }],
    vec: { govSize: 0.6 }, base: -0.2, reconcilable: true,
    source: { type: "official", cite: "CBO estimate of the 2022 plan (~$400B)" },
    pros: ["Relief for about 40 million borrowers"], cons: ["Seen as unfair by people who did not go to college or already repaid"] },

  { id: "clean_energy", category: "spend", name: "Restore clean energy tax credits",
    desc: "Bring back the wind, solar and EV credits the 2025 law repealed or phased out.",
    levels: [{ label: "Restore", tenYear: -500 }],
    vec: { climate: 1, govSize: 0.3 }, base: 0, reconcilable: true,
    source: { type: "derived", cite: "Approximate reverse of the 2025 law's energy credit savings" },
    pros: ["Lowers emissions", "Factory investment in many red districts"], cons: ["Adds to deficits"] },

  { id: "no_tax_ss", category: "spend", name: "End income tax on Social Security benefits",
    desc: "A Trump campaign promise. The 2025 law added a smaller senior deduction instead.",
    levels: [{ label: "Fully exempt", tenYear: -1500 }],
    vec: { entitle: 0.6, broadTax: -0.3 }, base: 0.3, reconcilable: false, ssClose: -0.15,
    source: { type: "independent", cite: "CRFB estimate; also speeds trust fund insolvency" },
    pros: ["Popular with retirees"], cons: ["Mostly benefits higher-income retirees", "Drains the Social Security and Medicare trust funds"] },
];


// ── Added for the 2027 agenda (Nov 2026 update) ─────────────
// adjust: 1 means the estimate already covers 2027-2036 (no window shift).
const AGENDA_2027 = [
  { id: "medicaid_restore", category: "spend", name: "Reverse the 2025 Medicaid cuts and work requirements",
    desc: "Undo the Medicaid cuts and new work requirements in the One Big Beautiful Bill Act. Part of House Democrats' first-100-days agenda.",
    levels: [{ label: "Full repeal", tenYear: -900 }],
    vec: { govSize: 0.9, entitle: 0.3 }, base: 0.15, reconcilable: true,
    source: { type: "derived", cite: "Game estimate based on CBO's scoring of the 2025 law's Medicaid provisions, roughly $0.9T to $1T over ten years" },
    pros: ["Restores coverage for millions", "Hospitals and governors in both parties want the money back"], cons: ["Nearly $1T in new deficits", "Undoes the President's signature law, so expect a veto"] },

  { id: "min_wage", category: "spend", name: "Raise the federal minimum wage to $15",
    desc: "From $7.25, unchanged since 2009, phased in over several years. Democratic leaders call it an immediate priority.",
    levels: [{ label: "$15 phased in", tenYear: -54 }],
    vec: { govSize: 0.5, taxRich: 0.2 }, base: 0.2, reconcilable: false,
    source: { type: "cbo", cite: "CBO (Feb 2021): a $15 minimum wage by 2025 would add about $54B to deficits over ten years; the Senate parliamentarian ruled it out of reconciliation", stale: true },
    pros: ["Popular across most voter groups", "Raises pay for millions"], cons: ["CBO projected some job losses", "Needs 60 Senate votes"] },

  { id: "carried_interest", category: "revenue", name: "Tax carried interest as ordinary income",
    desc: "Fund managers' share of profits would be taxed like wages. Senate bill S. 4330.",
    levels: [{ label: "Ordinary rates", tenYear: 88 }],
    vec: { taxRich: 0.9 }, base: 0.25, reconcilable: true,
    source: { type: "independent", cite: "Yale Budget Lab refined estimate ($88B); older methods gave about $48B" },
    pros: ["Popular across groups", "Closes a loophole both Trump and Biden criticized"], cons: ["Raises relatively little", "Private equity lobbies hard against it"] },

  { id: "buyback_tax", category: "revenue", name: "Quadruple the stock buyback tax",
    desc: "Raise the 1% excise tax on corporate stock buybacks to 4%.",
    levels: [{ label: "2%", tenYear: 88 }, { label: "4%", tenYear: 246 }], adjust: 1.05,
    vec: { taxRich: 0.8 }, base: 0.15, reconcilable: true,
    source: { type: "independent", cite: "Penn Wharton Budget Model (2025), FY2026-2035" },
    pros: ["Paid by large public companies"], cons: ["Companies may shift to dividends"] },

  { id: "datacenter", category: "revenue", name: "End bonus depreciation for AI data centers",
    desc: "Data centers would deduct their costs over time instead of all at once. Senate bill S. 5054.",
    levels: [{ label: "Exclude data centers", tenYear: 60 }],
    vec: { taxRich: 0.4 }, base: 0.15, reconcilable: true,
    source: { type: "estimate", cite: "Game estimate; not yet scored by JCT" },
    pros: ["Data centers are blamed for rising power bills"], cons: ["Could slow U.S. AI investment"] },

  { id: "ss_rate", category: "revenue", name: "Raise the Social Security payroll tax rate",
    desc: "One point more each for workers and employers (12.4% to 14.4%).",
    levels: [{ label: "+1 point each", tenYear: 2500 }],
    vec: { broadTax: 0.8, entitle: 0.6 }, base: 0, reconcilable: false, ssClose: 0.45,
    source: { type: "derived", cite: "Scaled from CBO's 2% payroll tax option; trust fund effect estimated from SSA actuarial memos" },
    pros: ["Directly shores up the trust fund"], cons: ["A tax increase on every worker"] },

  { id: "pbm", category: "cut", name: "Reform pharmacy benefit managers",
    desc: "Rules on drug middlemen's fees and rebates. Has bipartisan support in both committees.",
    levels: [{ label: "Bipartisan package", tenYear: 5 }],
    vec: { entitle: 0.2 }, base: 0.35, reconcilable: true,
    source: { type: "estimate", cite: "Recent bipartisan PBM packages scored as small savings" },
    pros: ["Rare bipartisan health deal"], cons: ["Little deficit impact"] },

  { id: "tariff_repeal", category: "spend", name: "Repeal remaining new tariffs",
    desc: "Schumer's End Trump's Tariffs Act targets some tariffs; the full option ends all tariffs added since 2025.",
    levels: [{ label: "Some (est. a quarter)", tenYear: -425 }, { label: "All new tariffs", tenYear: -1700 }], adjust: 1,
    vec: { trade: -1, broadTax: -0.4 }, base: 0.15, reconcilable: true,
    source: { type: "derived", cite: "CBO: tariffs in the Feb 2026 baseline cut deficits ~$3.0T; the court ruling removed ~$0.9T, leaving ~$1.7T of primary savings" },
    pros: ["Lowers prices", "Ends retaliation against farm exports"], cons: ["Loses large revenue", "Certain veto"] },

  { id: "childcare", category: "spend", name: "Expand the child and dependent care credit",
    desc: "A larger, refundable credit for child care costs. Part of the Democrats' American Affordability Act.",
    levels: [{ label: "Expand", tenYear: -150 }],
    vec: { govSize: 0.6 }, base: 0.25, reconcilable: true,
    source: { type: "estimate", cite: "Game estimate; the bill identifies no offsets" },
    pros: ["Child care is a top affordability complaint"], cons: ["Adds to deficits"] },

  { id: "home_sale", category: "spend", name: "Double the tax-free gain on home sales",
    desc: "Raise the exclusion to $500K single and $1M joint, indexed to inflation. Republican bill H.R. 1340.",
    levels: [{ label: "Double", tenYear: -50 }],
    vec: { taxRich: -0.3 }, base: 0.25, reconcilable: true,
    source: { type: "estimate", cite: "Game estimate" },
    pros: ["Frees up housing as older owners sell"], cons: ["Benefits mostly go to owners in expensive markets"] },

  { id: "health_extenders", category: "spend", name: "Year-end health care extenders",
    desc: "Renew Medicare physician pay, community health center funding and about 20 programs expiring Dec 31, 2026.",
    levels: [{ label: "Two-year renewal", tenYear: -50 }],
    vec: { govSize: 0.3, entitle: 0.3 }, base: 0.3, routine: true, reconcilable: false,
    source: { type: "estimate", cite: "Game estimate; deadlines from Holland & Knight (Oct 2026)" },
    pros: ["Prevents a cut to doctors and clinics"], cons: ["Usually passed without offsets"] },

  { id: "highways", category: "spend", name: "Highway and transit reauthorization",
    desc: "About $580B over five years in the House's BUILD America 250 Act, plus a general fund transfer to the Highway Trust Fund.",
    levels: [{ label: "Pass it", tenYear: -150 }],
    vec: { govSize: 0.3 }, base: 0.3, routine: true, reconcilable: false,
    source: { type: "estimate", cite: "Game estimate of the trust fund shortfall the general fund would cover" },
    pros: ["Cleared committee 62-2"], cons: ["Nobody has agreed how to pay for it"] },

  { id: "iran_supp", category: "spend", name: "Fund the Iran war",
    desc: "The White House asked for $87.6B in June. CBO says $42.3B of it is directly tied to the war, which has cost the Pentagon about $38B through August plus $2-3B for each additional month.",
    levels: [{ label: "War costs only", tenYear: -42 }, { label: "Full request", tenYear: -88 }, { label: "Full request + a year of operations", tenYear: -118 }], adjust: 1,
    vec: {}, base: -0.1, salience: 1.3, reconcilable: true, front: true,
    // Group reactions come straight from Pew: % saying force was the right decision.
    pew: { for: { nar: 89, ffc: 76, ur: 55, ppr: 42, tom: 30, ool: 25, lol: 11, ll: 5, lp: 1 } },
    source: { type: "cbo", cite: "CBO, Estimating the Cost of Combat Operations Against Iran (Sep 2026)" },
    pros: ["Replenishes munitions; interceptor stocks will take years to rebuild"], cons: ["59% say using force in Iran was the wrong decision (Pew, April 2026)", "Gas prices are up sharply since the war began"] },
];

export const POLICIES = [...BUDGET_POLICIES, ...AGENDA_2027, ...AGENDA_POLICIES];

// Policies that can't both be law: turning one on turns the other off.
// Medicare for All replaces the ACA subsidies and the public option.
export const CONFLICTS = [
  ["tariffs_up", "tariff_repeal"],
  ["defense_cut", "defense_up"],
  ["m4a", "aca"],
  ["m4a", "public_option"],
  ["codify_roe", "abortion_15wk"],
  ["deport", "ice_limits"],
  ["deport", "immigration"],
  ["medicaid_restore", "medicaid_cap"],
];
export const conflictsOf = (id) => CONFLICTS.filter((p) => p.includes(id)).map((p) => (p[0] === id ? p[1] : p[0]));
