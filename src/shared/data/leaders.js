// The person you actually deal with in each faction. These are fictional composite
// characters, not real members of Congress. Their traits change how whipping works
// and what they ask for in return.

export const TRAITS = {
  dealmaker: { label: "Dealmaker", desc: "Easier to move, but always wants something back." },
  believer: { label: "True believer", desc: "Moves only if their voters like the bill. Never asks for favors." },
  grudge: { label: "Holds grudges", desc: "Remembers broken promises twice as long." },
  vain: { label: "Vain", desc: "Your clout counts double with them. Likes to be asked personally." },
  loyalist: { label: "Party loyalist", desc: "Follows their own party's leaders. Rarely asks for much." },
  follower: { label: "Follows the President", desc: "Moves when the President signals he likes a bill." },
};

export const LEADERS = {
  "D:ll": { name: "Sen. Helen Marsh", ini: "HM", trait: "loyalist", note: "Senior appropriator from New England. Institution-minded, protective of leadership." },
  "D:lp": { name: "Rep. Dani Ruiz", ini: "DR", trait: "believer", note: "Second-term progressive from the Bronx. Organizer before Congress." },
  "D:lol": { name: "Rep. Marcus Boyd", ini: "MB", trait: "grudge", note: "Former union electrician from Ohio. Distrusts deals made over his head." },
  "D:ool": { name: "Rep. Teresa Vance", ini: "TV", trait: "dealmaker", note: "Former county sheriff from South Texas. Tough on crime, wants results for her district." },
  "D:ppr": { name: "Sen. Walt Kimball", ini: "WK", trait: "vain", note: "Swing-state moderate who loves the Sunday shows and bipartisan photo ops." },
  "R:nar": { name: "Rep. Cody Strand", ini: "CS", trait: "follower", note: "Freedom Caucus firebrand. Takes his cues from the President." },
  "R:ffc": { name: "Sen. Ruth Ellison", ini: "RE", trait: "believer", note: "Social conservative from the rural South. Votes her convictions." },
  "R:ur": { name: "Rep. Jace Whitlock", ini: "JW", trait: "vain", note: "Young populist with a big online following. Likes being courted." },
  "R:ppr": { name: "Sen. Lyle Hargrove", ini: "LH", trait: "dealmaker", note: "Old-school appropriator from the Plains. Trades votes for projects back home." },
  "R:ool": { name: "Rep. Ana Delgado", ini: "AD", trait: "grudge", note: "Represents a working-class Latino district in Florida. Burned before by both parties." },
};

export const leaderOf = (party, gid) => LEADERS[`${party}:${gid}`] || null;

// How likely a leader is to ask for a favor after you move their faction.
export const ASK_CHANCE = { dealmaker: 1, believer: 0, grudge: 0.6, vain: 0.5, loyalist: 0.3, follower: 0.5 };

export const TIE_LABEL = (t) => (t <= -0.4 ? "Burned" : t < -0.1 ? "Wary" : t < 0.15 ? "Neutral" : t < 0.45 ? "Friendly" : "Ally");

export const ASK_LINES = {
  dealmaker: (what, when) => `"Happy to help. Now you help me: I need ${what} passed ${when}."`,
  grudge: (what, when) => `"My people went out on a limb. Get ${what} done ${when}, and don't forget it."`,
  vain: (what, when) => `"I'll tell the cameras I made this happen. And I'll want ${what} passed ${when}."`,
  loyalist: (what, when) => `"We're with you. One thing: our members need ${what} ${when}."`,
  follower: (what, when) => `"The boss is watching. Give us ${what} ${when} and we're square."`,
  president: (what, when) => `"I helped you, very generously. Now I want ${what} on my desk ${when}."`,
};
