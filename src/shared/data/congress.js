// The 120th Congress, seated January 2027, after the Nov 3, 2026 midterms.
// Results checked Nov 9, 2026 (AP / NBC). Some races are still uncalled.

export const CONGRESS = {
  source: "2026 midterm results via AP and NBC News, checked Nov 9, 2026. House: NBC's estimate of final seats. Senate: called seats, with the two uncalled races given to the Democrats who lead them.",
  asOf: "2026-11-09",
  house: { D: 259, R: 176, total: 435, majority: 218, override: 290, note: "NBC estimate of final seats. AP had called 254 for Democrats and 162 for Republicans, with 19 races still uncalled, as of Nov 9." },
  senate: { D: 56, R: 44, total: 100, majority: 51, cloture: 60, override: 67, note: "Democrats hold 54 called seats. Alaska and Mississippi are still uncalled; the game gives both to the Democrats, who led as of Nov 9 (Peltola by about 640 votes, Colom by about 2,500)." },
  president: { party: "R", name: "President Trump" },
};

// Roles the player can take in Congress mode.
export const ROLES = [
  { id: "dem_leaders", label: "Democratic congressional leaders", party: "D",
    desc: "You set the agenda in both chambers. The President can veto anything you send him." },
  { id: "white_house", label: "The White House", party: "R",
    desc: "Your side signs or vetoes, but every bill has to get through a Democratic House and Senate." },
];
