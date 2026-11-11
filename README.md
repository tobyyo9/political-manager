# Political Manager (first playable)

Play one House member through the 120th Congress, January 2027 to the November 2028 election, in a
simulated Washington of 535 characters. Design plan: https://claude.ai/artifact/8HynroFz1CoTXxCKU3F7KL

## What is here
- `src/sim.js` – the simulation engine (no screen code): members, the vote formula, bills, favors, the weekly loop, primaries and the general election, rankings. Seeded, so a career replays exactly.
- `src/App.jsx`, `src/RollCall.jsx`, `src/pm.css` – the desk: inbox, bills and whip boards, the chamber, member cards, your seat, rankings, news, live roll calls.
- `src/groups.js` – 18 interest groups (invented names, real types): what each wants, who depends on them, and how they grade votes.
- `src/shared/` – the budget, opinion and policy engine shared with Fix the Deficit.
- `tools/build_data.py` – builds `src/data/members.json` from public sources and applies the name swap.
- `scripts/calibrate.py` – fits the vote formula to real roll calls (needs the Voteview files in `data/raw`).
- `tests/careers.mjs` – 72 headless careers that must finish without errors (`npm test`).
- `archive/ts-prototype/` – an earlier, smaller prototype kept for reference.

## Data
- Members, terms and committees: the open `unitedstates/congress-legislators` dataset.
- Ideology and roll calls: Voteview (119th Congress, through Nov 9, 2026).
- 2024 presidential vote by House district: The Downballot.
- The 120th Congress roster is not published yet. The House is the outgoing Congress adjusted to the projected
  2026 result (259 Democrats): the Republican seats that lean most Democratic are flipped and filled with
  invented placeholder newcomers. Which seats flipped is an estimate, to be replaced with certified results.

## Calibration (`data/calibration.json`)
A statistical version of the vote formula, fitted on 70% of real roll calls and scored on the other 30%:
House 97.5% of 282,559 individual votes called correctly (always-follow-your-party gets 96.6%);
Senate 97.0% (party line 94.0%). It catches about a quarter of defections from the party line.
The game's own weights are still set by hand in the same structure.

## Run
`npm install`, `npm run build` (writes `dist/political-manager.html`), `npm test`.

## Added Nov 10 (second pass)
- Interest groups feed every member's vote (the G term), grade the player's votes, offer money, and add or subtract points in the primary and general.
- Generated world events (14 kinds) move the economy, the President's approval and the national mood, put public pressure on related bills and rush new ones to the floor.
- Other characters act on their own: leadership rewards and punishes, burned colleagues back challengers, leak or block, allies sign on unasked, rivals take credit, watchdogs file ethics complaints.
- Difficulty dials (what you can see, how turbulent the world is), a first-week checklist, and an after-action report at the end of the term.

## Not built yet (from the plan)
The Senate and the President as full characters, committees and amendments as play, hearings and debates, leadership elections, multi-term careers and higher office, staff hiring, the media outlets, hidden-trait discovery beyond the four knowledge levels, cloud saves. The 120th roster still needs certified 2026 results.

## Added Nov 10 (third pass)
- Illustrated portraits for every character (generated from their id; generic, not likenesses), used across the desk.
- Capitol tab: Football Manager style leadership pyramid per party and chamber (party leaders, committee chairs or ranking members, most influential), caucus power (size, unity, posts, whether the bloc can sink party-line bills, ringleader), a caucus-to-caucus relations matrix, and every committee with chair, ranking member and seats.
- White House tab: the President's running commentary on every bill (including non sequiturs), sudden reversals that move his party, executive orders, a stance meter per bill, lobbying, approval chart.
- Network tab: everyone you know, as a hierarchy from allies to hostile.
- Office tab: your attributes (1 to 20), staff of five with skill and loyalty (legislative director sharpens whip counts, pollster sets poll error), trend chart.
- Member cards show attributes scouted by how well you know them (?, a range, or the number).
- Staff send polls, vote counts, gossip, press checks and district news to your inbox.
- Placeholder newcomers now have unique invented names and say so on their card.

