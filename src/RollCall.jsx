// The live roll call: every seat is a real member casting their own vote.
import * as S from "./sim.js";
import Portrait from "./Portrait.jsx";
import { sfx } from "./sfx.js";

const { useState, useEffect, useMemo } = React;
const MS = 2400, PAUSE = 800;

function steps(ev) {
  const out = [];
  const H = ev.house && { type: "ch", ch: "H", label: "House", t: ev.house, need: ev.needH }, Sn = ev.senate && { type: "ch", ch: "S", label: "Senate", t: ev.senate, need: ev.needS };
  for (const x of ev.first === "S" ? [Sn, H] : [H, Sn]) if (x) out.push(x);
  if (ev.signs !== undefined) out.push({ type: "desk", signs: ev.signs });
  if (ev.over) { out.push({ type: "ch", ch: "H", label: "House override", t: ev.over.house, need: 290 }); out.push({ type: "ch", ch: "S", label: "Senate override", t: ev.over.senate, need: 67 }); }
  const V = {
    "failed-house": ["FAILED", `It fell short in the House, ${ev.house?.yes} to ${ev.needH} needed.`, "no"],
    desk: ["ON YOUR DESK", "Both chambers passed it. Sign it or veto it from the Bills tab.", "ok"],
    "failed-senate": ["FAILED", `${ev.first === "S" ? "It" : "It passed the House and"} fell short in the Senate, ${ev.senate?.yes} to ${ev.needS} needed.`, "no"],
    filibustered: ["FILIBUSTERED", `${ev.first === "S" ? "In the Senate," : "It passed the House, but"} ${ev.senate?.yes} senators is short of the 60 needed to end debate.`, "no"],
    signed: ["SIGNED INTO LAW", ev.auto === false ? "You sign it at the Resolute Desk." : "The President signs it.", "ok"],
    overridden: ["OVERRIDDEN", "Two-thirds of both chambers defy the President. It's law.", "ok"],
    vetoed: ["VETO SUSTAINED", S.presPron(`The President vetoes it. On the override, some of his party who voted yes won't defy him:`) + ` ${ev.over?.house.yes} House, ${ev.over?.senate.yes} Senate.`, "veto"],
    states: ["SENT TO THE STATES", "Two-thirds of both chambers passed it. Now 38 states must ratify.", "ok"],
  }[ev.result];
  out.push({ type: "verdict", stamp: V[0], line: V[1], tone: V[2] });
  return out;
}

// A pixel gavel that drops when the result is in.
const Gavel = () => (
  <svg className="rc-gavel" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="2" y="2" width="7" height="4" fill="#8a5a33" /><rect x="2" y="2" width="7" height="1" fill="#b98a4f" /><rect x="1" y="3" width="1" height="2" fill="#c9a24a" /><rect x="9" y="3" width="1" height="2" fill="#c9a24a" />
    <rect x="5" y="6" width="1" height="8" fill="#6b4a2f" /><rect x="6" y="6" width="1" height="8" fill="#4a3220" />
  </svg>);
