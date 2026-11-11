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
