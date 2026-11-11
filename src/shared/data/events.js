// Phase 4: the 2027-2028 term, played one quarter at a time.
// Scheduled cards are real deadlines on the calendar. Scenario cards are
// plausible events the game may deal you; they are not predictions.
//
// Effects (fx), all relative to the player's party:
//   capital: political capital change
//   mood:    { groupKey: amount } short-lived opinion shift, fades each quarter
//   scar:    { groupKey: amount } lasting opinion shift
//   shocks:  [{ year, amount }] added to that year's deficit, $B (negative saves)
//   boost:   { policyId: amount } extra pull toward yes on bills with that policy, this quarter
//   propose: { policyId: level } adds a policy to your plan (you still have to pass it)
//   enact:   [policyId] becomes law immediately
//   promise: { check, label, reward, penalty } judged on election night
//   flag:    state flag to set (e.g. defaulted)
// Group keys: a group id, "all", "center" (the persuadable middle), "base" (your side's core), "other" (their core).

export const QUARTERS = ["Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027", "Q1 2028", "Q2 2028", "Q3 2028", "Q4 2028"];
export const QUARTER_SPAN = ["Jan to Mar 2027", "Apr to Jun 2027", "Jul to Sep 2027", "Oct to Dec 2027", "Jan to Mar 2028", "Apr to Jun 2028", "Jul to Sep 2028", "Oct to Nov 2028"];

// Years from the middle of quarter q to the election (Nov 7, 2028).
export const yearsToElection = (q) => Math.max(0, 1.725 - 0.25 * q);

export const CAPITAL_PER_QUARTER = 20;
export const CAPITAL_MAX = 120;
export const MOOD_DECAY = 0.8;

export const GROUP_SETS = {
  center: ["ppr", "tom", "ool", "ur"],
  D: ["ll", "lp", "lol"],
  R: ["nar", "ffc", "ur"],
};

const SS_FIX = ["ss_payroll_250k", "ss_rate", "ss_age", "ss_progressive", "chained_cpi"];

// ctx passed to text and fx functions:
// { party: "D"|"R", wh: true if you are the White House, has(id), proj, base (avg base score), defaulted, ssFixed }

