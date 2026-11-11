// Fiscal baseline. Every figure is from CBO unless a note says otherwise.
// Units: billions of dollars unless noted.

export const FY2026 = {
  source: "CBO Monthly Budget Review: September 2026 (Oct 8, 2026), preliminary FY2026 totals",
  receipts: 5403,
  outlays: 7396,
  deficit: 1993,
  deficitPctGdp: 6.2,
  receiptsBySource: [
    { id: "individual", label: "Individual income taxes", amount: 2844 },
    { id: "payroll", label: "Payroll taxes", amount: 1815 },
    { id: "corporate", label: "Corporate income taxes", amount: 382 },
    { id: "customs", label: "Customs duties (tariffs)", amount: 172, note: "Net of about $130B in IEEPA tariff refunds after the Feb 2026 Supreme Court ruling" },
    { id: "other", label: "Other (estate, Fed remittances, fees)", amount: 190 },
  ],
  outlaysByCategory: [
    { id: "ss", label: "Social Security", amount: 1654 },
    { id: "interest", label: "Net interest on the debt", amount: 1143 },
    { id: "medicare", label: "Medicare (net)", amount: 1069 },
    { id: "defense", label: "Defense (DoD military)", amount: 916 },
    { id: "medicaid", label: "Medicaid", amount: 723 },
    { id: "va", label: "Veterans Affairs", amount: 416 },
    { id: "snap", label: "Food and nutrition (SNAP etc.)", amount: 137 },
    { id: "other", label: "Everything else", amount: 1338, note: "Education, HUD, EPA, Commerce, SBA, other mandatory and discretionary" },
  ],
};

// CBO Budget and Economic Outlook: 2026 to 2036 (Feb 11, 2026), adjusted for
// CBO's Aug 20, 2026 tariff update (+$0.9T deficits over 2027-2036 after the
// Supreme Court struck down IEEPA tariffs).
export const OUTLOOK = {
  source: "CBO Budget and Economic Outlook 2026-2036 (Feb 2026); CBO tariff update (Aug 2026)",
  startYear: 2026,
  debtEnd2026: 32200, // CBO projected $32.1T; FY2026 came in ~$0.1T worse
  gdp2026: 31900,
  nominalGrowth: 0.039, // gets GDP to ~$46.8T in 2036, consistent with CBO's 120% at $56.2T
  // CBO deficits rise from about $2.0T to $3.1T (5.8% to 6.7% of GDP)
  deficit2027: 1980,
  deficit2036: 3100,
  tenYearDeficitsCbo: 24400,
  tariffAdjustment: 900, // spread across 2027-2036
  netInterest2027: 1180,
  netInterest2036: 2100,
  debtPctGdp2026: 101,
  debtPctGdp2036Cbo: 120,
};

const YEARS = Array.from({ length: 10 }, (_, i) => 2027 + i);

// Build year-by-year baseline. Deficits follow a geometric path between CBO's
// endpoints and are scaled so the 10-year sum matches CBO, then the tariff
// adjustment is added evenly by share of GDP.
export function buildBaseline() {
  const o = OUTLOOK;
  const r = Math.pow(o.deficit2036 / o.deficit2027, 1 / 9);
  const raw = YEARS.map((_, i) => o.deficit2027 * Math.pow(r, i));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scale = o.tenYearDeficitsCbo / rawSum;
  const gdp = YEARS.map((_, i) => o.gdp2026 * Math.pow(1 + o.nominalGrowth, i + 1));
  const gdpSum = gdp.reduce((a, b) => a + b, 0);
  const ri = Math.pow(o.netInterest2036 / o.netInterest2027, 1 / 9);
  let debt = o.debtEnd2026;
  return YEARS.map((year, i) => {
    const deficit = raw[i] * scale + o.tariffAdjustment * (gdp[i] / gdpSum);
    const interest = o.netInterest2027 * Math.pow(ri, i);
    const avgRate = interest / debt;
    debt += deficit;
    return { year, gdp: gdp[i], deficit, interest, avgRate, debt };
  });
}

export const BASELINE = buildBaseline();

// Social Security retirement trust fund (OASI). 2026 Trustees Report via CRFB:
// depleted in 2032, then an automatic 22% benefit cut. The 75-year gap is
// 4.42% of payroll, the largest since 1977. CBO's baseline assumes full
// benefits are paid anyway; the game lets you switch to current law.
export const SOCIAL_SECURITY = {
  source: "2026 Social Security Trustees Report (CRFB analysis, June 2026)",
  outlays2026: 1654,      // CBO MBR FY2026
  growth: 0.055,          // approximate nominal growth in benefits
  oasiShare: 0.88,        // retirement and survivors share of total benefits
  cutPct: 0.22,
  insolvencyYear: 2032,
  shortfallPctPayroll: 4.42,
};
