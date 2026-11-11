// The executive branch: the President and the Cabinet as characters.
// Cabinet as reported Oct 30, 2026 (Noem, Bondi, Chavez-DeRemer and Gabbard had left; Blanche, Sonderling,
// Mullin and Clayton were confirmed in their places). Words and actions in the game are invented.
// area: the policy ids the department fights over. heat: how close they start to a scandal (0 to 1).
// loyal: how tied they are to the President personally. need: needs Senate confirmation when replaced.
export const CABINET = [
  { id: "vp", post: "Vice President", short: "VP", first: "JD", last: "Vance", born: 1984, tone: 0, area: [], loyal: 0.9, heat: 0.2, need: false, note: "Presides over the Senate and breaks ties. Already eyeing 2028." },
  { id: "cos", post: "White House Chief of Staff", short: "Chief of Staff", first: "Susie", last: "Wiles", born: 1957, tone: 1, area: [], loyal: 0.95, heat: 0.1, need: false, note: "Controls who gets in the room. The best route to the President." },
  { id: "state", post: "Secretary of State", short: "State", first: "Marco", last: "Rubio", born: 1971, tone: 2, area: ["ukraine", "foreign_aid", "nato_exit", "iran_supp"], loyal: 0.8, heat: 0.2, need: true, note: "Also acting national security adviser. A former senator with friends on both sides." },
  { id: "treasury", post: "Secretary of the Treasury", short: "Treasury", first: "Scott", last: "Bessent", born: 1962, tone: 0, area: ["tariffs_up", "tariff_repeal", "corp_rate", "top_rate", "debt_limit", "irs", "cap_gains"], loyal: 0.75, heat: 0.15, need: true, note: "The administration's voice to markets. Wants deals, not shutdowns." },
  { id: "defense", post: "Secretary of Defense", short: "Defense", first: "Pete", last: "Hegseth", born: 1980, tone: 1, area: ["defense_up", "defense_cut", "war_powers", "iran_supp"], loyal: 0.9, heat: 0.6, need: true, note: "Under constant fire from Democrats. A favorite target for oversight." },
  { id: "ag", post: "Attorney General", short: "Justice", first: "Todd", last: "Blanche", born: 1974, tone: 1, area: ["pardon_reform", "sentencing", "police", "marijuana", "voting_rights"], loyal: 0.95, heat: 0.45, need: true, note: "The President's former defense lawyer. Confirmed 50-49 in August." },
  { id: "interior", post: "Secretary of the Interior", short: "Interior", first: "Doug", last: "Burgum", born: 1956, tone: 0, area: ["permitting", "clean_energy"], loyal: 0.7, heat: 0.1, need: true, note: "Runs public lands and drilling permits. Quiet and effective." },
  { id: "ag2", post: "Secretary of Agriculture", short: "Agriculture", first: "Brooke", last: "Rollins", born: 1972, tone: 0, area: ["tariffs_up", "tariff_repeal"], loyal: 0.85, heat: 0.15, need: true, note: "Farm-state members call her when tariffs hit their growers." },
  { id: "commerce", post: "Secretary of Commerce", short: "Commerce", first: "Howard", last: "Lutnick", born: 1961, tone: 1, area: ["tariffs_up", "tariff_repeal", "ai_rules", "datacenter"], loyal: 0.85, heat: 0.35, need: true, note: "The tariff salesman. Says what the President is thinking, loudly." },
  { id: "labor", post: "Secretary of Labor", short: "Labor", first: "Keith", last: "Sonderling", born: 1983, tone: 0, area: ["min_wage", "childcare"], loyal: 0.75, heat: 0.15, need: true, note: "New in the job, confirmed 47-41 in October." },
  { id: "hhs", post: "Secretary of Health and Human Services", short: "HHS", first: "Robert F.", last: "Kennedy", born: 1954, tone: 1, area: ["aca", "medicaid_restore", "medicaid_cap", "drug_neg", "pbm", "public_option", "m4a"], loyal: 0.6, heat: 0.5, need: true, note: "Unpredictable, popular with some Democrats, feared by drug companies." },
  { id: "hud", post: "Secretary of Housing and Urban Development", short: "HUD", first: "Scott", last: "Turner", born: 1972, tone: 5, area: ["home_sale"], loyal: 0.8, heat: 0.1, need: true, note: "Former NFL player and Texas legislator." },
  { id: "dot", post: "Secretary of Transportation", short: "Transportation", first: "Sean", last: "Duffy", born: 1971, tone: 1, area: ["highways", "infrastructure", "gas_tax"], loyal: 0.85, heat: 0.2, need: true, note: "A former House member. Still has friends in the cloakroom." },
  { id: "energy", post: "Secretary of Energy", short: "Energy", first: "Chris", last: "Wright", born: 1965, tone: 0, area: ["clean_energy", "carbon", "ratepayer", "permitting"], loyal: 0.75, heat: 0.15, need: true, note: "A fracking executive who wants more of everything except wind." },
  { id: "edu", post: "Secretary of Education", short: "Education", first: "Linda", last: "McMahon", born: 1948, tone: 0, area: ["school_choice", "student_debt", "community_college"], loyal: 0.85, heat: 0.25, need: true, note: "Tasked with shrinking the department she runs." },
  { id: "va", post: "Secretary of Veterans Affairs", short: "VA", first: "Doug", last: "Collins", born: 1966, tone: 1, area: ["va_means"], loyal: 0.85, heat: 0.15, need: true, note: "A former House member and Army Reserve chaplain." },
  { id: "dhs", post: "Secretary of Homeland Security", short: "DHS", first: "Markwayne", last: "Mullin", born: 1977, tone: 2, area: ["deport", "immigration", "ice_limits", "save_act"], loyal: 0.9, heat: 0.4, need: true, note: "Left the Senate in March to run DHS. Confirmed 54-45." },
  { id: "omb", post: "Director of the Office of Management and Budget", short: "Budget", first: "Russ", last: "Vought", born: 1976, tone: 0, area: ["ndd_grants", "debt_limit", "medicaid_cap"], loyal: 0.95, heat: 0.35, need: true, note: "Wants to cut spending without asking Congress. Appropriators hate it." },
  { id: "epa", post: "EPA Administrator", short: "EPA", first: "Lee", last: "Zeldin", born: 1980, tone: 0, area: ["clean_energy", "carbon"], loyal: 0.85, heat: 0.2, need: true, note: "A former House member rolling back rules as fast as courts allow." },
  { id: "un", post: "Ambassador to the United Nations", short: "UN", first: "Mike", last: "Waltz", born: 1974, tone: 1, area: ["foreign_aid", "ukraine"], loyal: 0.75, heat: 0.25, need: true, note: "Moved here after leaving the national security job." },
  { id: "ustr", post: "U.S. Trade Representative", short: "Trade", first: "Jamieson", last: "Greer", born: 1980, tone: 0, area: ["tariffs_up", "tariff_repeal"], loyal: 0.8, heat: 0.1, need: true, note: "Writes the tariff deals the President announces." },
  { id: "dni", post: "Director of National Intelligence", short: "DNI", first: "Jay", last: "Clayton", born: 1966, tone: 0, area: [], loyal: 0.6, heat: 0.15, need: true, note: "A former SEC chairman, confirmed 51-47 after Gabbard left." },
  { id: "cia", post: "CIA Director", short: "CIA", first: "John", last: "Ratcliffe", born: 1965, tone: 1, area: [], loyal: 0.7, heat: 0.15, need: true, note: "A former House member. Quiet by design." },
  { id: "fbi", post: "FBI Director", short: "FBI", first: "Kash", last: "Patel", born: 1980, tone: 3, area: ["police"], loyal: 0.95, heat: 0.5, need: true, note: "A loyalist in a job built for independence. Democrats want hearings." },
];
// Well-known allies the President could nominate when a post opens. In the game only.
export const BENCH = [
  ["Richard", "Grenell", 0.6, 0.85], ["Stephen", "Miller", 0.85, 0.95], ["Jeanine", "Pirro", 0.5, 0.9], ["Tom", "Homan", 0.6, 0.9], ["Kevin", "Hassett", 0.25, 0.75],
  ["Steve", "Witkoff", 0.3, 0.9], ["Mike", "Huckabee", 0.4, 0.8], ["Brendan", "Carr", 0.4, 0.85], ["Matt", "Whitaker", 0.45, 0.85], ["Kari", "Lake", 0.6, 0.9],
  ["Pam", "Bondi", 0.5, 0.9], ["Andrew", "Wheeler", 0.3, 0.75],
]; // first, last, how contentious (0-1), loyalty