export const SCHEDULED = [
  {
    id: "sworn_in", q: 0, date: "Jan 3, 2027", kind: "scheduled",
    title: "The 120th Congress is sworn in",
    body: (c) => c.wh
      ? "Democrats now run both chambers. Every bill the President wants needs their votes, and they control which bills reach the floor. How do you open?"
      : "Your party runs both chambers for the first time since 2022, with a Republican in the White House. Every bill still needs his signature or a two-thirds override. How do you open?",
    choices: [
      { label: "Lead with a bipartisan bill", desc: "Persuadable voters notice. Your base wanted a fight.",
        fx: { mood: { center: 0.12, base: -0.06 } } },
      { label: "Lead with your base's top priority", desc: "Energizes your side and builds capital, at a cost in the middle.",
        fx: { capital: 15, mood: { base: 0.15, center: -0.05 } } },
      { label: (c) => (c.wh ? "Go on offense against the new majority" : "Open with oversight hearings"), desc: "Big capital gain from your side, but the middle tunes out.",
        fx: { capital: 25, mood: { base: 0.1, center: -0.1 } } },
    ],
  },
  {
    id: "impeach_hegseth", q: 0, date: "Jan 2027", kind: "scheduled",
    title: "Impeach the Defense Secretary?",
    body: (c) => c.wh
      ? "Rep. Thomas Massie's eight articles of impeachment against Pete Hegseth, charging that he exceeded his authority and ignored war powers limits on Iran, Venezuela and strikes in the Caribbean, were stalled by the old Republican majority. Now Democrats run the House and want a vote. Conviction would take 67 senators."
      : "Rep. Thomas Massie, a Republican, filed eight articles of impeachment against Defense Secretary Pete Hegseth last fall, charging that he exceeded his authority and ignored war powers limits on Iran, Venezuela and strikes in the Caribbean. The old Republican majority stalled them. Now you run the House. Impeaching takes a simple majority; removing him takes 67 senators, so you would need at least 11 Republicans.",
    cite: "Stars and Stripes (Sep 16, 2026); AP via GV Wire (Nov 5, 2026)",
    choices: (c) => c.wh ? [
      { label: "Stand by him", desc: "Your base rallies. The middle is uneasy about the war.",
        fx: { mood: { base: 0.08, center: -0.06 } } },
      { label: "Ask him to resign", desc: "Takes the issue off the table. The MAGA core calls it surrender.",
        fx: { capital: -5, mood: { center: 0.08, nar: -0.1 } } },
      { label: "Call it a witch hunt", desc: "Fires up your side and builds capital, but feeds the story.",
        fx: { capital: 10, mood: { base: 0.1, center: -0.08 } } },
    ] : [
      { label: "Hold the impeachment vote", desc: "The House impeaches; the Senate almost certainly won't convict. Your base cheers, the war becomes the story, and floor time costs capital.",
        fx: { capital: -10, mood: { base: 0.12, center: -0.02, nar: -0.08, ffc: -0.05 } } },
      { label: "War powers hearings first", desc: "Build the record under oath before deciding. Slower, and your base wants action now.",
        fx: { capital: 5, mood: { center: 0.06, base: -0.03 } } },
      { label: "Drop it and focus on prices", desc: "Keeps the agenda on the economy. Progressives feel let down.",
        fx: { capital: 10, mood: { center: 0.04, ll: -0.06, lp: -0.1 } } },
    ],
  },
  {
    id: "pardons", q: 1, date: "Spring 2027", kind: "scenario",
    title: "The President's preemptive pardons",
    body: (c) => c.wh
      ? "Democratic committees are subpoenaing your officials. On Nov 2, 2026 the President told the New York Post he would issue preemptive pardons to protect his people \"if I needed to,\" as he did in November 2025 for 77 people tied to efforts to overturn the 2020 election. Aides say he is ready to sign a blanket pardon."
      : "Your committees have started subpoenaing administration officials. On Nov 2, 2026 the President told the New York Post he would issue preemptive pardons to protect his people \"if I needed to.\" He did it before, in November 2025, for 77 people tied to efforts to overturn the 2020 election. This quarter, he signs a blanket pardon for dozens of current and former officials.",
    cite: "New York Post interview via American Greatness (Nov 3, 2026); Washington Times on the November 2025 pardons",
    choices: (c) => c.wh ? [
      { label: "Sign the blanket pardon", desc: "Protects your people and thrills the base. Persuadable voters see a cover-up.",
        fx: { capital: 10, mood: { base: 0.06, center: -0.1, ppr: -0.06 } } },
      { label: "Pardon only a few", desc: "Splits the difference. Nobody is fully happy.",
        fx: { mood: { center: -0.03, nar: -0.03 } } },
      { label: "Hold off and let them testify", desc: "Looks clean to the middle. The MAGA core calls it betrayal.",
        fx: { capital: -5, mood: { center: 0.06, nar: -0.1 } } },
    ] : [
      { label: "Push a pardon reform bill", desc: "Adds pardon transparency and limits to your plan. Popular, but he will veto it, so you need an override.",
        fx: { propose: { pardon_reform: 0 }, boost: { pardon_reform: 0.15 }, mood: { base: 0.06, center: 0.03 } } },
      { label: "Keep investigating", desc: "Once pardoned, they can't plead the Fifth about the federal crimes the pardon covers. Subpoena them all. Your base loves it; the middle may tune out.",
        fx: { capital: 5, mood: { base: 0.08, center: -0.03 } } },
      { label: "Move on to prices", desc: "Keeps the focus on the economy. Your base wanted a fight.",
        fx: { capital: 10, mood: { center: 0.03, ll: -0.05, lp: -0.08 } } },
    ],
  },
  {
    id: "trustees", q: 1, date: "Spring 2027", kind: "scheduled",
    title: "The Social Security trustees report lands",
    body: () => "The trustees' annual report is due in the spring. Last year's put the retirement fund's depletion in 2032, when benefits would be cut about 22% automatically. Reporters want to know your plan.",
    cite: "CRFB analysis of the 2026 Trustees Report",
    cond: (c) => !c.ssFixed,
    choices: [
      { label: "Promise a fix before the election", desc: "Wins you room now. Judged on election night: close the gap or pay for it.",
        fx: { capital: 10, mood: { all: 0.05 },
          promise: { check: "ssFixed", label: "Fix Social Security before the election", reward: { all: 0.12 }, penalty: { all: -0.2 } } } },
      { label: "Say it can wait until after 2028", desc: "Safe for now. Seniors notice.",
        fx: { mood: { all: -0.05 } } },
    ],
  },
  {
    id: "funding_2027", q: 2, date: "Sep 30, 2027", kind: "scheduled",
    title: "Government funding runs out",
    body: () => "Fiscal year 2028 starts October 1. Without a stopgap or the twelve spending bills, parts of the government shut down.",
    choices: [
      { label: "Pass a clean stopgap", desc: "No drama. Your base sees a missed chance.",
        fx: { capital: -5, mood: { base: -0.05 } } },
      { label: "Attach your priorities and dare them to say no", desc: "A shutdown. Your base cheers; the middle blames whoever looks like they caused it.",
        fx: { capital: 10, mood: { base: 0.1, center: -0.2 }, shocks: [{ year: 2028, amount: 5 }] } },
      { label: "Cut a full-year deal with modest spending cuts", desc: "Saves money. Both bases grumble.",
        fx: { capital: -10, mood: { base: -0.1, center: 0.05 }, shocks: Array.from({ length: 9 }, (_, i) => ({ year: 2028 + i, amount: -15 })) } },
    ],
  },
  {
    id: "x_date", q: 3, date: "Fall 2027", kind: "scheduled",
    title: "The debt limit X-date arrives",
    body: (c) => c.has("debt_limit")
      ? "You already raised the limit, so Treasury keeps paying every bill. Markets barely notice."
      : "Treasury is out of room under the $41.1T limit. Without a vote, it cannot pay every bill on time.",
    cite: "Treasury data via Fortune, Nov 2026",
    choices: (c) => c.has("debt_limit")
      ? [{ label: "Continue", desc: "Crisis avoided.", fx: { mood: { center: 0.05 } } }]
      : [
        { label: "Pass a clean increase at the last minute", desc: "The limit goes up. You look like you nearly let it happen.",
          fx: { capital: -15, mood: { center: -0.05 }, enact: ["debt_limit"] } },
        { label: "Hold out for concessions", desc: "Treasury misses payments for the first time. Interest rates jump and stay higher.",
          fx: { capital: -20, scar: { all: -0.35 }, flag: "defaulted",
            shocks: Array.from({ length: 9 }, (_, i) => ({ year: 2028 + i, amount: 75 })) } },
      ],
  },
  {
    id: "funding_2028", q: 6, date: "Sep 30, 2028", kind: "scheduled",
    title: "Government funding runs out, five weeks before the election",
    body: () => "Fiscal year 2029 starts October 1. Any shutdown would still be going on when people vote.",
    choices: [
      { label: "Pass a clean stopgap into December", desc: "Kick it past the election.",
        fx: { capital: -5 } },
      { label: "Force a fight over your priorities", desc: "A pre-election shutdown. High risk in the middle.",
        fx: { capital: 10, mood: { base: 0.12, center: -0.3 }, shocks: [{ year: 2029, amount: 5 }] } },
    ],
  },
];

