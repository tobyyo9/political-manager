// The stage for a scene: a cable-news style frame, the people in it, typed lines, choices, and a front page at the end.
import * as S from "./sim.js";
import { stageScene, roll, tally } from "./scenes.js";
import Portrait from "./Portrait.jsx";

const { useState, useEffect, useMemo } = React;
const Face = ({ m, size }) => <Portrait id={m.id} g={m.g} born={m.born} p={m.p} size={size} fix={m.look} />;

function Typed({ text, onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const t = setInterval(() => setN((k) => { if (k >= text.length) { clearInterval(t); onDone && onDone(); return k; } return k + 2; }), 16); return () => clearInterval(t); }, [text]);
  return <span onClick={() => setN(text.length)}>{text.slice(0, n)}{n < text.length && <i className="sc-caret" />}</span>;
}

export default function Scene({ s, msg, real, onFinish, onClose }) {
  const scene = useMemo(() => stageScene(s, msg, real), [msg.id]);
  const [beat, setBeat] = useState(-1);          // -1 = intro
  const [picks, setPicks] = useState([]);
  const [res, setRes] = useState(null);          // result of the last pick, shown before moving on
  const [typed, setTyped] = useState(false);
  const [done, setDone] = useState(null);
  if (!scene) return null;
  const B = scene.beats[beat], speaker = B ? scene.cast[B.who] : null, you = scene.cast.find((c) => c.you);
  const momentum = picks.reduce((a, p) => a + p.res.delta, 0);
  const choose = (i) => { const r = roll(s, msg, scene, beat, i); setRes({ ...r, choice: B.choices[i] }); setPicks((p) => [...p, { beat, choice: B.choices[i], res: r }]); };
  const next = () => {
    const last = picks[picks.length - 1];
    if (beat + 1 >= scene.beats.length || last?.choice.end) setDone(tally(scene, picks));
    else { setBeat(beat + 1); setRes(null); setTyped(false); }
  };
  const ticker = (s.news || []).slice(0, 6).map((n) => n.text).join("   •   ");
  return (
    <div className="sc-back" role="dialog" aria-modal="true" aria-label={msg.title}>
      <div className={`sc-stage set-${scene.setting}`}>
        <div className="sc-top"><span className="sc-live"><i />LIVE</span><span className="sc-net">{scene.network}</span>
          <div className="sc-mom" title="Momentum"><span>Momentum</span><i><b style={{ left: `${50 + Math.max(-6, Math.min(6, momentum)) * 7}%` }} /></i></div>
          <button type="button" className="sc-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="sc-set">
          <div className="sc-backdrop" />
          <div className="sc-people">
            {scene.cast.map((c, i) => (
              <div key={i} className={`sc-person ${c.you ? "you" : ""} ${speaker === c ? "talking" : ""} ${c.mod ? "mod" : ""}`}>
                <Face m={c.face} size={c.mod ? 84 : 132} />
                <div className="sc-desk" />
              </div>
            ))}
          </div>
          <div className="sc-lower"><b>{speaker ? speaker.name : scene.lower[0]}</b><span>{speaker ? speaker.title : scene.lower[1]}</span></div>
        </div>
        {res && <div className="pm-react" key={picks.length}>{[["Your base", res.choice.aud.base], ["Swing voters", res.choice.aud.swing], ["Buzz", res.choice.aud.profile]].filter(([, v]) => v).map(([l, v], i) => { const good = res.ok ? v > 0 : v < 0; return <i key={l} className={good ? "up" : "down"} style={{ animationDelay: `${i * 0.18}s` }}>{l} {good ? "👍" : "👎"}</i>; })}<i className={res.ok ? "up" : "down"} style={{ animationDelay: "0.5s" }}>{res.ok ? "The room is with you" : "Groans in the room"}</i></div>}
        <div className="sc-ticker"><span>{ticker || "Washington News Channel"}</span></div>
        <div className="sc-panel">
          {done ? (
            <div className="sc-front">
              <div className="sc-paper"><small>The Capitol Ledger · {S.fmtDate(s.week)}</small><h2>{done.headline}</h2></div>
              <ul className="sc-effects">
                {Math.abs(done.swing) >= 0.3 && <li className={done.swing > 0 ? "ok" : "no"}>Approval at home {done.swing > 0 ? "+" : ""}{done.swing.toFixed(1)}</li>}
                {Math.abs(done.base) >= 0.3 && <li className={done.base > 0 ? "ok" : "no"}>Your base {done.base > 0 ? "+" : ""}{done.base.toFixed(1)}</li>}
                {done.profile >= 0.5 && <li className="ok">Profile +{done.profile.toFixed(1)}</li>}
                {done.tags.includes("deal") && <li className="ok">You're a yes, and leadership owes you</li>}
                {done.tags.includes("refuse") && <li className="no">Leadership noted your no</li>}
                {done.tags.includes("won") && <li className="ok">They're with you on the vote</li>}
                {msg.scene.type === "debate" && <li className={done.score >= 0 ? "ok" : "no"}>Debate effect on election night: {done.score >= 0 ? "+" : ""}{(Math.max(-1, Math.min(1, done.score / 6)) * 3.5).toFixed(1)} points</li>}
              </ul>
              <button type="button" className="cold-go" onClick={() => onFinish(done)}>Done</button>
            </div>
          ) : beat < 0 ? (
            <div className="sc-intro">
              <h2>{msg.title}</h2><p>{scene.intro}</p>
              <p className="muted small">Each answer rolls your attributes against theirs. Risky answers swing harder both ways.{msg.prep ? " You prepped with your communications director." : ""}</p>
              <div className="sc-choices">
                <button type="button" className="cold-go" onClick={() => setBeat(0)}>Go live →</button>
                {!msg.prep && S.roleOf(s) !== "P" && <button type="button" className="ghost" disabled={s.hours < 4} onClick={() => onFinish(null, "prep")}>Prep first (4 hours)</button>}
              </div>
            </div>
          ) : (
            <>
              <p className="sc-line"><b>{speaker.name}:</b> <Typed text={B.line} onDone={() => setTyped(true)} /></p>
              {res ? (
                <div className={`sc-res ${res.ok ? "ok" : "no"}`}><b>{you.name}: "{res.choice.label}."</b> {res.text}<button type="button" className="primary" onClick={next}>{beat + 1 >= scene.beats.length || res.choice.end ? "See the coverage →" : "Next →"}</button></div>
              ) : (
                <div className={`sc-choices ${typed ? "" : "wait"}`}>
                  {B.choices.map((c, i) => (
                    <button key={i} type="button" className={`sc-choice ${c.risk ? "risk" : ""}`} onClick={() => choose(i)}>
                      <strong>{c.label}</strong><small>{c.stat}{c.risk ? " · risky" : ""}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