export const PRESIDENT = { id: "POTUS", ch: "X", p: "R", st: "DC", first: "Donald", last: "Trump", born: 1946, tone: 0, g: "M", x: 0.55, title: "President" };

// Name swap for display, matching the data build: swap the opening sounds of first and last name.
const onset = (w) => (w.match(/^[^aeiouAEIOU]*/) || [""])[0];
const fix = (w) => w.split(" ").map((p) => p.split("-").map((q) => q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()).join("-")).join(" ");
export function swapName(first, last) {
  const f = first.split(" ")[0], of = onset(f), ol = onset(last);
  if (!of && !ol) return [fix(last[0] + f.slice(1)), fix(f[0] + last.slice(1))];
  if (of.toLowerCase() === ol.toLowerCase()) return [f, last.length > 3 ? fix(last.split("").reverse().join("")) : last + "son"];
  return [fix(ol + f.slice(of.length)), fix(of + last.slice(ol.length))];
}
for (const c of [...CABINET, PRESIDENT]) { const [a, b] = swapName(c.first, c.last); c.sf = a; c.sl = b; }
PRESIDENT.sf = "Tonald"; PRESIDENT.sl = "Drump";
PRESIDENT.look = { skin: 1, hair: "#e2c27a", style: "wave" };
CABINET[0].sf = "VD"; CABINET[0].sl = "Jance";   // a plain initial swap; the sound swap reads as an insult
