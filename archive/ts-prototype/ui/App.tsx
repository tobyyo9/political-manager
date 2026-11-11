import house from "../data/house.json";
import calibration from "../data/calibration.json";
import type { Member } from "../engine/types";
import Roster from "./Roster";
import VoteLab from "./VoteLab";

const { useState } = React;
const members = house.members as Member[];
const cal = calibration as any;

export default function App() {
  const [tab, setTab] = useState("vote");
  const [real, setReal] = useState(false);
  return (
    <div className="app">
      <header className="mast">
        <div className="wrap mast-row">
          <div><h1>Political Manager</h1><p className="tag">First build · The House, member by member</p></div>
          <label className="toggle"><input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> Show real names</label>
        </div>
        <nav className="wrap tabs" aria-label="Sections">
          {[["vote", "Call a vote"], ["house", "The House"], ["how", "How it works"]].map(([id, l]) => <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>)}
        </nav>
      </header>
      <main className="wrap">
        {tab === "vote" && <VoteLab members={members} real={real} />}
        {tab === "house" && <Roster members={members} real={real} />}
        {tab === "how" && (
          <div className="how">
            <section className="panel dark">
              <span className="kicker">Tested against reality</span>
              <h2>The formula calls {Math.round(cal.heldOut.accuracy * 1000) / 10}% of real votes correctly</h2>
              <p>It was fitted on the first two-thirds of this Congress's {cal.rollCalls} House roll calls, then scored on {cal.heldOut.votes.toLocaleString()} individual votes it had never seen. Guessing "everyone votes with their party" gets {Math.round(cal.heldOut.baseline * 1000) / 10}%. The formula also catches {Math.round(cal.heldOut.defectionsCaught * 100)}% of the {cal.heldOut.defections.toLocaleString()} times a member broke with their party, which is the part a party-line guess always misses.</p>
            </section>
            <section className="panel">
              <h3>What is real and what is invented</h3>
              <ul className="plain">
                <li><b>Real:</b> each member's party, seat, years served, position on the left-right line (DW-NOMINATE scores from their voting record), how often they vote with their party, and how their district voted for President in 2024.</li>
                <li><b>Invented:</b> names (the opening sounds of the first and last name are swapped), personality traits, ambition, ethics and media skill. These are seeded so they stay the same between sessions.</li>
                <li><b>The roster</b> is the current House as of {house.asOf}. Members elected on November 3, 2026 will replace it once the new Congress is seated and their records exist.</li>
              </ul>
              <h3>What this build is</h3>
              <p>Step one of the plan: real member data and a vote formula that holds up against real votes. Bills here are described by where they sit on the left-right line, what each party's leaders do, and the President's position. Still to come, in order: a Congress that runs by itself, your own member with an inbox and favors, then reelection.</p>
              <h3>Sources</h3>
              <ul className="plain">
                <li>Members, terms and districts: the open <a href="https://github.com/unitedstates/congress-legislators" target="_blank" rel="noopener">congress-legislators</a> dataset.</li>
                <li>Ideology scores and roll-call votes: <a href="https://voteview.com/" target="_blank" rel="noopener">Voteview</a> (Lewis, Poole, Rosenthal, Boche, Rudkin and Sonnet), snapshot of October 27, 2026.</li>
                <li>2024 presidential vote by district: the <a href="https://github.com/jaytimm/PresElectionResults" target="_blank" rel="noopener">PresElectionResults</a> package.</li>
              </ul>
              <p className="fine">Characters are fictionalized. Their in-game traits, words and actions are invented and are not statements about any real person.</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
