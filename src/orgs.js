// Outside players: donors, PACs, movement groups and foreign agents who want something from you.
// With real names off, each shows its invented name; with them on, the real organization or person.
// What they say and do in the game is invented; who they are and what they care about is public.
// kind: pac (writes checks), donor (a megadonor), org (movement group: endorsements, volunteers, pressure), foreign (influence from abroad).
// party: whose members they court ("D", "R" or "any"). x: where they sit, -1 left to +1 right. gid: linked interest group (votes feed its scorecard).
export const ORGS = [
  // PACs and industries (linked to the interest groups that already score your votes)
  { id: "phrma", gid: "pharma", kind: "pac", party: "any", x: 0.2, name: "PharmaForward", real: "PhRMA", budget: 30, note: "Drug industry. Wants Medicare drug negotiation stopped and PBMs reined in." },
  { id: "aipac", gid: "alliance", kind: "pac", party: "any", x: 0.3, name: "Citizens for a Secure Alliance", real: "AIPAC / United Democracy Project", budget: 60, note: "Pro-Israel lobby. Bundles donations and its super PAC spends millions in primaries." },
  { id: "cfg", gid: "growth", kind: "pac", party: "R", x: 0.8, name: "The Prosperity Club", real: "Club for Growth", budget: 50, note: "Fiscal hawks. Funds primary challengers to Republicans who vote for spending." },
  { id: "atr", gid: "lowtax", kind: "org", party: "R", x: 0.7, name: "Americans for Lower Taxes", real: "Americans for Tax Reform", budget: 0, note: "Keeper of the no-new-taxes pledge." },
  { id: "jd", gid: "insurgent", kind: "org", party: "D", x: -0.85, name: "New Majority Project", real: "Justice Democrats", budget: 10, note: "Recruits progressive challengers in safe Democratic seats." },
  { id: "api", gid: "energy", kind: "pac", party: "R", x: 0.6, name: "The Frontier Energy Alliance", real: "American Petroleum Institute", budget: 25, note: "Oil and gas. Permits yes, carbon taxes no." },
  { id: "fairshake", gid: "tech", kind: "pac", party: "any", x: 0.1, name: "The Digital Future PAC", real: "Fairshake (crypto)", budget: 80, note: "Crypto money. Spent over $100 million in 2024 and doesn't care which party you're in." },
  { id: "aia", gid: "defense", kind: "pac", party: "any", x: 0.4, name: "Arsenal Industries Council", real: "Aerospace Industries Association", budget: 20, note: "Defense contractors with jobs in hundreds of districts." },
  { id: "uscc", gid: "chamber", kind: "pac", party: "R", x: 0.4, name: "The National Enterprise Federation", real: "U.S. Chamber of Commerce", budget: 20, note: "Big business. A scorecard donors read." },
  { id: "aflcio", gid: "labor", kind: "pac", party: "D", x: -0.5, name: "United Workers Federation", real: "AFL-CIO", budget: 25, note: "Unions. Money, and more importantly volunteers." },
  { id: "nra", gid: "guns", kind: "pac", party: "R", x: 0.75, name: "The Liberty Arms Association", real: "NRA", budget: 10, note: "A letter grade its members check before they vote." },
  { id: "everytown", gid: "gunsafety", kind: "pac", party: "D", x: -0.5, name: "Safer Communities Now", real: "Everytown for Gun Safety", budget: 15, note: "Gun safety. Spends in the suburbs." },
  { id: "ppaf", gid: "choice", kind: "pac", party: "D", x: -0.6, name: "Reproductive Freedom Fund", real: "Planned Parenthood Action Fund", budget: 15, note: "Endorsements that move Democratic primary voters." },
  { id: "sba", gid: "life", kind: "org", party: "R", x: 0.8, name: "Family First Coalition", real: "SBA Pro-Life America", budget: 10, note: "Anti-abortion. Strong with religious conservatives." },
  { id: "lcv", gid: "green", kind: "pac", party: "D", x: -0.55, name: "Clean Future Voters", real: "League of Conservation Voters", budget: 15, note: "Environmental scorecard and field program." },
  { id: "aarp", gid: "seniors", kind: "org", party: "any", x: -0.1, name: "The Retirees' League", real: "AARP", budget: 0, note: "Doesn't give money. Its mail reaches every older voter you have." },
  { id: "numbersusa", gid: "border", kind: "org", party: "R", x: 0.85, name: "Secure Borders Action", real: "NumbersUSA", budget: 0, note: "Immigration restriction. Grades every vote." },
  // Megadonors
  { id: "musk", kind: "donor", party: "R", x: 0.55, name: "Mlon Eusk", real: "Elon Musk (America PAC)", budget: 5000, mega: true, cares: { ai_rules: -1, kids_online: -1, immigration: 1, tariffs_up: -1, debt_limit: -1 },
    note: "The biggest donor of the 2026 cycle: about $366 million for Republicans through America PAC and a Senate super PAC. Has threatened to fund primaries against Republicans who cross him." },
  { id: "adelson", kind: "donor", party: "R", x: 0.6, name: "Miriam Adelstein", real: "Miriam Adelson", budget: 1500, mega: true, cares: { iran_supp: 1, foreign_aid: 1, war_powers: -1 }, note: "One of the largest Republican donors. Israel is the issue that matters." },
  { id: "bloomberg", kind: "donor", party: "D", x: -0.3, name: "Bichael Mloomberg", real: "Michael Bloomberg", budget: 2000, mega: true, cares: { background_checks: 1, aw_ban: 1, carbon: 1, clean_energy: 1 }, note: "Funds Democrats in swing seats. Guns and climate are his causes." },
  { id: "hoffman", kind: "donor", party: "D", x: -0.35, name: "Heid Roffman", real: "Reid Hoffman", budget: 800, mega: true, cares: { ai_rules: -1, voting_rights: 1, immigration: 1 }, note: "Tech billionaire and Democratic megadonor. Likes AI, dislikes AI rules." },
  // Movement groups: endorsements, volunteers, pressure, ideas
  { id: "dsa", kind: "org", party: "D", x: -0.95, name: "Socialist Organizers of America", real: "Democratic Socialists of America", budget: 0, cares: { m4a: 1, wealth_tax: 1, ice_limits: 1, min_wage: 1, iran_supp: -1 }, note: "Door-knockers and an endorsement that matters in deep-blue cities. Expects a lot back." },
  { id: "indivisible", kind: "org", party: "D", x: -0.6, name: "Stand Together Now", real: "Indivisible", budget: 0, cares: { voting_rights: 1, ethics: 1, ice_limits: 1 }, note: "Grassroots anti-Trump network. Town halls, calls, protests." },
  { id: "sunrise", kind: "org", party: "D", x: -0.85, name: "Daybreak Climate Movement", real: "Sunrise Movement", budget: 0, cares: { clean_energy: 1, carbon: 1, permitting: -1 }, note: "Young climate activists. Loud, and they will sit in your office." },
  { id: "tpusa", kind: "org", party: "R", x: 0.8, name: "Campus Patriots Action", real: "Turning Point USA (Erika Kirk)", budget: 0, cares: { deport: 1, save_act: 1, gender_care: 1, dei: -1 }, note: "Youth conservative movement led by Erika Kirk since Charlie Kirk's death. Huge events, huge audience, and a 2028 favorite in mind." },
  { id: "heritage", kind: "org", party: "R", x: 0.75, name: "The Constitution Institute", real: "Heritage Foundation", budget: 0, cares: { school_choice: 1, deport: 1, ndd_grants: 1 }, note: "The conservative think tank behind Project 2025. Writes the bills; wants sponsors." },
  { id: "afp", kind: "org", party: "R", x: 0.65, name: "Americans for Free Enterprise", real: "Americans for Prosperity (Koch network)", budget: 30, cares: { tariff_repeal: 1, tariffs_up: -1, medicaid_cap: 1 }, note: "The Koch network. Free trade, less spending, a field army in swing states." },
  { id: "emily", kind: "pac", party: "D", x: -0.45, name: "Rising Women PAC", real: "EMILY's List", budget: 20, cares: { codify_roe: 1 }, note: "Elects pro-choice Democratic women. Only backs women." },
  // Influence from abroad (generic on purpose; these are about the law, not any one country)
  { id: "gulf", kind: "foreign", party: "any", x: 0, name: "Lobbyists for a Gulf monarchy", real: "Lobbyists for a Gulf monarchy", budget: 0, note: "A registered foreign agent under FARA. Legal to meet. Not legal to take their money." },
  { id: "statebiz", kind: "foreign", party: "any", x: 0, name: "A state-linked trade delegation", real: "A state-linked trade delegation", budget: 0, note: "Businessmen with ties to a foreign government. Generous with 'consulting' and trips." },
  { id: "diaspora", kind: "foreign", party: "any", x: 0, name: "A foreign government's 'friendship society'", real: "A foreign government's 'friendship society'", budget: 0, note: "Dinners, trips and introductions. Some of it is legal. Some of it ends with an FBI visit." },
];
export const orgById = Object.fromEntries(ORGS.map((o) => [o.id, o]));
