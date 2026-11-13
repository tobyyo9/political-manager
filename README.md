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

## Eighteenth pass: the desk
- The game sits on a walnut desk under a lamp. Every page is a sheet of paper with a light grain, the tabs are manila folder tabs, and section headings are set in serif small caps.
- Each room has its own look and a line of signage at the top:
  - **Inbox:** memos with a FROM line, pink "While you were out" phone slips for asks, red folders for scandals, crises and attacks, and a FILED stamp on handled mail.
  - **Bills:** folder jackets with a status stamp (IN COMMITTEE, REPORTED, ON THE FLOOR) and a route to law (introduced, committee, floor, the other chamber, the President).
  - **News:** a front page for The Capitol Ledger.
  - **White House and Cabinet:** navy and gold.
  - **Court:** marble, with a colonnade.
  - **Campaign:** a corkboard war room with pinned, slightly crooked paper.
  - **Network:** a corkboard of pinned photos with string to your 16 strongest ties. Thickness shows strength, and red dashed string shows enemies.
  - **Office:** a brass nameplate.
- Fixed real names on the President's posts about you and on poll headlines.

## Nineteenth pass: everyone ranked, and everyone who wants something
- **Rankings cover all of Washington** (about 585 people): both chambers, the President, the Vice President and the Cabinet, the Supreme Court, and former officials and governors (Obama, Biden, Bush, Clinton, Harris, Pence, Hillary Clinton, Pelosi, McConnell, Romney, Cheney, Durbin, Newsom, Shapiro, Pritzker, Whitmer, DeSantis, Youngkin).
  - You can filter by group, sort by any measure, search, scroll through the full list and jump to your own row.
  - Ratings for people outside Congress are the game's estimates.
- **The Donors & groups tab** (`src/orgs.js`): 29 outside players. Each shows an invented name, or the real one when real names are on.
  - **Megadonors:** Elon Musk and America PAC (the biggest donor of 2026, about $366M for Republicans), Miriam Adelson, Michael Bloomberg, Reid Hoffman.
  - **PACs and industries,** linked to the existing interest-group scorecards: PhRMA, AIPAC/UDP, Club for Growth, API, Fairshake, the Chamber, AFL-CIO, NRA, Everytown, Planned Parenthood, LCV, EMILY's List and more.
  - **Movement groups:** DSA, Indivisible, Sunrise, Turning Point USA (led by Erika Kirk), Heritage, Americans for Prosperity, AARP, NumbersUSA, Justice Democrats.
  - You can request meetings, ask for support or endorsements, or cut ties.
- **They come to you.** Meeting requests (take it, send a staffer, or decline), offers of money or super PAC spending, endorsements, and threats from megadonors in your own party. Offers often come with a vote they'd like from you; accepting with a promise locks your vote. Endorsements from groups far to the left or right help with your base and hurt in swing seats.
- **Influence from abroad,** shown generically: a Gulf monarchy's registered lobbyists, a state-linked trade delegation, a "friendship society". They offer unapproved trips, "consulting" for your spouse, or straw-donor schemes. Accepting is a crime and can surface months later as a scandal, an FBI investigation, or an indictment that ends your career. Reporting it to the FBI helps your integrity.
- **More people in the rankings (about 619 now).** Added:
  - **White House and recent Cabinet:** Stephen Miller, plus former Cabinet members Noem, Bondi and Gabbard.
  - **National figures out of office:** Haley, Greene, Ramaswamy, McCarthy, Ryan, Pompeo, Walz, Crockett, Gore and Buttigieg.
  - **Sitting governors:** Beshear, Wes Moore, Hochul, Spanberger and Sherrill.
  - **Governors-elect from Nov 2026:** Klobuchar, Blackburn, Hinojosa, Donalds, Becerra, Bottoms, Acton, Benson, Haaland and Sand.
  - **Mayor:** Mamdani.
