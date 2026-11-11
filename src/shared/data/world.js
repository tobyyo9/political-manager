// The world as of November 2026: election night, the people in charge, and who you are.
// Only facts reported by news outlets after the Nov 3, 2026 election are used here.
// Some races and leadership votes were still pending as of Nov 8, 2026.

export const ELECTION_NIGHT = [
  { state: "Texas", head: "Talarico wins Texas", body: "Talarico beats Paxton, the first Texas Democrat to win a Senate race since 1988. Hinojosa ousts Gov. Abbott." },
  { state: "Kansas", head: "Kansas sends a Democrat to the Senate", body: "Adam Hamilton beats Sen. Roger Marshall: the first Kansas Democrat in the Senate since 1932." },
  { state: "South Carolina", head: "Andrews makes history", body: "Annie Andrews becomes the first woman South Carolina has elected to the Senate." },
  { state: "Ohio", head: "Brown is back", body: "Sherrod Brown unseats Sen. Husted; Amy Acton beats Vivek Ramaswamy for governor." },
  { state: "Maine", head: "Collins falls", body: "Troy Jackson beats Sen. Susan Collins, then says he won't back Schumer as leader." },
  { state: "Iowa · N. Carolina · Georgia", head: "And more", body: "Turek and Sand sweep Iowa, Cooper takes North Carolina, Bottoms wins Georgia." },
];

export const WHY = [
  ["44%", "of voters said their vote was to oppose the President"],
  ["63%", "blamed his policies for high prices"],
  ["58% to 38%", "independents backed Democrats, after splitting about evenly in 2024"],
  ["~3 in 4", "voters under 30 who backed Democrats"],
];

// The people in charge. status: "in office", "expected" (leadership vote pending), "contested".
export const LEADERS = [
  { name: "Donald Trump", role: "President", party: "R", status: "in office", note: "Second term; cannot run again in 2028. Signs or vetoes everything Congress sends." },
  { name: "JD Vance", role: "Vice President", party: "R", status: "in office", note: "Presides over the Senate and breaks ties." },
  { name: "Scott Bessent", role: "Treasury Secretary", party: "R", status: "in office", note: "Manages federal borrowing, including how long Treasury can last under the debt limit." },
  { name: "Pete Hegseth", role: "Defense Secretary", party: "R", status: "in office", note: "Runs the Iran war. Faces a possible House impeachment vote." },
  { name: "Kevin Warsh", role: "Federal Reserve Chair", party: "", status: "in office", note: "Confirmed in May 2026. Sets interest rates, which drive the government's interest bill." },
  { name: "Hakeem Jeffries", role: "Speaker of the House (expected)", party: "D", status: "expected", note: "House Democratic leader, in line to become Speaker when the new Congress meets." },
  { name: "Chuck Schumer", role: "Senate Majority Leader (expected)", party: "D", status: "contested", note: "Expected to keep the top job, but some incoming senators, including Troy Jackson, say they will not back him." },
  { name: "Jim Jordan or Steve Scalise", ini: "?", role: "House Republican Leader (race underway)", party: "R", status: "contested", note: "Speaker Mike Johnson is not running for minority leader. Jordan and Scalise are competing for it." },
  { name: "John Thune", role: "Senate Republican Leader", party: "R", status: "expected", note: "Leads Senate Republicans in the current Congress; leadership elections are pending." },
];

export const NEW_FACES = [
  { name: "James Talarico", role: "Senator-elect, Texas", party: "D" },
  { name: "Adam Hamilton", role: "Senator-elect, Kansas", party: "D" },
  { name: "Annie Andrews", role: "Senator-elect, South Carolina", party: "D" },
  { name: "Sherrod Brown", role: "Senator-elect, Ohio", party: "D" },
  { name: "Troy Jackson", role: "Senator-elect, Maine", party: "D" },
  { name: "Roy Cooper", role: "Senator-elect, North Carolina", party: "D" },
  { name: "Josh Turek", role: "Senator-elect, Iowa", party: "D" },
  { name: "Abdul El-Sayed", role: "Senator-elect, Michigan", party: "D" },
];

// Who you play. The player is a fictional senior strategist, so the game never
// puts invented words or decisions on real people.
export const PERSONAS = {
  dem_leaders: {
    title: "Chief strategist to the new Democratic majority",
    short: "the Democratic majority",
    brief: [
      "You spent the last two years in the minority, watching. Now the gavels are yours. The Speaker's office and the Senate leader's office both run their big decisions past you: what comes to the floor, what goes in the budget bill, what to trade with the White House.",
      "The wave gave you seats, not a mandate for everything. Half of the voters who put you here call themselves moderates. A third of your own voters call themselves democratic socialists. The President still has a veto pen, and in 2028 the country decides whether this was a fluke.",
    ],
  },
  white_house: {
    title: "Senior advisor to the President",
    short: "the White House",
    brief: [
      "Election night was a rout. The President's party lost the House, the Senate, and Senate races in Texas, Kansas and South Carolina. You were in the room when the calls came in.",
      "For the next two years nothing becomes law without the other party. The war, prices and the debt are all still on your desk, and in 2028 your party's nominee runs on your record. The President cannot run again; his legacy can.",
    ],
  },
};

export const WORLD_SOURCES = [
  ["AP via WSB-TV, Democrats capture governorships in Texas and other GOP-controlled states (Nov 4, 2026)", "https://www.wsbtv.com/news/politics/democrats-press-win/BXHEBW6A2UYTTC2TMAFF3EHQ3I/"],
  ["WLOS / Sinclair live results: Andrews, Talarico, Brown unseat Republicans (Nov 3, 2026)", "https://wlos.com/news/nation-world/live-polls-begin-closing-as-americans-cast-ballots-to-decide-control-of-congress-election-day-midterms-democrats-republicans"],
  ["Fortune, How the Democratic party flipped the House and Senate, in 12 charts (Nov 5, 2026)", "https://fortune.com/2026/11/05/democratic-party-flip-senate-house-midterm-race-12-charts/"],
  ["Scripps News, Who will lead Congress? Leadership battles take center stage (Nov 6, 2026)", "https://www.news5cleveland.com/politics/america-votes/who-will-lead-congress-leadership-battles-take-center-stage-after-midterms"],
  ["AP VoteCast via ABC7, Repudiation of Trump, economic pain drove Democrats to victory", "https://abc7news.com/story/repudiation-trump-economic-pain-drove-democrats-victory-house-voter-poll-analysis/20015855/"],
  ["ABC News, Senate confirms Kevin Warsh as Fed chair (May 13, 2026)", "https://www.goodmorningamerica.com/amp/news/story/senate-confirms-fed-chair-nominee-kevin-warsh-ending-132875814"],
];
