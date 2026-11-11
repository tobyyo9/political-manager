// Pew Research Center, "Beyond Red vs. Blue: The Political Typology" (June 10, 2026).
// Survey of 10,357 U.S. adults, Nov 17-30, 2025.
//
// Sourced directly from Pew: share, turnout2024, vote2024, partisan lean,
// trumpApproval, descriptions, and the age/race composition tables.
// ESTIMATED by this game: the `values` profile (-1 to +1 per dimension) and
// `persuadable`. Values are informed by Pew's reported positions (noted in
// `evidence`) but the exact numbers are judgment calls, flagged in the UI.

export const DIMENSIONS = [
  { id: "govSize", label: "Bigger government / safety net" },
  { id: "taxRich", label: "Higher taxes on the wealthy and corporations" },
  { id: "immig", label: "More restrictive immigration" },
  { id: "defense", label: "Military strength" },
  { id: "climate", label: "Climate action" },
  { id: "trade", label: "Tariffs and trade protection" },
  { id: "entitle", label: "Protect Social Security and Medicare" },
  { id: "broadTax", label: "Willingness to pay broad taxes" },
  { id: "socialTrad", label: "Traditional social values (abortion, religion)" },
  { id: "guns", label: "Gun rights" },
  { id: "order", label: "Law and order, police powers" },
  { id: "globalism", label: "Alliances and engagement abroad (NATO, Ukraine)" },
];

export const GROUPS = [
  {
    id: "nar", name: "No Apologies Right", share: 9, side: "right", color: "var(--r3)",
    turnout2024: 0.83, rep: 0.99, dem: 0.01, trumpApproval: 0.9, vote2024: "99% Trump",
    blurb: "Unwavering Trump supporters with a pugilistic style and an America First outlook.",
    evidence: ["75% say government should give less assistance to people in need", "81% back a national deportation effort", "About two-thirds say climate change is not a problem", "74% men", "73% say abortion should be illegal in all or most cases", "70% are comfortable with open carry of guns", "Seven-in-ten or more view NATO unfavorably"],
    values: { govSize: -0.8, taxRich: -0.6, immig: 0.9, defense: 0.9, climate: -0.8, trade: 0.7, entitle: 0.3, broadTax: -0.6, socialTrad: 0.8, guns: 1.0, order: 0.9, globalism: -0.8 },
    persuadable: 0.1,
  },
  {
    id: "ffc", name: "Faith First Conservatives", share: 12, side: "right", color: "var(--r2)",
    turnout2024: 0.75, rep: 0.95, dem: 0.03, trumpApproval: 0.81, vote2024: "97% Trump",
    blurb: "Staunch conservatives whose politics are shaped by religion. One of the most rural groups.",
    evidence: ["About three-quarters say government services should be reduced", "83% say abortion should be illegal in all or most cases", "41% live in rural areas", "Highly critical of NATO and traditional allies", "55% are comfortable with open carry of guns", "82% say a culture based on Christian beliefs is very important"],
    values: { govSize: -0.6, taxRich: -0.3, immig: 0.7, defense: 0.8, climate: -0.5, trade: 0.5, entitle: 0.5, broadTax: -0.6, socialTrad: 1.0, guns: 0.8, order: 0.8, globalism: -0.7 },
    persuadable: 0.15,
  },
  {
    id: "ur", name: "Unconventional Right", share: 12, side: "right", color: "var(--r1)",
    turnout2024: 0.55, rep: 0.76, dem: 0.19, trumpApproval: 0.53, vote2024: "79% Trump, 16% Harris",
    blurb: "Younger, less religious, conservative on immigration and culture, mixed on the safety net.",
    evidence: ["Split 48/51 on whether government should ensure health coverage", "About half back deporting undocumented immigrants", "56% say abortion should be legal in most cases", "Trump approval fell from 78% to 53%", "Only 24% are comfortable with open carry", "Much more favorable to NATO than groups to their right"],
    values: { govSize: -0.2, taxRich: 0, immig: 0.4, defense: 0.4, climate: -0.1, trade: 0.3, entitle: 0.6, broadTax: -0.8, socialTrad: 0.2, guns: 0.2, order: 0.5, globalism: 0.1 },
    persuadable: 0.5,
  },
  {
    id: "ppr", name: "Pragmatic and Polite Right", share: 11, side: "right", color: "var(--r0)",
    turnout2024: 0.68, rep: 0.56, dem: 0.37, trumpApproval: 0.36, vote2024: "54% Trump, 40% Harris",
    blurb: "The oldest group. Economically conservative, moderate on race and immigration, values civility.",
    evidence: ["More supportive than groups to their right of raising corporate taxes", "Two-thirds back a path to legal status", "59% say the U.S. should help Ukraine", "78% prefer incremental change", "46% say abortion should be illegal in most cases", "57% say gun violence is a very big problem"],
    values: { govSize: -0.3, taxRich: 0.25, immig: 0, defense: 0.5, climate: 0.1, trade: -0.3, entitle: 0.6, broadTax: -0.5, socialTrad: 0.3, guns: -0.2, order: 0.5, globalism: 0.6 },
    persuadable: 0.6,
  },
  {
    id: "tom", name: "Tuned-Out Middle", share: 9, side: "middle", color: "var(--m)",
    turnout2024: 0.32, rep: 0.43, dem: 0.46, trumpApproval: null, vote2024: "Split",
    blurb: "Least engaged and most financially strained. Lean left on economics, not on social issues.",
    evidence: ["56% are lower income", "Half struggle to pay bills each month", "Support Social Security and government health care", "Only 32% voted in 2024"],
    values: { govSize: 0.3, taxRich: 0.1, immig: 0, defense: 0.1, climate: 0, trade: 0, entitle: 0.8, broadTax: -1, socialTrad: 0.2, guns: 0.0, order: 0.2, globalism: -0.3 },
    persuadable: 0.5,
  },
  {
    id: "ool", name: "Order and Opportunity Left", share: 18, side: "left", color: "var(--d0)",
    turnout2024: 0.46, rep: 0.25, dem: 0.65, trumpApproval: null, vote2024: "75% Harris, 22% Trump",
    blurb: "The largest group. Economically liberal, concerned about crime, supportive of border security.",
    evidence: ["Want a larger government with more services", "60% favor a military presence at the border, but oppose mass deportation", "84% back photo voter ID", "Racially diverse: 41% White, 26% Hispanic, 21% Black", "More open than other left groups to police stop-and-search", "84% back photo voter ID"],
    values: { govSize: 0.5, taxRich: 0.5, immig: 0.2, defense: 0.3, climate: 0.3, trade: 0, entitle: 0.8, broadTax: -0.9, socialTrad: 0.1, guns: -0.2, order: 0.6, globalism: 0.3 },
    persuadable: 0.45,
  },
  {
    id: "lol", name: "Left-Out Left", share: 12, side: "left", color: "var(--d1)",
    turnout2024: 0.42, rep: 0.15, dem: 0.74, trumpApproval: null, vote2024: "83% Harris",
    blurb: "Young, working class, financially stressed, and skeptical that politics will help them.",
    evidence: ["Say government should ensure health care, retirement income and K-12 education", "46% say billionaires are bad for the country", "70% lack a bachelor's degree", "78% lack confidence in the political system"],
    values: { govSize: 0.7, taxRich: 0.6, immig: -0.3, defense: 0, climate: 0.4, trade: 0, entitle: 0.8, broadTax: -0.9, socialTrad: -0.4, guns: -0.4, order: -0.1, globalism: 0.3 },
    persuadable: 0.4,
  },
  {
    id: "ll", name: "Loyal Liberals", share: 11, side: "left", color: "var(--d2)",
    turnout2024: 0.79, rep: 0.02, dem: 0.97, trumpApproval: null, vote2024: "98% Harris",
    blurb: "Highly educated, attached to the Democratic Party and to domestic and international institutions.",
    evidence: ["92% support raising taxes on large corporations", "80% want government to expand services", "Most favorable group toward NATO", "61% have a college degree", "76% say the U.S. is not giving Ukraine enough support", "Very favorable toward NATO"],
    values: { govSize: 0.8, taxRich: 0.85, immig: -0.7, defense: 0.3, climate: 0.9, trade: -0.5, entitle: 0.7, broadTax: -0.4, socialTrad: -0.8, guns: -0.8, order: -0.3, globalism: 1.0 },
    persuadable: 0.1,
  },
  {
    id: "lp", name: "Leftward Progressives", share: 7, side: "left", color: "var(--d3)",
    turnout2024: 0.70, rep: 0.01, dem: 0.96, trumpApproval: null, vote2024: "97% Harris",
    blurb: "The youngest group. Liberal across the board and the strongest critics of the economic system.",
    evidence: ["92% say the economic system is unfair", "Only 14% say being the sole military superpower matters", "66% like politicians who call themselves democratic socialists", "82% say billionaires are bad for the country", "79% say U.S. efforts abroad make things worse", "Most supportive of legal abortion and LGBTQ rights"],
    values: { govSize: 1, taxRich: 1, immig: -1, defense: -0.8, climate: 1, trade: -0.3, entitle: 0.8, broadTax: -0.3, socialTrad: -1.0, guns: -0.8, order: -0.9, globalism: 0.3 },
    persuadable: 0.2,
  },
];