- **Governors whose terms end in January** are now listed as former: Newsom, Whitmer, DeSantis, plus Abbott and Kemp among the new names.
- **Klobuchar's and Blackburn's Senate seats** (both won governor's races) are held by placeholder appointees until the real names are announced.

## Twentieth pass: ambitions and real elections

- **Real people make career moves.** About 35 national figures decide during 2027 and early 2028 whether to run for president, run for the Senate, or stay put, and each decision breaks as news. Examples: Ocasio-Cortez can challenge Schumer, run for president or stay; Kemp can take on Warnock; Sununu can run in New Hampshire; Buttigieg can run for president or, rarely, for Senate in Indiana; Walz can run in the Minnesota special. Vance decides first, and Rubio mostly defers to him. The odds are the game's guesses from public reporting through November 2026.
- **Retirements are announced, and open seats fill with real people.** Grassley, Ron Johnson and the other likely retirees are curated; everyone else follows the age and chance rule. Open Senate seats draw real House members from the same state and party, whose own House seats then open. Named nominees bring a quality edge (or baggage) into the general, and open seats lose the incumbency bonus.
- **Primaries.** Across the country, incumbents lose renomination at realistic rates (usually 3 to 8 a cycle). The notable losses make headlines, and the winners take the seats. Your own challenger now has a name, a backer group, money and a pitch, and you get three ways to respond. A primary debate comes three weeks out, and primary night has its own race call. A famous challenger (Ocasio-Cortez against a Schumer player, say) turns the race into a real toss-up.
- **The 2028 presidential race.** Both parties' fields come from the decisions above. A polling average moves weekly with fame, favorability, ideological fit with the party's voters, momentum and debates. The calendar runs from Iowa and New Hampshire through Super Tuesday to June. Democrats award delegates proportionally above 15%; Republican states lean winner-take-all. Candidates drop out and endorse, and a nominee clinches. In November the nominees' quality shifts the map, and the winner becomes the real President (with an invented voice), with a seat vacated if they came from Congress. The outgoing President and Cabinet join the former officials in the rankings. In later cycles a first-term President runs again, and the out-party field comes from the biggest names left.
- **You can run.** With a big enough profile you get the 2028 question. Running costs hours every week and brings presidential debates. Drop out early and you can still file for your own seat; win the nomination and November decides the presidency.
- **Real names everywhere.** With real names on, every invented member name in the wire, headlines and inbox maps back to the real one. Two sound swaps that landed on crude words were replaced.

## Twenty-first pass: running mates, the oath, and seats that empty mid-term

- **Running mates and conventions.** Every nominee picks a running mate: a rival who did well or a senator from a swing state, chosen to balance the ticket. If you're the nominee, you choose from a shortlist of three. Running mates add a little nationally, and nominees and running mates run a few points better in their home states. Republicans hold their convention in July and Democrats in August, and each gets a short-lived bounce.
- **Take the oath.** Win the presidency and the career goes on in the Oval Office instead of ending. Your running mate becomes Vice President, and your old seat is filled by appointment or a special election. You choose how to staff the government: a team of rivals (the people you beat take State, Treasury and Defense), loyalists, or seasoned hands. The midterms come two years later, then a reelection campaign as the incumbent, where your approval is your favorability. Win again and you serve until you're term-limited. Presidency mode now works for either party.
- **Vacancies and special elections.** Members resign during the term for a new job, their health, a scandal or a post in the administration (no real person dies in the game). An empty House seat casts no votes until a special election 14 to 24 weeks later, where the party out of the White House runs a few points ahead, as it has in recent specials. Senate vacancies are filled by appointment, and the appointee has to win the seat at the next general election (for simplicity, the appointee is always from the departing senator's party). Now and then a member in a seat that leans the other way switches parties, and control can flip.
- **Your shot at an appointment.** If a senator from your state and party leaves and you're in the House, you can ask the governor for the seat. Your clout, profile and loyalty decide your odds. If you get it, your House seat goes to a special election and you have to win the Senate seat at the next election.
- Starting a new career now resets the world, so the start screen always lists the real Congress.

## Twenty-second pass: Speakers and governors

- **The Speaker's vote.** Every new House elects its Speaker on the floor in its first week. The majority's nominee needs a majority of members voting for someone. With a thin majority, holdouts (the far flank, the grudge-holders, the less loyal) can force ballot after ballot. The usual price of ending it is the 2023 deal: any single member can force a vote to remove the Speaker (under the 2025 rules it takes nine). If you're in the majority, you get your own vote: for the nominee, for someone else, or present. Holding out wins you concessions and costs you with the Speaker. After fifteen failed ballots the nominee withdraws.
- **Motions to vacate.** With a thin majority, hardliners can move to remove the Speaker, more often when the one-member rule is in place and after the Speaker cuts deals on funding bills. The other party sometimes saves a Speaker who worked with them. If the Speaker falls, the House floor stops until a new one is elected, and you can run.
- **Running for the top job.** At each new Congress, the leadership races now include Speaker (or party leader in the minority, or Majority/Minority Leader in the Senate). A Speaker nominee still has to win the floor vote, and a sitting Speaker can be the target of a motion to vacate.
- **Governors.** All 50 governors after the 2026 elections, from AP calls through November 10, 2026 (Alaska and Kansas were uncalled; the leading candidates are shown and marked). Governor's races run on the real calendar: Kentucky, Louisiana and Mississippi in 2027, New Jersey and Virginia in 2029, the rest in even years, with two-year terms in Vermont and New Hampshire. The party out of the White House gains, incumbents run ahead, and term limits are approximated. There's a new Governors view on the Map.
- **What governors do.** They appoint senators when seats open, following their own party except in states whose law requires the departing senator's party (Arizona, Hawaii, Kentucky, Maryland, North Carolina, Utah, West Virginia and Wyoming). Your governor calls about bills that matter to the state; keeping them happy helps you at home and with an appointment. When a party-line law passes, the other party's states sue, sending it toward the Supreme Court.
- **Run for governor.** When your state's governorship is on the ballot, you can run. Winning ends your time in Congress. Losing ends it too, unless you're a senator whose seat isn't up.
- Members no longer resign over invented scandals unless they are fictional.

## Twenty-third pass: the map after 2026

- The election forecasts no longer start from the 2024 presidential map. Each state starts from how it actually voted in the 2026 midterms (Senate and governor's races, AP counts as of November 8-10, 2026), blended with its 2024 presidential vote. Senate races count 80% toward the 2026 side; a state with only a governor's race counts 45%, because governors' races carry big candidate effects (Phil Scott won Vermont by 7). Leans are measured against the national swing, so the states that moved furthest left in 2026 now start furthest left of where they were: Texas goes from R+12 to R+6 against the nation, North Carolina from R+2 to D+3, Georgia to about even. House districts move half as far as their state did.
- The national mood starts at D+10 instead of D+5.3. Democrats won the national House vote by about 13 points, and the mood now responds more strongly to the President's approval (recalibrated so that 39% approval means a D+10 or so environment).
- In the current environment, Texas, Michigan and New Hampshire start as toss-ups tilting blue, Ohio and Iowa are toss-ups, and Florida stays Republican. If the national mood cools, they swing back.

## Twenty-fourth pass: Cabinet offers, Senate rules, investigations, and getting older

- **A Cabinet offer.** When your party wins the White House, the new President may offer you a department, matched to your committees (Armed Services to Defense, Foreign Relations to State, Finance or Ways and Means to Treasury, Judiciary to Attorney General, and so on). If you ran against them in the primaries, the odds go up. Accepting means a Senate confirmation vote: your party votes yes, and the other side splits on how much they like you and your integrity. If you're confirmed, you resign your seat and the career ends in the Cabinet. If you're rejected, you keep your seat and lose some face.
- **The nuclear option.** When the Senate majority's bills keep getting filibustered, its leader moves to end the legislative filibuster. Institutionalists (senior members, moderates, dealmakers) are the holdouts, so most attempts fail. A failed attempt makes leaders wait most of a year and need a longer list of blocked bills before they try again. If it passes, bills need 51 votes from then on, for whichever party holds the majority. Majority-party senators can push for it, a Majority Leader can call the vote, and every senator gets a say. In a 50-50 Senate, the Vice President breaks ties the way the White House wants, on rules changes and on bills. Floor scheduling and reconciliation now follow whichever party actually holds each chamber, instead of assuming Democrats.
- **Investigations with teeth.** From the Cabinet tab, members of the party out of the White House can open an investigation. It moves through document requests, a subpoena if the administration stonewalls (only with a majority in your chamber; the minority gets letters and a report), defiance, a contempt vote, and the administration's own Justice Department declining to prosecute. It ends with a report that raises the official's scandal heat, sometimes enough to trigger resignation or impeachment. The opposition's committees open investigations on their own too. As President, you decide whether to hand over documents or claim executive privilege.
- **Getting older.** From your early seventies, health scares take hours out of your week and dent your approval. Past 75, age costs you in primaries and general elections, and younger challengers run on generational change. At 75 and up, each new Congress asks whether this will be your last term. Choose yes and you finish without a campaign, retiring on your own terms.

## Twenty-fifth pass: a playable Cabinet, fewer resignations, and waves that bite

- **The Cabinet is a career now.** Once confirmed, you resign your seat (a special election or an appointment fills it) and run your department. You get your own weekly actions: lobby Congress for bills in your lane, issue rules (one every couple of months; some get sued and some get blocked), travel the country, and run the building to keep scandal down. The President makes requests: do it and gain trust while losing integrity, push back privately, or refuse on the record. A hostile House or Senate calls you to testify, and its investigations can target your department, where you choose whether to hand over documents. The President's trust slowly settles back to wary, so it has to be re-earned. Below 25 you're fired, and a scandal over 90 can force you out. You serve through the midterms. After a presidential election you stay if the President wins again, may stay if a new President of your party wants you, and leave if your party loses. Cabinet salary is $250,600.
- **Fewer Cabinet resignations.** Random departures are down about 70% and scandal resignations and firings are roughly halved, so a typical term sees one or two.
- **Waves bite.** When the national environment runs strongly against your party, incumbency and a good local brand count for less, for you and for everyone else (2026 swept out members who were popular at home). A Republican in a Trump-plus-a-few-points seat now faces a toss-up or worse in the current D+8 to D+12 environment, even working hard. Very safe seats (R+20 and up) still hold. The mood itself keeps moving with the President's approval, the economy and events, so it can swing back.
- Fixes: a reloaded game no longer puts the original President back in office after your own or a successor's election, and roll calls no longer claim you voted when you have no vote.

## Twenty-sixth pass: Cabinet churn, House districts after 2026, and governors

- **Cabinet churn.** Measured over full terms, the Cabinet was turning over about five officials a Congress plus ten rejected nominees. The fixes: scandal heat now fades unless something feeds it, quiet departures are rarer, a hostile Senate pushes the White House toward confirmable nominees, and after two failed nominations an acting official serves out the Congress. Confirmation votes now work for a President of either party (they assumed a Republican), and a non-Trump President no longer nominates from Trump's bench. Result: about one departure, one or two nominations and one rejection a term.
- **House districts after 2026.** Each district now starts from its 2024 presidential lean moved by its state's 2026 shift (capped at 6 points either way, because statewide races carry candidate effects like Collins in Maine), then checked against who actually won it in 2026 in a D+13 national House vote. A district whose winner would have lost on those numbers is nudged until they win, allowing incumbents a personal vote of about 6 points. Eleven districts needed the nudge. At a D+10 mood the model gives Democrats about 249 seats, close to the 254-plus they hold. Special elections and your own race use the same leans.
- **Governors.** Term limits follow each state's rules: none in thirteen states (including New Hampshire and Vermont, which have two-year terms), one term at a time in Virginia, and two everywhere else. Each sitting governor's terms served are counted, so Shapiro, Moore, Hobbs, Kotek, Sanders, Green and Pillen are term-limited in 2030, and Beshear and Reeves in 2027. Alaska and Kansas were still uncalled as of November 11 (the leaders, Kreiss-Tomkins and Holscher, are shown).
- **Governor is a career now.** Win your state's governorship and you take office instead of ending the game. You get your own actions: pass a budget through the legislature, tour the state, run the government to keep scandal down, join multistate lawsuits when the other party holds the White House, and expand Medicaid in the ten states that haven't. Disasters hit (hurricanes on the coast, wildfires out West, tornadoes on the plains), and you choose between asking Washington for help (faster from a friendly President) or paying for it yourself. You appoint senators when a seat in your state opens. You face re-election on your state's calendar until the term limit ends it, and a big enough scandal can force you out. A new "Your state" tab shows where things stand.

## Twenty-seventh pass: a bug sweep

- A fuzz test now plays 300 randomized careers (every role, random answers, random actions, saves and reloads) and checks that nothing crashes, no stat goes NaN, no headline or inbox message contains "undefined", the House stays at 435 and the Senate at 100, and every member, Cabinet officer and President has a name. A browser smoke test opens every tab in seven saved games (House, Senate, election night, your presidency, the original presidency mode, the Cabinet and a governorship) and clicks through a few weeks.
- Fixed: bill actions no longer crash if the bill died or passed in the meantime; hiring and riders check their targets.
- Fixed party assumptions that only held while Republicans had the White House and Democrats had Congress: who files impeachment articles, which party loads riders onto must-pass bills (and only if it runs a chamber), who trades riders away, what the President demands, veto-override loyalty, rider odds for members, lobbying odds with the White House, and how a confirmation vote plays with your base.
- The House majority now counts members actually serving, so empty seats don't hand control to the wrong party.

## Twenty-eighth pass: clickable names, your record, and real trade-offs

- **Click any name.** Members, Cabinet officials, the President and outside groups are links wherever they show up: inbox senders, message text, headlines, the wire. A member card shows age, party, seat, power ranking, how they voted this Congress and their ratings. A group card shows what it is, which party it works with, how much it gives and your history with it.
- **Veto overrides keep their votes.** An override now starts from how each member voted on passage. Members of the President's party who voted yes switch to no about one time in eight on a partisan bill and one in twenty-five otherwise, and very few no votes become yes. That puts swings at a handful of votes, in line with real overrides (the 2020 defense bill went from 335 to 322 in the House).
- **Your record.** A new Record tab shows 27 achievements, the laws you wrote, votes cast and against your party, terms served, earnings and memorable moments.
- **Harder.** Repeating the same money or clout action within three weeks pays less each time. Energy drops as you work long weeks and recovers on light ones; run it down and you lose hours next week, and tired members make more gaffes. Your office costs money every week and clout fades if you don't use it. Inbox choices no longer have a free answer: playing it safe costs your base, staying out costs profile, and saying no to leadership costs loyalty.
- **More places to spend hours:** casework, op-eds, policy study, media training, recruiting candidates, congressional trips abroad, and time with family (which restores energy).

## Twenty-ninth pass: weeks that feel different

- **District events.** Twenty-eight of them replace the four that used to repeat: plant closings, floods, a rural hospital in trouble, a viral school board fight, hurricanes on the coast, wildfires out West, farm trouble in farm states, a bridge closure, a stadium deal, a data center, a reporter looking at your stock trades, your kid's school play on the night of a donor dinner, and more. Each one comes up at most once a term. Every choice has a cost. Many come back weeks later: the bridge money comes through or doesn't, the plant finds a buyer or closes, and the dinner photo shows up in an ad.
- **Weekly themes.** Recess weeks (August and the holidays) have no votes, committee work or hearings, while district work and casework count for more. In deadline weeks before a must-pass bill, committee work counts for more. During campaign season, money and district work count for more. In crisis weeks, TV and op-eds reach more people. The header and the hours panel show the week's theme, and each action shows whether it's worth more or less that week.
- **Storylines.** A colleague in your party gets caught in a scandal and asks you to stand by them, and the truth comes out a month later. A big donor hosts a fundraiser and comes back later asking for a favor, which a reporter might find. A local official in your party tours your district, attacks your record and decides whether to file a primary challenge against you. A "Still in play" panel lists what's pending.
- **Less filler.** Staff notes, polls and gossip now arrive as a single Monday briefing. Whip requests for the same bill come once a Congress, and a bill that dies waits about thirty weeks before coming back, at most twice a Congress, so the floor rotates through more bills. Interest groups reach out a little less often.

## Thirtieth pass: ceilings

- **Donors max out.** Every dollar you raise in a cycle makes the next one harder to get: call time, PAC fundraisers and email lists all slow down as the cycle goes on (Senate donors run deeper). The hours panel shows how tapped out your donors are, and they reset each Congress. A large war chest also costs about 0.4% a week to keep a campaign running. Raising every hour now peaks around $5M instead of $28M; a balanced member ends a cycle with $1M to $2.5M.
- **Each point is harder than the last.** There's no hard ceiling, but approval gains shrink the further you climb above what your seat naturally gives you, and the same goes for your base above 65. In a swing seat, the climb from the mid 50s to 65 goes at half speed, and 75 is a real achievement. The approval meter shows how much a gain is worth at your current level.
- **Clout levels off.** Gains shrink above 50 and clout above 60 fades about 1% a week, so it settles around 70 unless you keep working it.
- **Rest costs more.** Energy recovers a little slower, time with family restores less, and recess gives a smaller boost.

## Thirty-first pass: laws that matter

- **Credit for your own bills.** When a bill you wrote becomes law, you get a signing ceremony and credit at home that depends on how popular the bill is in your district. A bill that's unpopular at home still helps with your base but costs you with swing voters. Getting a bill signed by a President of the other party earns extra credit for working across the aisle, and a veto override earns extra with your base.
- **Losing costs something.** A floor defeat in your own chamber costs real clout and some profile. A bill that passes your chamber and dies in the other one costs little, and your base gives you credit for trying. A veto from the other party's President helps you with your base. A bill that dies in committee costs a little clout.
- **Laws change the country.** Every new law moves the national mood toward the party that passed it, or away from it if the law is unpopular, and moves the President's approval when he signs it. Laws with economic effects play out over about ten weeks: tariffs push prices up, repealing them brings prices down, infrastructure adds jobs, and drug-price and power-bill laws lower costs.
- **Your vote comes back.** About six months after a law passes, voters decide how it's working. Members who voted with the verdict gain at home, and the bill's sponsor gains the most. Members who voted against it lose ground, and opponents put that vote in their ads ahead of anything else.
- **Do-nothing Congress.** At the one-year mark and again before the election, a House majority that has passed little gets blamed nationally (more if it runs the whole government), and its members lose ground at home. A productive majority gets a small boost.
- Fixed: committee work kept pushing your own bill's floor date back a week, so a member who did committee work every week could never get a vote on their bill.

## Thirty-second pass: every career gets a week worth playing, and nothing stays easy

- **President, Cabinet and governor events.** Each career now has its own set of choices, each coming up at most once per term, with follow-ups weeks later:
  - **President (eleven):** a hurricane on the Gulf Coast, a port strike, a relative's business deal, a hot mic, gas prices, a Fed that won't cut rates, a friend asking for a pardon, a leaked memo, a school shooting and more. Some move the economy.
  - **Cabinet secretary (ten):** an inspector general's report, a whistleblower, an industry lobbying to delay your rule, your travel on a government jet, budget-office cuts, a data breach, the President contradicting your testimony, a court blocking your rule, and more. They move the President's trust and your department's scandal heat.
  - **Governor (ten):** a teachers' strike, a prison scandal, a budget hole, a factory incentive deal, the DMV backlog, a state supreme court pick, a feuding lieutenant governor, a request for your National Guard, campus protests and potholes.
  
  Before this, a governor could go months without a single inbox decision.
- **Knock-downs.** The more popular and well known you are, the more often someone comes after you: an old quote resurfaces, a dark-money group buys ads against you, a former staffer talks to a reporter, or a reporter gets your expense reports (more likely when your integrity is low). Running yourself ragged can mean a hot mic or collapsing at an event. Each choice costs something. These apply to every career, at most one every five weeks.
- Governors and Cabinet secretaries now get the same progressive approval curve as members of Congress.

## Promo video

`promo/` is a Remotion project for a 35-second trailer (1920x1080, 30 fps) built from real gameplay screenshots using the game's fictional names. Run `cd promo && npm i && npx remotion studio` to edit it and `npx remotion render Promo out/political-manager-promo.mp4` to render it. Fonts ship in `promo/public/fonts` (from Fontsource). `remotion.config.ts` points at a local Chromium; remove that line on a normal machine.