## Fourth pass: the Senate and the executive branch (Nov 2026)
- Three ways to play: a House member, any senator, or the President.
- Senators: bills can start in the Senate; holds and talking filibusters; class 3 senators face the 2028 ballot, the rest get a verdict on their term.
- The President: sign or veto each bill that reaches the desk, override fights, call members, veto threats, the bully pulpit, rallies, executive orders that can be blocked in court, firing and nominating cabinet officers. The verdict is the 2028 presidential result; removal by the Senate is a defined failure.
- The Cabinet as characters (as reported Oct 30, 2026): scandal heat, resignations, firings, nominations from a bench of allies, Senate confirmation votes, oversight hearings, impeachment and trial votes for cabinet officers and the President.
- The President endorses or attacks members by name after big votes.
- Data: Oklahoma's special Senate winner (Hern) and his House successor; seats won on redrawn lines get an estimated lean.

## Fifth pass: committees, amendments and must-pass fights
- Every bill goes to a committee of jurisdiction in its first chamber. The chair can bury it; otherwise the committee marks it up and votes. Rosters are the 119th Congress's, so votes are scaled to the new Democratic majority ratio.
- If you sit on the committee, you get a markup choice: a poison pill, a bipartisan fix, a sweetener, or an amendment for your district. Other members amend bills too. Amendments shift each party's support on the floor.
- Must-pass bills: a stopgap (early 2027), the debt limit (estimated X-date, Aug 2027), fiscal 2028 funding, and a fiscal 2029 stopgap. These dates are game assumptions. Each side attaches riders; leaders drop riders when the Senate count is short; the President demands his own and vetoes riders he can't accept. Missing a deadline means a shutdown or a default, with blame that moves the national mood. Anyone can try to add or strip riders; the President gets the bill on his desk.