// Cards that fire when conditions are met. Checked before scenario cards.
export const TRIGGERED = [
  {
    id: "default_continues", date: "Ongoing", kind: "crisis", once: false,
    cond: (c) => c.defaulted && !c.has("debt_limit"),
    title: "Treasury is still missing payments",
    body: () => "Social Security checks, military pay and bondholders are all being paid late. Every quarter this lasts makes it worse.",
    choices: [
      { label: "Raise the limit now", desc: "End it. The damage already done stays.",
        fx: { capital: -10, enact: ["debt_limit"] } },
      { label: "Keep holding out", desc: "Another quarter of missed payments.",
        fx: { scar: { all: -0.25 }, shocks: Array.from({ length: 8 }, (_, i) => ({ year: 2029 + i, amount: 40 })) } },
    ],
  },
  {
    id: "bond_jitters", date: "This quarter", kind: "scenario", once: true, minQ: 1,
    cond: (c) => c.proj.debtPct2036 > 118,
    title: "Bond markets get nervous",
    body: (c) => `Your enacted plan still has debt reaching ${Math.round(c.proj.debtPct2036)}% of GDP by 2036. A weak Treasury auction pushes 10-year yields up, and analysts point at Washington.`,
    choices: [
      { label: "Announce a serious deficit plan", desc: "Calms markets. Costs capital and puts you on the hook.",
        fx: { capital: -15, mood: { center: 0.05 },
          promise: { check: "stabilize", label: "Enact a plan that bends the debt path below 110% of GDP", reward: { center: 0.1 }, penalty: { all: -0.12 } } } },
      { label: "Blame the other party and move on", desc: "Higher interest costs for years.",
        fx: { shocks: Array.from({ length: 9 }, (_, i) => ({ year: 2028 + i, amount: 40 })) } },
    ],
  },
  {
    id: "primaries", date: "Early 2028", kind: "scheduled", once: true, minQ: 4, maxQ: 4,
    cond: (c) => c.base < 0.15,
    title: "Primary challengers smell blood",
    body: () => "Presidential and congressional primaries start. Your own base thinks you have not delivered, and challengers are raising money off it.",
    choices: [
      { label: "Throw your base a bone", desc: "Calms the primaries. The middle notices.",
        fx: { capital: -5, mood: { base: 0.15, center: -0.05 } } },
      { label: "Hold the center", desc: "Expensive primaries, but you keep the middle.",
        fx: { capital: -20, mood: { center: 0.05, base: -0.05 } } },
    ],
  },
];

