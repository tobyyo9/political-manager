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
