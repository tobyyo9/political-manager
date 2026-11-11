// Plain-English guide to each faction. The factions are Pew's 2026 typology groups
// (voters, not formal caucuses). Members of Congress answer to the mix of voters in
// their party, so each party has a slice of most groups. The "closest in Congress"
// lines are this game's reading, not Pew's.
import { GROUPS } from "./typology.js";

export const FACTION_INFO = {
  nar: { plain: "The MAGA core. Loyal to Trump above party, America First, hard line on immigration.",
    R: "Freedom Caucus and MAGA hardliners", D: "Almost none", maga: "The core of MAGA" },
  ffc: { plain: "Religious conservatives, often rural. Abortion, faith and family come first.",
    R: "Social conservatives, much of the Republican Study Committee", D: "Very few", maga: "Mostly MAGA" },
  ur: { plain: "Younger, less religious, populist right. Many voted Trump in 2024 and have soured on him since.",
    R: "Populist and libertarian-leaning newer members", D: "A handful in Trump-won districts", maga: "Split" },
  ppr: { plain: "The oldest group: business-minded, civil, moderate on immigration and Ukraine. Voted 54% Trump, 40% Harris.",
    R: "Traditional business conservatives (Main Street Caucus, Problem Solvers)", D: "Moderate Democrats in suburban and swing seats (Blue Dogs, Problem Solvers)", maga: "Mostly not" },
  tom: { plain: "The least engaged and most financially strained. Lean left on money, not on culture. Few vote.",
    R: "Rarely anyone's base", D: "Rarely anyone's base", maga: "Split" },
  ool: { plain: "The largest group. Want more government help, but also tougher on crime and the border. Racially diverse.",
    R: "Republicans in diverse working-class districts", D: "Mainstream and moderate Democrats, the New Democrat Coalition", maga: "No" },
  lol: { plain: "Young, working class, stretched thin, and doubtful that politics will help them.",
    R: "Very few", D: "Populist and progressive members from working-class districts", maga: "No" },
  ll: { plain: "Highly educated, loyal to the Democratic Party and to institutions at home and abroad.",
    R: "None", D: "Party leadership and mainstream liberals", maga: "No" },
  lp: { plain: "The youngest group. Liberal on everything and the sharpest critics of the economic system.",
    R: "None", D: "Progressive Caucus, the Squad and DSA-aligned members", maga: "No" },
};

const byGid = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// Tooltip content for a faction inside one party's caucus.
export function factionTip(gid, party, extra = []) {
  const g = byGid[gid], f = FACTION_INFO[gid];
  if (!g || !f) return { title: "Others", note: "Small groups that make up under 5% of this caucus each." };
  const partyShare = Math.round((party === "D" ? g.dem : g.rep) * 100);
  return {
    title: g.name,
    rows: [
      ...extra,
      ["In Congress", f[party]],
      ["MAGA", f.maga + (g.trumpApproval != null ? ` (${Math.round(g.trumpApproval * 100)}% approve)` : "")],
      ["2024", g.vote2024],
      ["Party", `${partyShare}% of them are ${party === "D" ? "Democrats" : "Republicans"}`],
    ],
    note: f.plain,
  };
}

export const FACTION_GUIDE = "Factions are Pew's 2026 voter groups. Members answer to the mix of voters in their party, so a Democratic \"Pragmatic and Polite Right\" means Democrats whose voters look like that group: older moderates in swing seats. MAGA is the No Apologies Right plus most Faith First Conservatives.";
