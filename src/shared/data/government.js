// Who holds power, as of early November 2026.
// Cabinet: Ballotpedia, "Donald Trump's Cabinet, 2025-2026" (as of Oct 2, 2026).
// Court: no vacancies; Justices Alito and Thomas said they are not retiring this term (Nov 2026 reports).

export const CABINET = [
  { name: "JD Vance", role: "Vice President", note: "Breaks ties in the Senate." },
  { name: "Susie Wiles", role: "White House Chief of Staff" },
  { name: "Marco Rubio", role: "Secretary of State" },
  { name: "Scott Bessent", role: "Treasury Secretary", note: "Manages federal borrowing and the debt limit." },
  { name: "Pete Hegseth", role: "Secretary of Defense", note: "Runs the Iran war. Faces a possible House impeachment vote." },
  { name: "Todd Blanche", role: "Attorney General", note: "Confirmed 50-49 in August 2026 after Pam Bondi was removed in April." },
  { name: "Markwayne Mullin", role: "Homeland Security Secretary", note: "Confirmed in March 2026 after Kristi Noem was removed." },
  { name: "Russell Vought", role: "Budget Director (OMB)", note: "Writes the President's budget and the White House's position on spending bills." },
  { name: "Robert F. Kennedy Jr.", role: "Health and Human Services", note: "Oversees Medicare and Medicaid, the second- and fourth-largest spending programs." },
  { name: "Howard Lutnick", role: "Commerce Secretary" },
  { name: "Jamieson Greer", role: "U.S. Trade Representative", note: "Runs tariff policy after the Supreme Court struck down the emergency tariffs." },
  { name: "Doug Collins", role: "Veterans Affairs" },
  { name: "Keith Sonderling", role: "Labor Secretary", note: "Sworn in October 2026 after Lori Chavez-DeRemer resigned." },
  { name: "Brooke Rollins", role: "Agriculture" },
  { name: "Doug Burgum", role: "Interior" },
  { name: "Chris Wright", role: "Energy" },
  { name: "Sean Duffy", role: "Transportation" },
  { name: "Scott Turner", role: "Housing and Urban Development" },
  { name: "Linda McMahon", role: "Education" },
  { name: "Lee Zeldin", role: "EPA Administrator" },
  { name: "Kelly Loeffler", role: "Small Business Administration" },
  { name: "John Ratcliffe", role: "CIA Director" },
  { name: "Jay Clayton", role: "Director of National Intelligence", note: "Confirmed July 2026 after Tulsi Gabbard left." },
  { name: "Michael Waltz", role: "Ambassador to the UN" },
];

export const OTHER_EXEC = [
  { name: "Kevin Warsh", role: "Federal Reserve Chair", note: "Independent agency. Confirmed May 2026. Interest rates drive the government's $1.1T interest bill." },
];

// side: which bloc the justice usually votes with. year: joined the Court.
export const COURT = [
  { name: "Sonia Sotomayor", by: "Obama", year: 2009, side: "liberal" },
  { name: "Elena Kagan", by: "Obama", year: 2010, side: "liberal" },
  { name: "Ketanji Brown Jackson", by: "Biden", year: 2022, side: "liberal" },
  { name: "John Roberts", by: "G.W. Bush", year: 2005, side: "conservative", chief: true },
  { name: "Brett Kavanaugh", by: "Trump", year: 2018, side: "conservative" },
  { name: "Amy Coney Barrett", by: "Trump", year: 2020, side: "conservative" },
  { name: "Neil Gorsuch", by: "Trump", year: 2017, side: "conservative" },
  { name: "Samuel Alito", by: "G.W. Bush", year: 2006, side: "conservative", note: "Said in Nov 2026 he will not retire this term." },
  { name: "Clarence Thomas", by: "G.H.W. Bush", year: 1991, side: "conservative", note: "Longest-serving justice. Staying on the Court." },
];

// Named seats in Congress. Everyone else shows as a party seat for now.
export const SENATE_NAMED = {
  D: [
    { name: "Chuck Schumer", note: "Expected majority leader; some new senators oppose him." },
    { name: "James Talarico", note: "Texas. New: first Texas Democrat elected to the Senate since 1988." },
    { name: "Adam Hamilton", note: "Kansas. New: first Kansas Democrat in the Senate since 1932." },
    { name: "Annie Andrews", note: "South Carolina. New: first woman the state has elected to the Senate." },
    { name: "Sherrod Brown", note: "Ohio. Returns after unseating Jon Husted." },
    { name: "Troy Jackson", note: "Maine. New: beat Susan Collins." },
    { name: "Roy Cooper", note: "North Carolina. New: former governor." },
    { name: "Josh Turek", note: "Iowa. New: first Paralympian in the Senate." },
    { name: "Abdul El-Sayed", note: "Michigan. New: backed by Bernie Sanders." },
    { name: "Mary Peltola", note: "Alaska. Leading Sen. Dan Sullivan by about 640 votes; not yet called." },
    { name: "Scott Colom", note: "Mississippi. Leading Sen. Cindy Hyde-Smith by about 2,500 votes; not yet called." },
  ],
  R: [
    { name: "John Thune", note: "Republican leader in the current Congress; leadership vote pending." },
  ],
};
export const HOUSE_NAMED = {
  D: [{ name: "Hakeem Jeffries", note: "Expected Speaker." }],
  R: [{ name: "Jim Jordan or Steve Scalise", note: "Competing to lead House Republicans. Mike Johnson is not running." }],
};

export const GOV_SOURCES = [
  ["Ballotpedia, Donald Trump's Cabinet, 2025-2026", "https://ballotpedia.org/Donald_Trump's_Cabinet,_2025-2026"],
  ["Latin Times, Alito and Thomas are staying on the Supreme Court (Nov 2026)", "https://www.latintimes.com/alito-thomas-stay-supreme-court-democratic-victory-600993"],
];