// One drawn per quarter from Q1 2027 to Q3 2028. Labeled as possible events.
export const SCENARIOS = [
  {
    id: "gas_spike", title: "Gas prices jump after an attack on Gulf shipping",
    body: () => "Gas prices already rose sharply after the Iran war began. A new attack pushes them up again heading into driving season.",
    choices: [
      { label: "Push a release from the Strategic Petroleum Reserve", desc: "Some relief for drivers; hawks complain.",
        fx: { mood: { center: 0.06, nar: -0.03 } } },
      { label: "Suspend the federal gas tax for the summer", desc: "Visible relief, about $10B in lost revenue.",
        fx: { mood: { all: 0.06 }, shocks: [{ year: 2027, amount: 10 }] } },
      { label: "Ride it out", desc: (c) => (c.wh ? "Voters blame the President." : "Voters mostly blame the President, but some blame you."),
        fx: (c) => ({ mood: { all: c.wh ? -0.12 : -0.03 } }) },
    ],
  },
  {
    id: "ceasefire", title: "Iran ceasefire talks open",
    body: () => "Mediators announce talks on a ceasefire. Hawks warn against rewarding Tehran.",
    choices: [
      { label: "Back the talks", desc: "Popular in the middle and the left. The hawkish right objects.",
        fx: { mood: { center: 0.08, ll: 0.05, lp: 0.05, nar: -0.1 } } },
      { label: "Demand tougher terms", desc: "Plays well with the right.",
        fx: { mood: { nar: 0.1, ffc: 0.05, center: -0.05, ll: -0.05 } } },
    ],
  },
  {
    id: "escalation", title: "The Iran war escalates",
    body: () => "A strike on U.S. forces brings calls for more troops. The Pentagon wants another year of operations funded.",
    choices: [
      { label: "Put the larger war funding bill on the table", desc: "Adds the full request plus a year of operations to your plan. Members feel pressure to back the troops this quarter.",
        fx: { propose: { iran_supp: 2 }, boost: { iran_supp: 0.12 }, mood: { nar: 0.05, ffc: 0.05, lp: -0.08 } } },
      { label: "Push the war powers resolution instead", desc: "Adds a vote to end the war to your plan.",
        fx: { propose: { war_powers: 0 }, boost: { war_powers: 0.1 }, mood: { ll: 0.05, lp: 0.08, nar: -0.08 } } },
    ],
  },
  {
    id: "recession", title: "The economy stalls",
    body: () => "Two weak jobs reports and falling consumer spending. Revenue comes in about $200B short this year and next (game estimate).",
    choices: [
      { label: "Pass a stimulus package", desc: "About $300B more borrowing; helps working families in the middle.",
        fx: { shocks: [{ year: 2027, amount: 200 }, { year: 2028, amount: 500 }], mood: { center: 0.12, lol: 0.08 } } },
      { label: "Hold the line on spending", desc: "Deficit hawks approve. Everyone else is hurting.",
        fx: { shocks: [{ year: 2027, amount: 200 }, { year: 2028, amount: 200 }], mood: { center: -0.1, ppr: 0.05 } } },
    ],
  },
  {
    id: "hurricane", title: "A major hurricane hits the Gulf Coast",
    body: () => "Houston and the Louisiana coast take a direct hit. Governors ask for emergency aid.",
    choices: [
      { label: "Pass disaster aid quickly", desc: "About $60B, borrowed. Nobody objects for long.",
        fx: { shocks: [{ year: 2027, amount: 30 }, { year: 2028, amount: 30 }], mood: { all: 0.05 } } },
      { label: "Demand spending offsets first", desc: "Saves the borrowing. Weeks of delay look terrible on TV.",
        fx: { capital: 5, mood: { all: -0.1, ppr: 0.03 } } },
    ],
  },
  {
    id: "stock_scandal", title: "A stock trading scandal hits your caucus",
    body: () => "A senior member of your party traded defense stocks days before a classified briefing became public.",
    choices: [
      { label: "Bring a stock trading ban to the floor", desc: "Adds the ban to your plan, with extra pressure on members to vote yes this quarter.",
        fx: { propose: { stock_ban: 0 }, boost: { stock_ban: 0.2 }, mood: { center: 0.05 } } },
      { label: "Close ranks", desc: "Voters across the spectrum hate this.",
        fx: { mood: { all: -0.1 } } },
    ],
  },
  {
    id: "shooting", title: "A mass shooting at a high school",
    body: () => "Another school shooting dominates the news. Parents and students march on the Capitol.",
    choices: [
      { label: "Push background checks now", desc: "Adds universal background checks to your plan, with extra pressure on members this quarter.",
        fx: { propose: { background_checks: 0 }, boost: { background_checks: 0.15, red_flag: 0.15 }, mood: { ll: 0.05, lp: 0.05, nar: -0.05 } } },
      { label: "Focus on school security and mental health", desc: "Comfortable for the right; the left is angry.",
        fx: { mood: { nar: 0.03, ffc: 0.03, ll: -0.08, lp: -0.08 } } },
    ],
  },
  {
    id: "ai_layoffs", title: "AI layoffs make headlines",
    body: () => "Several large employers announce cuts tied to automation. Worried workers want Washington to do something.",
    choices: [
      { label: "Back federal AI rules", desc: "Adds AI rules to your plan.",
        fx: { propose: { ai_rules: 0 }, boost: { ai_rules: 0.1 }, mood: { ool: 0.05, tom: 0.05 } } },
      { label: "Stay out of it", desc: "Tech is happy. Workers notice.",
        fx: { mood: { ool: -0.05, tom: -0.05, lol: -0.05 } } },
    ],
  },
  {
    id: "drug_prices", title: "A common drug's price triples",
    body: () => "A shortage lets a manufacturer triple the price of a widely used heart medication.",
    choices: [
      { label: "Push drug price negotiation", desc: "Adds expanded negotiation to your plan, with extra pressure this quarter.",
        fx: { propose: { drug_neg: 0 }, boost: { drug_neg: 0.12 }, mood: { center: 0.04 } } },
      { label: "Call hearings and leave it there", desc: "Little cost, little gain.",
        fx: { mood: { all: -0.03 } } },
    ],
  },
  {
    id: "jobs_boom", title: "A surprisingly strong jobs report",
    body: () => "Hiring beats every forecast and wages rise. Both parties rush to take credit.",
    choices: [
      { label: "Take credit", desc: (c) => (c.wh ? "It is the President's economy. Voters agree." : "Voters mostly credit the President."),
        fx: (c) => ({ mood: { all: c.wh ? 0.08 : 0.02 } }) },
      { label: "Warn it will not last without your agenda", desc: "Plays to your base.",
        fx: { mood: { base: 0.06 } } },
    ],
  },
];

export const resolve = (x, c) => (typeof x === "function" ? x(c) : x);

export const EVENTS_SOURCE = "Scheduled cards use the real calendar (Congress convenes Jan 3, 2027; fiscal years start Oct 1; the debt limit X-date estimate; the trustees' annual report). Scenario cards are plausible events, not predictions. All opinion and dollar effects of events are game estimates.";