## Sixth pass: careers past 2028
- Win your race (or finish a term when you're not on the ballot) and you can serve in the next Congress, through as many terms as you keep winning.
- Each election reshapes Washington: seats flip with the national mood, members retire, and the White House changes hands every four years. Everyone who wins after 2026 is fictional, and so is the next President and cabinet (the real President is term-limited).
- Chamber control can flip, which swaps chairs and leadership titles. The President's party drives every vote calculation, so a Democratic President changes who follows whom.
- At the start of each term: run for party whip, go for chair or ranking member on your committee, and, for House members, a chance to run for the Senate when your state's seat is on the next ballot (you give up your House seat to run).
- Staff can be replaced with better (and pricier) hires from the Office tab. A career history panel tracks each Congress.
- The world is saved with the career and restored on reload.

## Seventh pass: realistic elections and the electoral map
- The national mood is now a generic ballot that settles where the President's approval puts it (an unpopular President costs his party, plus a small out-party edge) and moves gradually, so shutdown blame and scandals fade instead of piling up.
- Incumbents almost always survive primaries unless their own voters have turned on them; seat turnover per cycle is in the realistic range (roughly 10 to 30 House seats).
- An electoral map (Map tab): presidential forecast and results by state from each state's 2024 result plus the national swing, with 538 electoral votes (Maine and Nebraska splits not modeled); Senate races on the ballot; House delegations by state. State outlines from us-atlas (Census boundaries).
- Presidential results in long careers and the President's 2028 verdict are decided by electoral votes.

## Eighth pass: scenes
- Short staged scenes in a cable-news frame: a live bug, lower-thirds, a news ticker built from the week's headlines, a momentum meter, typed lines, and a newspaper front page at the end.
- Scene types: cable interviews (after a vote that breaks with your party, or now and then), oversight hearings (questioning or defending a cabinet officer under fire), closed-door meetings with the whip before a party vote you're shaky on, the general election debate, and for the President, press briefings and Oval Office meetings with members of his party.
- Each answer rolls your attributes (a blend of who you are and what you've built) against the other side's; risky answers swing harder. Prepping with your communications director costs 4 hours and helps more if they're good.
- Scenes wait in the inbox; if you don't play one in two weeks, your staff handles it with no effect. Effects: approval at home, your base, profile, relationships, cabinet heat, your vote deals with leadership, and up to 3.5 points on election night from the debate.
- Names with initials (J.D. Ford) now alter cleanly.

## Ninth pass: polish
- Save to file and load from file: a save holds the whole career, including every change to Washington since 2027, so it picks up exactly where you left off on any device. On claude.ai the save goes through the viewer's download prompt.
- Hall of fame: one entry per career, updated each term, kept in your browser, ranked by a score for winning, terms, laws, clout and leadership posts.
- Create a newcomer for the Senate: take any senator's seat; you face voters in 2028 only if that seat's class is up.

## Tenth pass: personalities and the press
- Every character has a voice: bombastic, firebrand, professional, artful dodger, beer buddy, true devotee (Republicans under a Republican President), show horse, wonk, old bull, or gaffe machine. It's set from their traits, ideology and seniority, shown on their card, and colors everything they say.
- The papers: fictional outlets run 3 to 4 stories a week. The President riffs on whatever is on his mind (sharks, windmills, the ballroom, Greenland, gold) and hands out nicknames; members make news in their own voice; votes get reactions. Articles show in the News tab, the inbox and on member cards, with real names swapped in when that toggle is on.
- All lines are invented for the game, written in character. Nothing is a real quote.
- Well-known members have personalities set by hand from their public style (71 of them, in src/data/personas.json). Everyone else is assigned by formula, and real people never get the "bombastic" or "gaffe machine" labels; those are for fictional characters.

## Eleventh pass: animation
- Your numbers count up or down when they change and flash green or red; the week's top headline slides in after "End the week".
- Roll calls: seats pop in as members vote, and the tally lights up when it crosses the number needed. The President's desk shows his portrait.
- Election night: on the end screen, the map fills in east to west as states are called, the electoral vote bars climb, and a winner is stamped at 270 (in midterm years, the Senate races). Replay button.
- Scenes: whoever is talking bobs, and the room's reaction rises after each answer.
- Everything respects the reduce-motion setting.

## Twelfth pass: Senate wings, money, and starting relationships
- The Senate has no formal caucuses, so senators now sit in the informal wings the press uses (Progressive wing, Moderate Democrats, MAGA wing, Institutionalists), set by hand for well-known senators; everyone else is mainstream. No senator is shown in a House caucus.
- Money: every member has an estimated mix of small donors, big donors and PACs, with industry ties from their committees; a few known no-corporate-PAC pledges are set by hand. PAC money strengthens the pull of the industries that give it. You can raise from big donors, corporate PACs (the most money, with strings: industries call before their votes, and crossing them funds your opponent) or small-dollar email (grows with your profile and base). You can swear off corporate PAC money. PAC-heavy Democrats in safe seats pay for it in primaries.
- Starting relationships come from shared history: years served together, the state delegation, shared committees, the same caucus or wing, and leadership. Veterans start with allies, a few cross-party friendships, rivals, and favors owed.
- Real-life ties: publicly known friendships, alliances and feuds (src/data/ties.json, 27 pairs, e.g. Booker and Tim Scott, Grassley and Wyden, the Squad, Cole and DeLauro, Omar and Boebert, Jordan and Raskin) start as the strongest relationships in the game, show with a star on member cards, and friends tend to move together when you whip one of them.

## Thirteenth pass: accuracy for the 120th Congress (Nov 11, 2026)
- About 50 more seats now hold the person who actually won them. These are members who retired, ran for another office or lost a primary. Examples: Lander for Goldman, Lasher for Nadler, Boafo for Hoyer, Lamb for Biggs, Trever Nehls for Troy Nehls, Biss for Schakowsky, Bronin for Larson, Rabb for Evans. LA-5, LA-6 (Dec. 12 runoffs) and CA-26 are still uncalled and marked that way. Sources are listed in `tools/build_data.py`.
- New senators: Letlow (LA), Alme (MT) and Hageman (WY). Each brings her or his House record where there is one.
- Renumbered incumbents follow their new seats. Casar moved to TX-37, and Moore, Maloy and Kennedy each moved down a seat in Utah. Redrawn seats in TX, LA, UT, NC, MO and OH get an estimated lean on the new lines (`NEW_LEAN`) in place of the 2024 number.
- Newcomers inherit their predecessor's committee seats at the bottom of the bench, shown as "expected".
- Every panel now has a Democratic chair and a Republican ranking member. Where the old chair or ranking member left, the most senior member of that party takes the post, also shown as expected.
- Leadership: Murray is the expected President Pro Tempore and Grassley no longer holds the title. Schatz is the expected Majority Whip, Clark the expected Majority Leader, and Jordan is challenging Scalise for House Republican leader.

## Fourteenth pass: campaigns, money between politicians, forcing votes
- **Your opponent.** About August of the first year, a named challenger files. How strong they are depends on your seat, the national mood and your approval. They raise money every week, bank it, then spend it on TV at the end, and run attack ads you can answer with an ad, in person, or not at all.
- **Spending the war chest.** You can buy TV (big but fades), field (lasts, but only pays if you start early) or mail (small and steady). Unspent money only deters; if you don't spend, your campaign manager buys ads on autopilot at worse rates. Election-night margin uses the same numbers (`projMargin`).
- **Polls.** Public polls run every six weeks, then every two near the end. Internal polls cost $25K and are only as good as your pollster.
- **Earmarks.** You can request up to three Community Project Funding (or Congressionally Directed Spending) projects for the full-year funding bill. Odds depend on majority status, an Appropriations seat, your relationship with the chair, and clout. Funded projects raise approval at home, and Freedom Caucus members pay a price with their base for asking.
- **Money between politicians, with real rules.** Campaign checks are capped at $2,000 per election and leadership PACs at $5,000 per election (FEC 2025-26). You can also headline a fundraiser, which raises real money and leaves them owing you a favor. Party dues follow the DCCC's 2026 goals ($165K for rank-and-file up to $1.1M for the leader); Frontline members are exempt, and leadership notices who pays. You can start a leadership PAC, and colleagues in tough races and challengers in seats you could take ask for help.
- **Party leaders steer a battleground fund.** The money goes to the closest races, members and challengers ask for it, and it moves the margin in those seats. Challengers you back are named, and if they win they arrive as allies who owe you. Funding people and paying dues help in leadership races.
- **Discharge petitions.** A House petition needs 218 signatures. The minority files them on popular bills. Majority members who sign defy their leaders, and leaders may try to turn a petition off with a rule vote.
- **Privileged resolutions.** Under the War Powers Resolution and the National Emergencies Act (tariff emergencies), any member can force a vote, and the Senate needs only 51.

## Fifteenth pass: the courts, the President's toolkit, and your own money
- **The Supreme Court as of Nov 2026.** Alito has said he'll stay through the term; Thomas has ruled out retiring. Retirements are most likely in early July, and only when the timing suits the justice's party; sudden vacancies are rare and depend on age.
- **Filling a seat.** The President picks from a shortlist of judges often named on Republican lists, or a consensus pick. The outcomes are invented. Hearings come with a Judiciary scene for senators on the committee; the floor vote needs 51. An opposite-party Senate may refuse hearings in an election year.
- **Lower courts and rulings.** Lower-court confirmations are a steady flow, slow when the other party runs the Senate, and senators decide on blue slips. The real docket is seeded: state assault weapons bans and the replacement tariffs. Laws you pass that are open to challenge get sued and decided the next June by the median justice. Blocked executive orders can be revived. Struck-down progressive laws boost court reform.
- **Crises.** Seven crises: Taiwan, Iran, a Russian drone strike on NATO, a cartel ambush, hostages, a cyberattack and a North Korean missile. The President chooses force, talks, sanctions or waiting, and the outcome comes four weeks later. Members choose to back the President, criticize, or force a war powers vote.
- **Pardons.** The President decides on nine kinds of pardon requests, from cronies to clemency cases; members react when the President issues one.
- **State of the Union.** It's a scene each February.
- **Your own money.** Lifetime earnings is a header stat.
  - Salaries are real 2026 figures: $174K for members, $193.4K for leaders and the President pro tempore, $223.5K for the Speaker, $400K for the President.
  - Investments: index funds, picking stocks, or trading on what you hear in closed briefings (big returns, with a chance of a story and an ethics complaint). A stock trading ban, if it becomes law, forces you to divest.
  - A book deal (royalties are exempt from the $33,855 cap on outside income), with the option of your campaign bulk-buying copies.
  - Teaching, up to the cap.
  - Your spouse on the campaign payroll, or your spouse's consulting firm taking lobbying clients (both legal-gray and risky).
  - For the President, foreign deals for the family business.
  - When your career ends, you choose a path for the next ten years: lobbying after the cooling-off period, boards, speeches, or going home. It's added to your total and the hall of fame.

## Sixteenth pass: fixes
- **A woman as President.** Every line about the President (news, posts, inbox, toasts, the White House page, roll calls) now uses the right pronouns when a fictional successor is a woman. Fictional Presidents no longer get the real one's riffs, and the scramble after a reversal names the President's own party.
- **Scenes vary over long careers.** TV interviews, press briefings, oversight hearings and debates rotate in alternative questions, about 4 to 5 per slot, so the same scene type rarely plays the same way twice. Debates now put you against your actual campaign opponent.
- **Swing seats are harder.** Personal approval now counts for at most +5 or -8 points of margin (it was 0.45 per point, uncapped). A well-liked member in a seat that leans the other way can still lose.
- **The vote formula is checked against real 2025-26 roll calls** (`npm run calibrate`): the SAVE Act, both Canada tariff votes, the ACA subsidy discharge, Iran war powers, the rescissions package and the reconciliation bill.
  - Known crossovers by members still serving are in `src/data/record.json` and count as a new "their record on this issue" term: Paul on tariffs, war and the big bill; Murkowski on tariffs and rescissions; Fetterman on Iran; Case, Cuellar and Gluesenkamp Perez on the SAVE Act; Hurd on tariffs. The 5 Republicans still serving who voted for the 2026 ACA subsidy extension (Hurd, Salazar, Garbarino, LaLota, Joyce) now lean toward voting for it again.
  - The out-party now resists the President's priorities about twice as hard.
  - The squared error against real party crossover rates fell by half.

## Seventeenth pass: animation
- **Roll calls.** A pixel gavel drops and the result stamp slams with a small screen shake. Members who crossed party lines are ringed in gold and listed by name.
- **Your race on election night.** Precincts report live, the lead swings with early returns and settles on the real margin, and the race gets called: "Too close to call," then "PROJECTED WINNER".
- **Turning the week.** A pixel Capitol under a sky that runs from dusk through night to dawn, a calendar page that flips, and the new week's first headlines. A crisis week turns the sky red with a BREAKING card. Click to skip.
- **Pixel-art scene sets** (`src/PixelSet.jsx`): a TV studio with a blinking skyline, a hearing room with camera flashes, a leadership office, a debate stage with spotlights, the briefing room, the Oval Office and the House chamber. Crowds shift in their seats, characters bob while they talk, and the frame flashes white or red as answers land.
- **Optional chiptune sound** (`src/sfx.js`, generated with Web Audio, off by default): vote ticks, gavel, pass and fail fanfares, cash, a page turn and a crisis alarm.
- Everything respects the "reduce motion" setting.