function Chamber({ st, run, youId, real }) {
  const list = useMemo(() => S.seated(st.ch), [st.ch]);
  const { seats, dotR } = useMemo(() => S.seatsFor(list.length), [list.length]);
  const rank = useMemo(() => { const o = list.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } const r = []; o.forEach((idx, k) => (r[idx] = k)); return r; }, [list]);
  const [k, setK] = useState(run ? 0 : 1);
  useEffect(() => {
    if (!run) { setK(1); return; }
    let raf; const t0 = performance.now();
    let last = 0; const tick = (t) => { const x = Math.min(1, (t - t0) / MS); setK(x); if (t - last > 70) { last = t; sfx("tick"); } if (x < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const shown = Math.floor(k * list.length);
  let yea = 0, nay = 0;
  list.forEach((m, i) => { if (rank[i] < shown) (st.t.votes[m.id] ? yea++ : nay++); });
  const done = k >= 1, ok = st.t.yes >= st.need, crossed = yea >= st.need;
  // Who crossed party lines: voted against most of their own party.
  const cross = useMemo(() => { const by = { D: [0, 0], R: [0, 0] }; for (const m of list) { by[m.p][0] += st.t.votes[m.id] ? 1 : 0; by[m.p][1]++; } const maj = { D: by.D[0] * 2 > by.D[1], R: by.R[0] * 2 > by.R[1] }; return new Set(list.filter((m) => !!st.t.votes[m.id] !== maj[m.p]).map((m) => m.id)); }, [list, st]);
  return (
    <div className={`rc-chamber ${done ? (ok ? "ok" : "no") : ""} ${crossed && !done ? "crossed" : ""}`}>
      {crossed && <span className="rc-crossed" key="x">{st.need} reached</span>}
      <div className="rc-head"><span className="rc-label">{st.label}</span><span className="rc-need">{st.need} needed</span></div>
      <svg viewBox="-1.08 -1.06 2.16 1.12" className="rc-svg">
        {seats.map((p, i) => { const m = list[i], on = rank[i] < shown; return <circle key={m.id} cx={p.x} cy={-p.y} r={dotR} className={`rc-seat ${m.p === "D" ? "d" : "r"} ${on ? (st.t.votes[m.id] ? "yea" : "nay") : ""} ${m.id === youId ? "you" : ""} ${done && cross.has(m.id) ? "cross" : ""}`} />; })}
      </svg>
      <div className="rc-count"><span className="rc-yea">YEA <b>{yea}</b></span><span className="rc-bar"><i style={{ width: `${(yea / list.length) * 100}%` }} /><em style={{ left: `${(st.need / list.length) * 100}%` }} /></span><span className="rc-nay">NAY <b>{nay}</b></span></div>
      {done && <span className={`rc-chip ${ok ? "ok" : "no"}`}>{ok ? "Passes" : "Falls short"} · {st.t.D} D, {st.t.R} R voted yes</span>}
      {done && cross.size > 0 && <p className="rc-cross small">Crossed party lines ({cross.size}, ringed): {list.filter((m) => cross.has(m.id)).slice(0, 6).map((m) => `${S.nameOf(m, real)} (${m.p})`).join(", ")}{cross.size > 6 ? ` and ${cross.size - 6} more` : ""}</p>}
    </div>
  );
}

export default function RollCall({ ev, s, onClose, real }) {
  const list = useMemo(() => steps(ev), [ev]);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [ev]);
  useEffect(() => {
    if (i >= list.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), list[i].type === "ch" ? MS + PAUSE : 1300);
    return () => clearTimeout(t);
  }, [i, list]);
  // A new vote can arrive with fewer steps than the last one: never read past the end.
  const at = list[Math.min(i, list.length - 1)], verdict = list[list.length - 1], end = at.type === "verdict";
  const desk = list.find((x) => x.type === "desk");
  useEffect(() => { if (end) { sfx("gavel"); const t = setTimeout(() => sfx(verdict.tone === "ok" ? "pass" : "fail"), 380); return () => clearTimeout(t); } }, [end]);
  return (
    <div className="modal-back rc-back">
      <div className={`rc-modal ${end ? "slam" : ""}`} role="dialog" aria-modal="true" aria-label="Roll call">
        <div className="rc-top">
          <span className="rc-live"><i className="live-dot" /> Roll call vote</span>
          <h2>{S.byId[ev.pid].name}</h2>
          <span className="pm-yourvote">You voted <b>{ev.yourVote ? "yes" : "no"}</b>{ev.auto ? " (your staff's call)" : ""}. Your seat has the gold ring.</span>
        </div>
        <div className="rc-chambers">
          {list.map((st, idx) => st.type !== "ch" ? null : idx > i ? <div key={idx} className="rc-chamber pending"><div className="rc-head"><span className="rc-label">{st.label}</span><span className="rc-need">waiting</span></div></div> : <Chamber key={idx} st={st} run={idx === i} youId={s.youId} real={real} />)}
        </div>
        {desk && list.indexOf(desk) <= i && <div className={`rc-desk ${desk.signs ? "ok" : "no"}`}><span className="rc-desk-face"><Portrait id={S.PRES_M.id} g={S.PRES_M.g} born={S.PRES_M.born} p={S.PRES_M.p} size={44} fix={S.PRES_M.look} /></span><span><strong>The President's desk</strong><small>{list.indexOf(desk) === i ? "He's reading it…" : desk.signs ? "He signs it." : "He vetoes it."}</small></span></div>}
        {end && <div className={`rc-verdict ${verdict.tone}`}><Gavel /><span className="rc-stamp">{verdict.stamp}</span><p>{verdict.line}</p></div>}
        <div className="rc-actions">
          {!end && <button type="button" className="ghost" onClick={() => setI(list.length - 1)}>Skip to result</button>}
          {end && <button type="button" className="cold-go" onClick={onClose} autoFocus>Continue</button>}
        </div>
      </div>
    </div>
  );
}