// Pew composition tables: % of each demographic group in each typology group.
// Order: lp, ll, lol, ool, tom, ppr, ur, ffc, nar
const ORDER = ["lp", "ll", "lol", "ool", "tom", "ppr", "ur", "ffc", "nar"];
const row = (arr) => Object.fromEntries(ORDER.map((id, i) => [id, arr[i]]));

export const DEMOGRAPHICS = [
  { lens: "Age", items: [
    { id: "a18", label: "Ages 18-29", mix: row([14, 9, 19, 15, 14, 5, 12, 9, 3]) },
    { id: "a30", label: "Ages 30-49", mix: row([8, 10, 15, 18, 12, 8, 12, 11, 7]) },
    { id: "a50", label: "Ages 50-64", mix: row([4, 11, 8, 19, 6, 12, 12, 15, 14]) },
    { id: "a65", label: "Ages 65+", mix: row([2, 13, 5, 20, 5, 21, 10, 13, 11]) },
  ]},
  { lens: "Race and ethnicity", items: [
    { id: "white", label: "White", mix: row([8, 13, 9, 12, 5, 12, 14, 15, 12]) },
    { id: "hispanic", label: "Hispanic", mix: row([5, 6, 17, 27, 14, 9, 8, 8, 4]) },
    { id: "black", label: "Black", mix: row([4, 5, 15, 35, 21, 9, 6, 3, 1]) },
    { id: "asian", label: "Asian (English speakers)", mix: row([6, 9, 14, 23, 13, 17, 11, 4, 3]) },
  ]},
];

export const PEW_SOURCE = "Pew Research Center, Beyond Red vs. Blue: The Political Typology (June 2026)";
