// The President's own priorities, separate from his party's voters and members.
// -1 = will fight it, +1 = wants it. A game reading of his public positions and
// record through 2026; policies not listed follow his base's reaction.
export const PRESIDENT_STANCE = {
  // Trade and taxes
  tariffs_up: 1, tariff_repeal: -1, corp_rate: -1, wealth_tax: -1, irs: -0.8, buyback_tax: -0.4,
  carried_interest: 0.3, top_rate: -0.2, all_rates: -1, vat: -0.6, carbon: -1, gas_tax: -0.8,
  no_tax_ss: 1, home_sale: 0.8,
  // Entitlements: he has promised not to cut Social Security or Medicare benefits
  ss_age: -1, chained_cpi: -0.8, ss_progressive: -0.4, partb: -0.6, medicare_adv: -0.4,
  // Health
  drug_neg: 0.4, medicaid_restore: -1, pbm: 0.5, m4a: -1, public_option: -1,
  // Immigration and security
  deport: 1, ice_limits: -1, immigration: -1, save_act: 1, voter_id: 1, police: 0.6,
  // War and foreign policy
  iran_supp: 1, war_powers: -1, defense_up: 0.8, defense_cut: -1, ukraine: -0.6, foreign_aid: 0.8,
  // Social issues: he opposes a national abortion ban and supported marijuana rescheduling
  abortion_15wk: -0.3, codify_roe: -1, aw_ban: -1, background_checks: -0.5, gender_care: 1, dei: 1,
  marijuana: 0.2, sentencing: 0.3, school_choice: 1,
  // Government
  debt_limit: 1, court_expansion: -1, pardon_reform: -1, voting_rights: -1, ethics: -0.6, ai_rules: -0.7,
  permitting: 0.8, clean_energy: -1, infrastructure: 0.3, highways: 0.5, student_debt: -1,
};

// Republicans in Congress don't always follow him: free traders, defense hawks and
// fiscal hawks break on some issues. How strongly members feel his pull.
export const PRESIDENT_PULL = 0.2;

export const PRESIDENT_SOURCE = "Game reading of the President's public positions and record through 2026; not a statement of his views on any specific bill.";
