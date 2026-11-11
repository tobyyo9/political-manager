// Political Manager: the desk. Inbox, floor, chamber, your seat, rankings.
import * as S from "./sim.js";
import { GROUPS } from "./shared/data/typology.js";
import { POLICIES } from "./shared/data/policies.js";
import RollCall from "./RollCall.jsx";
import { Face, Attrs, Capitol, Network, Office, WhiteHouse } from "./Pages.jsx";

const { useState, useEffect, useMemo } = React;
const KEY = "political-manager:v1";
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v?.s?.custom) S.applyCustom(v.s.custom); return v; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };
const ini = (m, real) => (real ? m.first[0] + m.last[0] : m.sf[0] + m.sl[0]).toUpperCase();
const pc = (p) => (p === "D" ? "dem" : "rep");
const money = (k) => (k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${Math.round(k)}K`);
const BUCKETS = ["yes", "lean yes", "undecided", "lean no", "no"];
const KNOW = ["Stranger", "Acquaintance", "Working relationship", "You know them well"];
const relLabel = (r) => (r <= -0.3 ? "Hostile" : r < -0.05 ? "Cool" : r < 0.1 ? "Neutral" : r < 0.35 ? "Friendly" : "Ally");

export default function App() {
  const saved = useMemo(load, []);
  const [s, setS] = useState(saved?.s || null);
  const [real, setReal] = useState(saved?.real || false);
  const [tab, setTab] = useState("inbox");
  const [card, setCard] = useState(null);       // member id
  const [billOpen, setBillOpen] = useState(null);
  const [queue, setQueue] = useState([]);        // roll calls waiting to be shown
  const [toast, setToast] = useState(null);
  useEffect(() => { save({ s, real }); }, [s, real]);

  if (!s) return <Start real={real} setReal={setReal} onStart={(st) => { setS(st); setTab("inbox"); window.scrollTo(0, 0); }} />;
  const you = S.memberById[s.youId];
  const act = (name, arg) => { const n = S.doAction(s, name, arg); if (n.toast) setToast(n.toast); n.toast = null; setS(n); };
  const next = () => { const n = S.advance(s); setQueue(n.events || []); n.events = []; setS(n); window.scrollTo(0, 0); };
  const open = s.inbox.filter((m) => !m.done).length;
  const reply = (id, i) => { const n = S.answer(s, id, i); if (n.toast) setToast(n.toast); n.toast = null; setS(n); };
  const openBoard = (id) => { setS((cur) => S.flag(cur, "board")); setBillOpen(id); };
  const ctx = { s, setS, you, real, act, setCard, setBillOpen: openBoard, setTab, reply };

  return (
    <div className="pm">
      <header className="pm-top">
        <div className="pm-id">
          <Face m={you} size={48} ring="#ffcf5a" />
          <div><strong>{S.titleOf(you)} {S.nameOf(you, real)}</strong><small>{you.p === "D" ? "Democrat" : "Republican"} · {you.seat} · {you.faction}</small></div>
        </div>
        <div className="pm-meters">
          <Meter label="Week" value={`${Math.min(s.week + 1, S.WEEKS)} / ${S.WEEKS}`} sub={S.fmtDate(s.week)} />
          <Meter label="Hours left" value={s.hours} sub={`of ${S.HOURS}`} />
          <Meter label="War chest" value={money(s.cash)} />
          <Meter label="Approval at home" value={`${Math.round(s.approval)}%`} tone={s.approval >= 50 ? "ok" : "no"} />
          <Meter label="Your base" value={`${Math.round(s.baseApproval)}%`} tone={s.baseApproval >= 60 ? "ok" : "no"} />
          <Meter label="Clout" value={Math.round(s.clout)} />
        </div>
        {!s.over && <button type="button" className="cold-go pm-next" onClick={next}>End the week →</button>}
      </header>
      <nav className="pm-tabs">
        {[["inbox", `Inbox${open ? ` (${open})` : ""}`], ["floor", "Bills"], ["chamber", "Chamber"], ["capitol", "Capitol"], ["wh", "White House"], ["network", "Network"], ["office", "Office"], ["you", "Your seat"], ["groups", "Groups"], ["rank", "Rankings"], ["news", "News"]].map(([id, l]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>
        ))}
        <span className="pm-spacer" />
        <label className="pm-real"><input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> Real names</label>
        <button type="button" className="linkbtn" onClick={() => { if (window.confirm("Start a new career? This one will be erased.")) setS(null); }}>New career</button>
      </nav>
      <main className="pm-main">
        {s.over ? <End {...ctx} /> : null}
        {tab === "inbox" && <Inbox {...ctx} />}
        {tab === "floor" && <Bills {...ctx} />}
        {tab === "chamber" && <ChamberTab {...ctx} />}
        {tab === "you" && <YourSeat {...ctx} />}
        {tab === "groups" && <GroupsTab {...ctx} />}
        {tab === "capitol" && <Capitol {...ctx} />}
        {tab === "wh" && <WhiteHouse {...ctx} />}
        {tab === "network" && <Network {...ctx} />}
        {tab === "office" && <Office {...ctx} />}
        {tab === "rank" && <Rankings {...ctx} />}
        {tab === "news" && <News {...ctx} />}
        <p className="pm-fine">Characters are fictionalized: names are altered, and personalities, words and actions in the game are invented. Voting records, districts and committee seats come from public data. House roster is the outgoing Congress adjusted to the projected 2026 result; newcomers in flipped and open seats are placeholders.</p>
      </main>
      {card && <MemberCard id={card} {...ctx} onClose={() => setCard(null)} />}
      {billOpen && <BillBoard id={billOpen} {...ctx} onClose={() => setBillOpen(null)} />}
      {toast && <Toast t={toast} onClose={() => setToast(null)} />}
      {queue.length > 0 && <RollCall ev={queue[0]} s={s} real={real} onClose={() => setQueue((q) => q.slice(1))} />}
    </div>
  );
}

function Meter({ label, value, sub, tone }) {
  return <div className={`pm-meter ${tone || ""}`}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>;
}
function Toast({ t, onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal pm-toast ${t.tone}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body"><h2>{t.title}</h2><p>{t.text}</p><button type="button" className="primary" onClick={onClose} autoFocus>OK</button></div>
      </div>
    </div>
  );
}

// ── Start: pick a seat or build a newcomer ──
function Start({ onStart, real, setReal }) {
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState({ info: "normal", world: "normal" });
  const [mode, setMode] = useState("pick");
  const featured = useMemo(() => {
    const H = S.HOUSE;
    const by = (f) => [...H].sort(f)[0];
    return [
      { m: by((a, b) => (a.p === "D" && !a.gen ? a.dem : 99) - (b.p === "D" && !b.gen ? b.dem : 99)), tag: "Hard", title: "The frontliner", note: "A Democrat holding a seat that voted Republican for President. Every vote is a risk." },
      { m: by((a, b) => (a.p === "D" && !a.gen && a.own > 70 ? a.x : 9) - (b.p === "D" && !b.gen && b.own > 70 ? b.x : 9)), tag: "Easier", title: "The safe-seat progressive", note: "No general election to fear. Your problem is getting anything passed." },
      { m: by((a, b) => (b.p === "R" && !b.gen ? b.dem : 0) - (a.p === "R" && !a.gen ? a.dem : 0)), tag: "Hard", title: "The swing-seat Republican", note: "In the minority, in a district that voted the other way, with a primary on your right." },
      { m: by((a, b) => (b.p === "R" && !b.gen && b.own > 62 ? b.x : -9) - (a.p === "R" && !a.gen && a.own > 62 ? a.x : -9)), tag: "Different", title: "The hardliner", note: "Safe seat, no power, loud voice. Can you matter from the minority?" },
    ];
  }, []);
  const hits = q.length > 1 ? S.HOUSE.filter((m) => `${m.first} ${m.last} ${m.sf} ${m.sl} ${m.seat}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12) : [];
  return (
    <div className="pm-start">
      <section className="cold-hero pm-hero">
        <div className="cold-shade" />
        <div className="cold-inner">
          <span className="cold-kicker"><i className="live-dot" /> January 3, 2027 · The 120th Congress</span>
          <h1 className="cold-h">One seat.<br /><span>535 people to deal with.</span></h1>
          <p className="cold-lede">Play one member of the House through two years: build relationships, trade favors, count votes you can never be sure of, and face your voters in November 2028. Every member votes from their own record, district and pressures.</p>
        </div>
      </section>
      <div className="pm-startbar">
        <div className="hemi-by">{[["pick", "Take a seat"], ["create", "Create a newcomer"]].map(([v, l]) => <button key={v} type="button" className={mode === v ? "on" : ""} onClick={() => setMode(v)}>{l}</button>)}</div>
        <label className="pm-real"><input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} /> Show real names</label>
      </div>
      {mode === "pick" ? (
        <>
          <div className="pm-featured">
            {featured.map(({ m, tag, title, note }) => (
              <button key={m.id} type="button" className={`pm-seatcard ${pc(m.p)}`} onClick={() => onStart(S.newCareer(m.id, undefined, null, diff))}>
                <span className="cast-trait">{tag}</span>
                <strong>{title}</strong>
                <span className="pm-who"><Face m={m} size={40} />{S.nameOf(m, real)} · {m.seat}</span>
                <p>{note}</p>
                <small>District voted {m.dem >= 50 ? `D +${((m.dem - 50) * 2).toFixed(0)}` : `R +${((50 - m.dem) * 2).toFixed(0)}`} in 2024</small>
              </button>
            ))}
          </div>
          <section className="panel">
            <h3>Or take over any House member</h3>
            <input className="pm-search" placeholder="Search by name or seat, like TX-15 or Pelosi" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="pm-results">{hits.map((m) => <button key={m.id} type="button" className="pm-row" onClick={() => onStart(S.newCareer(m.id, undefined, null, diff))}><span className={`avatar ${pc(m.p)} sm`}>{ini(m, real)}</span><span><strong>{S.nameOf(m, real)}</strong><small>{m.seat} · {m.faction} · in office since {m.since}</small></span></button>)}</div>
          </section>
        </>
      ) : <Create onStart={onStart} diff={diff} />}
      <section className="panel pm-diff">
        <h3>Difficulty</h3>
        <p className="muted small">The seat you pick matters most. These two dials do the rest.</p>
        {[["info", "What you can see"], ["world", "The world"]].map(([k, label]) => (
          <div key={k} className="pm-diffrow"><span className="stat-label">{label}</span>
            <div className="hemi-by pm-wrap">{Object.entries(S.DIFF[k]).map(([v, l]) => <button key={v} type="button" className={diff[k] === v ? "on" : ""} onClick={() => setDiff((d) => ({ ...d, [k]: v }))}>{l}</button>)}</div></div>
        ))}
      </section>
      <p className="pm-fine">Characters are fictionalized. Names are altered by swapping opening sounds; personalities and in-game actions are invented. Records, districts and committees are from public sources: the congress-legislators project, Voteview ideology scores and 2024 presidential results by district.</p>
    </div>
  );
}
function Create({ onStart, diff }) {
  const [c, setC] = useState({ first: "Alex", last: "Rivera", p: "D", x: -0.3, seat: "", background: "teacher", trait: "dealmaker" });
  const [q, setQ] = useState("");
  const hits = q.length > 1 ? S.HOUSE.filter((m) => `${m.seat} ${m.sf} ${m.sl}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const seat = c.seat && S.memberById[c.seat];
  const set = (k, v) => setC((o) => ({ ...o, [k]: v }));
  const xmin = c.p === "D" ? -0.8 : 0.1, xmax = c.p === "D" ? -0.05 : 0.9;
  return (
    <section className="panel pm-create">
      <h3>Create a newcomer</h3>
      <div className="pm-form">
        <label>First name<input value={c.first} onChange={(e) => set("first", e.target.value)} /></label>
        <label>Last name<input value={c.last} onChange={(e) => set("last", e.target.value)} /></label>
        <label>Party<select value={c.p} onChange={(e) => setC((o) => ({ ...o, p: e.target.value, x: e.target.value === "D" ? -0.3 : 0.45 }))}><option value="D">Democrat</option><option value="R">Republican</option></select></label>
        <label>Ideology: {c.p === "D" ? (c.x < -0.45 ? "progressive" : c.x < -0.25 ? "mainstream" : "moderate") : (c.x > 0.6 ? "hard right" : c.x > 0.35 ? "mainstream" : "moderate")}
          <input type="range" min={xmin} max={xmax} step="0.05" value={c.x} onChange={(e) => set("x", Number(e.target.value))} /></label>
        <label>Background<select value={c.background} onChange={(e) => set("background", e.target.value)}>{Object.entries(S.BACKGROUNDS).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}</select><small>{S.BACKGROUNDS[c.background].note}</small></label>
        <label>Your style<select value={c.trait} onChange={(e) => set("trait", e.target.value)}>{["dealmaker", "believer", "wonk", "showhorse", "loyalist"].map((k) => <option key={k} value={k}>{S.TRAIT_LABEL[k]}</option>)}</select><small>{S.TRAIT_DESC[c.trait]}</small></label>
      </div>
      <label className="pm-seatpick">Which seat do you take?
        <input className="pm-search" placeholder="Search a district, like OH-9 or a current member" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="pm-results">{hits.map((m) => <button key={m.id} type="button" className={`pm-row ${c.seat === m.id ? "on" : ""}`} onClick={() => set("seat", m.id)}><span className={`avatar ${pc(m.p)} sm`}>{ini(m)}</span><span><strong>{m.seat}</strong><small>Held by {S.nameOf(m)} · voted {m.dem >= 50 ? `D +${((m.dem - 50) * 2).toFixed(0)}` : `R +${((50 - m.dem) * 2).toFixed(0)}`} in 2024</small></span></button>)}</div>
      {seat && <p className="muted small">You replace {S.nameOf(seat)} in {seat.seat}. {(c.p === "D") === (seat.dem >= 50) ? "The district leans your way." : "The district voted for the other party: expect a hard reelection."}</p>}
      <button type="button" className="cold-go" disabled={!seat || !c.first || !c.last} onClick={() => onStart(S.startCustom(c, undefined, diff))}>Get sworn in →</button>
    </section>
  );
}

// ── Inbox ──
function Inbox({ s, act, setBillOpen, reply }) {
  const steps = S.firstSteps(s), left = steps.filter((x) => !x.done).length;
  const list = [...s.inbox].sort((a, b) => Number(a.done) - Number(b.done) || b.week - a.week).slice(0, 40);
  return (
    <div className="pm-two">
      <section className="stack">
        <h2 className="pm-h">Inbox</h2>
        {list.map((m) => (
          <article key={m.id} className={`pm-msg ${m.kind} ${m.done ? "done" : ""}`}>
            <header><strong>{m.from}</strong><small>{S.fmtDate(m.week)}</small></header>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
            {m.choices && (
              <div className="pm-choices">
                {m.choices.map((c, i) => <button key={c} type="button" className={`ghost ${m.choice === i ? "on" : ""}`} disabled={m.done} onClick={() => reply(m.id, i)}>{c}</button>)}
                {m.bill && <button type="button" className="linkbtn" onClick={() => setBillOpen(m.bill)}>See the count →</button>}
              </div>
            )}
          </article>
        ))}
      </section>
      <aside className="stack">
        {left > 0 && s.week < 6 && (
          <section className="panel pm-steps">
            <h3>Your first week</h3>
            <ul>{steps.map((x) => <li key={x.text} className={x.done ? "done" : ""}><i>{x.done ? "✓" : ""}</i>{x.text}</li>)}</ul>
            <p className="muted small">You have 50 hours a week. Everything costs time, and you can never do it all.</p>
          </section>
        )}
        <h2 className="pm-h">Spend your hours</h2>
        <div className="pm-actions">
          {[["district", "Town halls and events back home. Raises approval."], ["funds", "Dial for dollars. Fills the war chest."], ["committee", "Hearings and markups. Builds your record and clout."], ["tv", "A cable hit. Raises your profile; small risk of a gaffe."]].map(([a, d]) => (
            <button key={a} type="button" className="pm-act" disabled={!S.can(s, a)} onClick={() => act(a)}><strong>{S.ACTIONS[a].label}</strong><span>{d}</span><small>{S.ACTIONS[a].hours} hours</small></button>
          ))}
        </div>
        <p className="muted small">Meet colleagues from the Chamber tab. Whip votes, cosponsor and introduce bills from the Bills tab.</p>
      </aside>
    </div>
  );
}

// ── Bills ──
function CountBar({ c, need, total }) {
  const colors = { yes: "#2fbf71", "lean yes": "#9be27b", undecided: "#b9c2cf", "lean no": "#f0a9a0", no: "#d4594d" };
  return (
    <div className="pm-count">
      <div className="pm-countbar">{BUCKETS.map((b) => <i key={b} style={{ width: `${(c[b] / total) * 100}%`, background: colors[b] }} title={`${b}: ${c[b]}`} />)}<em style={{ left: `${(need / total) * 100}%` }} /></div>
      <div className="pm-countkey">{BUCKETS.map((b) => <span key={b}><i style={{ background: colors[b] }} />{b} <b>{c[b]}</b></span>)}</div>
    </div>
  );
}
function Bills({ s, setS, act, setBillOpen, setCard, real }) {
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState("");
  const active = S.activeBills(s).sort((a, b) => a.floorWeek - b.floorWeek);
  const past = s.bills.filter((b) => b.dead || b.stage === "law").slice(-12).reverse();
  const options = POLICIES.filter((p) => !s.laws.includes(p.id) && !s.bills.some((b) => b.pid === p.id && !b.dead) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 14);
  return (
    <div className="stack">
      <div className="pm-headrow"><h2 className="pm-h">Bills in play</h2><button type="button" className="primary" disabled={!S.can(s, "introduce")} onClick={() => setPick((x) => !x)}>Write a bill ({S.ACTIONS.introduce.hours} hours)</button></div>
      {pick && (
        <section className="panel">
          <input className="pm-search" placeholder="Search policies: minimum wage, tariffs, border…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="pm-results">{options.map((p) => <button key={p.id} type="button" className="pm-row" onClick={() => { act("introduce", { pid: p.id }); setPick(false); }}><span><strong>{p.name}</strong><small>{p.desc}</small></span></button>)}</div>
        </section>
      )}
      {active.map((b) => {
        const p = S.byId[b.pid], sp = S.memberById[b.sponsor], c = S.whipCount(s, b), mine = b.sponsor === s.youId;
        return (
          <article key={b.id} className={`pm-bill ${mine ? "mine" : ""}`}>
            <header>
              <div><span className="eyebrow">{b.floorWeek <= s.week ? "On the floor this week" : `Floor vote around ${S.fmtDate(b.floorWeek)}`}{mine ? " · your bill" : ""}</span><h3>{p.name}</h3>
                <small>Sponsor: <button type="button" className="linkbtn" onClick={() => setCard(sp.id)}>{S.nameOf(sp, real)}</button> ({sp.p}-{sp.st}){b.cos.includes(s.youId) ? " · you cosponsored" : ""}</small></div>
              <div className="pm-vote">
                <span className="stat-label">Your vote</span>
                <div className="hemi-by">{[[true, "Yes"], [false, "No"], [null, "Staff decides"]].map(([v, l]) => <button key={l} type="button" className={b.yourVote === v ? "on" : ""} onClick={() => setS(S.setVote(s, b.id, v))}>{l}</button>)}</div>
              </div>
            </header>
            <CountBar c={c} need={218} total={434} />
            {(() => { const said = (s.pres || []).find((x) => x.pid === b.pid); return said ? <blockquote className="pm-said">{said.text}</blockquote> : null; })()}
            {(() => { const pv = S.presView(s, b); return <p className="small pm-pres"><span className="avatar rep sm">DT</span> The President: <strong className={pv.signs ? "ok" : "no"}>{pv.signs ? "likely signs" : pv.gap > -0.15 ? "leaning veto, movable" : "likely veto"}</strong>{pv.firm ? " · firm views on this" : ""}{b.wh ? ` · your lobbying ${b.wh > 0 ? "helped" : "hurt"}` : ""}</p>; })()}
            <div className="bill-actions">
              <button type="button" className="ghost" onClick={() => setBillOpen(b.id)}>Whip board →</button>
              <button type="button" className="ghost" disabled={!S.can(s, "wh")} onClick={() => act("wh", { bill: b.id })}>Lobby the White House (8 hours)</button>
              {!mine && !b.cos.includes(s.youId) && <button type="button" className="ghost" disabled={!S.can(s, "cosponsor")} onClick={() => act("cosponsor", { bill: b.id })}>Cosponsor (2 hours)</button>}
            </div>
          </article>
        );
      })}
      {past.length > 0 && <h2 className="pm-h">Decided</h2>}
      {past.map((b) => <div key={b.id} className={`pm-past ${b.stage}`}><strong>{S.byId[b.pid].name}</strong><span>{b.stage === "law" ? "Law" : b.stage === "vetoed" ? "Vetoed" : b.stage === "died" ? "Died in committee" : "Failed"} · {b.hist.join(" · ")}</span></div>)}
    </div>
  );
}
function BillBoard({ id, s, act, real, setCard, onClose }) {
  const b = s.bills.find((x) => x.id === id), p = S.byId[b.pid];
  const [ch, setCh] = useState("H");
  const info = S.billInfo(b.pid, b.party);
  const need = ch === "H" ? (info.amendment ? 290 : 218) : info.amendment ? 67 : info.reconcilable && b.party === "D" && !info.mustPass && !info.bipartisan ? 51 : 60;
  const rows = useMemo(() => (ch === "H" ? S.HOUSE : S.SENATE).filter((m) => m.id !== s.youId).map((m) => ({ m, e: S.estimate(s, m, b) })).sort((a, z) => Math.abs(a.e.est) - Math.abs(z.e.est)).slice(0, 18), [s, id, ch]);
  const c = S.whipCount(s, b, ch);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal pm-board" role="dialog" aria-modal="true" aria-label={`Whip board: ${p.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <span className="eyebrow">Whip board · {ch === "H" ? "House" : "Senate"} · {need} to pass{ch === "S" && need === 60 ? " (filibuster)" : ""}</span>
          <h2>{p.name}</h2>
          <div className="hemi-by">{[["H", "House"], ["S", "Senate"]].map(([v, l]) => <button key={v} type="button" className={ch === v ? "on" : ""} onClick={() => setCh(v)}>{l}</button>)}</div>
          <CountBar c={c} need={need} total={ch === "H" ? 434 : 100} />
          <p className="muted small">Your staff's estimate. It is sharper for members you know. These are the members closest to the fence:</p>
          <ul className="pm-whip">
            {rows.map(({ m, e }) => (
              <li key={m.id}>
                <button type="button" className="pm-who linkless" onClick={() => setCard(m.id)}><Face m={m} size={34} /><span><strong>{S.nameOf(m, real)}</strong><small>{m.p}-{m.seat} · {KNOW[e.know]}</small></span></button>
                <span className={`pm-bucket b-${e.bucket.replace(" ", "-")}`}>{e.bucket}</span>
                <span className="pm-why">{e.know >= 1 ? S.reasons(e).slice(0, 2).map((r) => r.text).join("; ") : "You don't know them well enough to say why."}{b.deals[m.id] ? " · you have a deal" : ""}</span>
                <span className="pm-whipbtns">
                  <button type="button" className="ghost" disabled={!S.can(s, "whip")} onClick={() => act("whip", { bill: b.id, id: m.id })}>Ask (5h)</button>
                  {(s.owedToYou[m.id] || 0) > 0 && <button type="button" className="primary" disabled={!S.can(s, "whip")} onClick={() => act("whip", { bill: b.id, id: m.id, favor: true })}>Call in favor</button>}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Chamber ──
function ChamberTab({ s, real, setCard }) {
  const [ch, setCh] = useState("H");
  const [by, setBy] = useState("party");
  const [bill, setBill] = useState("");
  const list = useMemo(() => S.seated(ch), [ch, s.youId, s.custom]);
  const { seats, dotR } = useMemo(() => S.seatsFor(list.length), [list.length]);
  const b = s.bills.find((x) => x.id === bill);
  const FC = ch === "H" ? { "Progressive Caucus": "#1b3f8f", "Democrats, no bloc": "#3d7bd9", "New Democrat Coalition": "#7fa6ec", "Blue Dog Coalition": "#bcd0f5", "Main Street Caucus": "#f0a9a0", "Republican Study Committee": "#d4594d", "Freedom Caucus": "#7a1f1a" } : { "Progressives": "#1b3f8f", "Mainstream Democrats": "#3d7bd9", "Moderate Democrats": "#9db8f0", "Governing-wing Republicans": "#f0a9a0", "Mainstream Republicans": "#d4594d", "Hard-right conservatives": "#7a1f1a" };
  const BC = { yes: "#2fbf71", "lean yes": "#9be27b", undecided: "#b9c2cf", "lean no": "#f0a9a0", no: "#d4594d", you: "#ffcf5a" };
  const color = (m) => (by === "bill" && b && ch === "H" ? BC[S.estimate(s, m, b).bucket] : by === "faction" ? FC[m.faction] : by === "rel" ? ((s.rel[m.id] || 0) > 0.3 ? "#2fbf71" : (s.rel[m.id] || 0) > 0.05 ? "#9be27b" : (s.rel[m.id] || 0) < -0.05 ? "#d4594d" : (s.know[m.id] || 0) > 0 ? "#8fa1b8" : "#3a4660") : m.p === "D" ? "#3d7bd9" : "#d4594d");
  const [hover, setHover] = useState(null);
  const hm = hover && S.memberById[hover];
  return (
    <div className="stack">
      <div className="pm-headrow">
        <div className="hemi-by">{[["H", "House"], ["S", "Senate"]].map(([v, l]) => <button key={v} type="button" className={ch === v ? "on" : ""} onClick={() => setCh(v)}>{l}</button>)}</div>
        <div className="hemi-by">{[["party", "Party"], ["faction", "Caucus"], ["rel", "Who you know"], ["bill", "A bill's count"]].map(([v, l]) => <button key={v} type="button" className={by === v ? "on" : ""} onClick={() => setBy(v)}>{l}</button>)}</div>
        {by === "bill" && <select value={bill} onChange={(e) => setBill(e.target.value)}><option value="">Pick a bill</option>{S.activeBills(s).map((x) => <option key={x.id} value={x.id}>{S.byId[x.pid].name}</option>)}</select>}
      </div>
      <section className="pm-chamber">
        <svg viewBox="-1.08 -1.06 2.16 1.12" className="pm-hemi" role="img" aria-label="Seat chart">
          {seats.map((p, i) => { const m = list[i]; return <circle key={m.id} cx={p.x} cy={-p.y} r={dotR} fill={color(m)} className={`pm-seat ${m.id === s.youId ? "you" : ""}`} onMouseEnter={() => setHover(m.id)} onClick={() => setCard(m.id)} />; })}
        </svg>
        <div className="pm-hover">{hm ? <><strong>{S.titleOf(hm)} {S.nameOf(hm, real)}</strong> · {hm.p}-{hm.seat} · {hm.faction}{hm.id === s.youId ? " · you" : ` · ${KNOW[s.know[hm.id] || 0]}`}</> : "Hover a seat; click to open the member. Your seat has a gold ring."}</div>
      </section>
      {by === "faction" && <div className="pm-legend">{Object.entries(FC).map(([f, c]) => <span key={f} title={S.FACTION_NOTE[f]}><i style={{ background: c }} />{f}</span>)}</div>}
      {by === "rel" && <div className="pm-legend"><span><i style={{ background: "#2fbf71" }} />Ally</span><span><i style={{ background: "#9be27b" }} />Friendly</span><span><i style={{ background: "#8fa1b8" }} />Acquainted</span><span><i style={{ background: "#3a4660" }} />Stranger</span><span><i style={{ background: "#d4594d" }} />Cool or hostile</span></div>}
    </div>
  );
}

// ── Member card ──
function Bar({ label, v }) { return <div className="pm-bar"><span>{label}</span><i><b style={{ width: `${v * 100}%` }} /></i></div>; }
function MemberCard({ id, s, real, act, onClose, setBillOpen, setCard }) {
  const m = S.memberById[id], me = id === s.youId, k = me ? 3 : s.know[id] || 0, rel = s.rel[id] || 0;
  const lr = S.leftRank(m);
  const bills = S.activeBills(s).filter((b) => b.sponsor === id);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal pm-card" role="dialog" aria-modal="true" aria-label={S.nameOf(m, real)} onClick={(e) => e.stopPropagation()}>
        <div className={`pm-cardtop ${pc(m.p)}`}>
          <Face m={m} size={84} />
          <div><h2>{S.titleOf(m)} {S.nameOf(m, real)}</h2><p>{m.p === "D" ? "Democrat" : "Republican"} · {m.seat} · in office since {m.since}{m.placeholder ? " · placeholder: this seat's real 2026 winner isn't in the data yet" : m.gen ? " · newcomer" : ""}</p>{m.lead?.[0] && <span className="cast-trait">{m.lead[0]}</span>}</div>
        </div>
        <div className="modal-body">
          <dl className="pm-facts">
            <div><dt>{m.ch === "H" ? "Caucus" : "Bloc"}</dt><dd title={S.FACTION_NOTE[m.faction]}>{S.caucusOf(m).join(" · ")}{m.cauEst ? <small className="muted"> (estimated)</small> : m.ch === "H" ? <small className="muted"> (real roster)</small> : null}</dd></div>
            <div><dt>Voting record</dt><dd>More conservative than {lr}% of the {m.ch === "H" ? "House" : "Senate"}{m.est || m.gen ? " (estimated)" : ""}</dd></div>
            <div><dt>{m.ch === "H" ? "District" : "State"} in 2024</dt><dd>{m.dem >= 50 ? `Democrats +${((m.dem - 50) * 2).toFixed(0)}` : `Republicans +${((50 - m.dem) * 2).toFixed(0)}`}</dd></div>
            <div><dt>Feels pressure from</dt><dd>{m.vuln > 0.6 ? "The general election" : m.prisk > 0.5 ? "A primary" : "Neither much"}</dd></div>
            {m.comm?.length > 0 && <div className="wide"><dt>Committees</dt><dd>{m.comm.map((c) => c.n + (c.title ? ` (${c.title})` : "")).join(", ")}</dd></div>}
          </dl>
          {!me && (
            <>
              <div className="pm-know"><span className="stat-label">How well you know them</span><strong>{KNOW[k]}</strong><span className="stat-label">Relationship</span><strong>{relLabel(rel)}</strong>{(s.owedToYou[id] || 0) > 0 && <span className="pill pos2">Owes you {s.owedToYou[id]} favor{s.owedToYou[id] > 1 ? "s" : ""}</span>}</div>
              {k >= 2 ? <p className="pm-trait"><strong>{S.TRAIT_LABEL[m.t.label]}.</strong> {S.TRAIT_DESC[m.t.label]}</p> : <p className="muted small">You don't know what drives them yet. Spend time together to find out.</p>}
              {k >= 2 && S.memberGroups(m).length > 0 && <p className="small"><span className="stat-label">Leans on</span> {S.memberGroups(m).map((x) => x.g.name).join(", ")}</p>}
              <h4 className="pm-subh">Attributes {k < 2 ? <small className="muted">· get to know them to scout these</small> : k < 3 ? <small className="muted">· rough estimates</small> : null}</h4>
              <Attrs a={S.attrs(m)} know={k} seed={m.id} />
            </>
          )}
          {(() => { const B = S.bonds(m); return (
            <div className="pm-bonds">
              <div><h4 className="pm-subh">Close to</h4>{B.friends.map(({ m: o, why }) => <button key={o.id} type="button" className="linkless pm-bond" onClick={() => setCard(o.id)}><Face m={o} size={30} /><span><b>{S.nameOf(o, real)}</b><small>{why}</small></span></button>)}</div>
              <div><h4 className="pm-subh">At odds with</h4>{B.rivals.map(({ m: o, why }) => <button key={o.id} type="button" className="linkless pm-bond neg" onClick={() => setCard(o.id)}><Face m={o} size={30} /><span><b>{S.nameOf(o, real)}</b><small>{why}</small></span></button>)}</div>
            </div>); })()}
          {me && <><h4 className="pm-subh">Attributes</h4><Attrs a={S.yourAttrs(s)} know={3} /></>}
          {bills.length > 0 && <p className="small">Carrying: {bills.map((b) => <button key={b.id} type="button" className="linkbtn" onClick={() => { onClose(); setBillOpen(b.id); }}>{S.byId[b.pid].name}</button>)}</p>}
          <div className="bill-actions">
            {!me && <button type="button" className="primary" disabled={!S.can(s, "meet")} onClick={() => act("meet", { id })}>Meet with them (6 hours)</button>}
            <button type="button" className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Your seat ──
function YourSeat({ s, you, real, setCard }) {
  const groups = [...GROUPS].reverse();
  const open = s.youOwe.filter((f) => f.status === "open");
  const owed = Object.entries(s.owedToYou).filter(([, n]) => n > 0);
  const primary = s.baseApproval >= 62 ? "Safe for now" : s.baseApproval >= 52 ? "A challenger is possible" : "Expect a serious challenger";
  const env = you.p === "D" ? s.mood : -s.mood;
  const outlook = (you.own - 50) * 2 + env * 0.9 + 3 + (s.approval - 50) * 0.45 + Math.min(4, s.cash / 900);
  return (
    <div className="pm-two">
      <section className="stack">
        <h2 className="pm-h">{you.seat}: your voters</h2>
        <section className="panel">
          <p>In 2024 this seat voted {you.dem >= 50 ? `Democratic by ${((you.dem - 50) * 2).toFixed(0)}` : `Republican by ${((50 - you.dem) * 2).toFixed(0)}`} points for President. Estimated mix of voters, left to right:</p>
          <div className="pm-mix">{groups.map((g) => <div key={g.id} title={g.blurb}><span>{g.name}</span><i><b style={{ width: `${Math.min(100, you.mix[g.id] * 300)}%`, background: g.color }} /></i><em>{Math.round(you.mix[g.id] * 100)}%</em></div>)}</div>
          <p className="muted small">Voter groups are Pew's 2026 typology, tilted to match this seat's 2024 result. An estimate, not a survey of the district.</p>
        </section>
        <section className="panel">
          <h3>Reelection outlook</h3>
          <dl className="pm-facts">
            <div><dt>Primary ({S.fmtDate(S.PRIMARY_WEEK)})</dt><dd>{s.primary ? (s.primary.challenged ? `Won with ${s.primary.share}%` : "Unopposed") : primary}</dd></div>
            <div><dt>General ({S.fmtDate(S.ELECTION_WEEK)})</dt><dd className={outlook > 0 ? "ok" : "no"}>{outlook > 4 ? "Favored" : outlook > 0 ? "Leaning your way" : outlook > -4 ? "Leaning against you" : "In serious trouble"} ({outlook > 0 ? "+" : ""}{outlook.toFixed(0)})</dd></div>
            <div><dt>National mood</dt><dd>{s.mood >= 0 ? `Democrats +${s.mood.toFixed(1)}` : `Republicans +${(-s.mood).toFixed(1)}`} vs. 2024</dd></div>
            <div><dt>President's approval</dt><dd>{Math.round(s.presApproval)}%</dd></div>
          </dl>
        </section>
        <section className="panel">
          <h3>Your votes</h3>
          {s.votesCast.length === 0 && <p className="muted small">No votes yet.</p>}
          <ul className="pm-votes">{[...s.votesCast].reverse().slice(0, 14).map((v, i) => <li key={i}><span className={`pill ${v.vote ? "pos2" : "neg2"}`}>{v.vote ? "Yes" : "No"}</span><strong>{S.byId[v.pid].name}</strong><small>At home {v.d >= 0 ? "+" : ""}{v.d.toFixed(1)} · base {v.pb >= 0 ? "+" : ""}{v.pb.toFixed(1)}{v.partyLine ? "" : " · against your party"}</small></li>)}</ul>
        </section>
      </section>
      <aside className="stack">
        <h2 className="pm-h">Favors</h2>
        <section className="panel">
          <h3>You owe</h3>
          {open.length === 0 && <p className="muted small">Nothing right now.</p>}
          {open.map((f) => <p key={f.id} className="small"><button type="button" className="linkbtn" onClick={() => setCard(f.to)}>{S.nameOf(S.memberById[f.to], real)}</button>: a yes on <strong>{S.byId[f.pid].name}</strong> if it reaches the floor by {S.fmtDate(f.due)}.</p>)}
          <h3>Owed to you</h3>
          {owed.length === 0 && <p className="muted small">Nobody yet. Say yes when colleagues ask for help.</p>}
          {owed.map(([id, n]) => <p key={id} className="small"><button type="button" className="linkbtn" onClick={() => setCard(id)}>{S.nameOf(S.memberById[id], real)}</button>: {n} favor{n > 1 ? "s" : ""}. Call it in on a whip board.</p>)}
        </section>
        <section className="panel">
          <h3>Your standing</h3>
          <dl className="pm-facts one">
            <div><dt>Legislative record</dt><dd>{Math.round(s.legis)}</dd></div><div><dt>National profile</dt><dd>{Math.round(s.profile)}</dd></div>
            <div><dt>Integrity</dt><dd>{Math.round(s.integrity)}</dd></div><div><dt>Standing with leadership</dt><dd>{s.loyalty > 2 ? "Reliable" : s.loyalty < -2 ? "A problem" : "Unproven"}</dd></div>
            <div><dt>Interest-group money taken</dt><dd>{money(s.tookMoney)}</dd></div>
            <div><dt>The President</dt><dd>{S.RAPPORT(s.rapport || 0)}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

// ── Rankings ──
const RK = [["score", "Career score"], ["influence", "Influence"], ["legis", "Legislative record"], ["pop", "Popularity at home"], ["cash", "War chest"], ["integrity", "Integrity"], ["profile", "Media profile"]];
function Rankings({ s, real, setCard }) {
  const [key, setKey] = useState("score");
  const rows = useMemo(() => S.rankings(s), [s]);
  const sorted = [...rows].sort((a, b) => b[key] - a[key]);
  const me = rows.find((r) => r.me);
  const top = sorted.slice(0, 12);
  const show = top.includes(me) ? top : [...top, me];
  return (
    <div className="stack">
      <div className="pm-headrow"><h2 className="pm-h">Rankings: all 435 House members</h2><div className="hemi-by pm-wrap">{RK.map(([k, l]) => <button key={k} type="button" className={key === k ? "on" : ""} onClick={() => setKey(k)}>{l}</button>)}</div></div>
      <div className="pm-yourranks">{RK.map(([k, l]) => <div key={k}><span>{l}</span><b>#{me["r_" + k]}</b></div>)}</div>
      <table className="pm-table">
        <thead><tr><th>#</th><th>Member</th><th>Seat</th><th>{RK.find((r) => r[0] === key)[1]}</th></tr></thead>
        <tbody>{show.map((r) => <tr key={r.m.id} className={r.me ? "me" : ""} onClick={() => setCard(r.m.id)}><td>{r["r_" + key]}</td><td className="pm-rk-name"><Face m={r.m} size={28} /> {S.nameOf(r.m, real)}{r.me ? " (you)" : ""}</td><td>{r.m.p}-{r.m.seat}</td><td>{key === "cash" ? money(r[key]) : r[key]}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
function News({ s }) {
  return <div className="stack"><h2 className="pm-h">News</h2><ul className="pm-news">{s.news.map((n, i) => <li key={i} className={n.tone}><small>{S.fmtDate(n.week)}</small>{n.text}</li>)}</ul></div>;
}

// ── The end of a term ──
function End({ s, you, real, setS }) {
  const r = s.result, rows = S.rankings(s), me = rows.find((x) => x.me);
  const won = r.kind === "general" && r.won;
  const yours = s.bills.filter((b) => b.sponsor === s.youId);
  const kept = s.youOwe.filter((f) => f.status === "kept").length, broken = s.youOwe.filter((f) => f.status === "broken").length;
  const against = s.votesCast.filter((v) => v.d < -0.5).length;
  return (
    <section className={`desk pm-end ${won ? "won" : "lost"}`}>
      <span className="rc-live"><i className="live-dot" /> {r.kind === "primary" ? "Primary night" : "Election night · November 7, 2028"}</span>
      <div className="desk-verdict">
        <span className="rc-stamp">{r.kind === "primary" ? "DEFEATED IN THE PRIMARY" : won ? "REELECTED" : "DEFEATED"}</span>
        <p>{r.kind === "primary" ? `Your own party's voters chose someone else. You took ${r.share}%.` : `${S.nameOf(you, real)} ${won ? "wins" : "loses"} ${you.seat} by ${Math.abs(r.margin)} points. The national mood ran ${r.env >= 0 ? "with" : "against"} your party by ${Math.abs(r.env)}. Democrats will hold ${r.houseD} House seats.`}</p>
      </div>
      <div className="grades">
        <div className="grade-overall"><span>Career rank</span><b>#{me.r_score}</b></div>
        <div className="grade"><b>{yours.filter((b) => b.stage === "law").length}/{yours.length}</b><span>Your bills that became law</span></div>
        <div className="grade"><b>{s.votesCast.length}</b><span>Votes cast, {against} against your district</span></div>
        <div className="grade"><b>{kept}/{kept + broken}</b><span>Promises kept</span></div>
        <div className="grade"><b>#{me.r_influence}</b><span>Influence</span></div>
        <div className="grade"><b>{money(s.tookMoney)}</b><span>Group money taken</span></div>
      </div>
      <div className="pm-aar">
        <h3>How it happened</h3>
        <ul>{S.afterAction(s).map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      <div className="rc-actions"><button type="button" className="cold-go" onClick={() => setS(null)}>Start a new career →</button></div>
    </section>
  );
}

// ── Interest groups ──
function GroupsTab({ s }) {
  const rows = S.groupStanding(s);
  const label = (x) => (x.votes === 0 ? "No record yet" : x.score >= 50 ? "Champion" : x.score >= 15 ? "Friend" : x.score > -15 ? "Mixed" : x.score > -50 ? "Opponent" : "Target");
  return (
    <div className="stack">
      <div className="pm-headrow"><h2 className="pm-h">Interest groups and donors</h2></div>
      <p className="muted">Each group grades the votes it cares about. A good grade brings money, endorsements and volunteers; a bad one can bring a funded challenger. The stronger a group is in your seat, the more its grade counts. Names are invented; the types are real.</p>
      <div className="pm-groups">
        {rows.map((x) => (
          <article key={x.g.id} className="pm-group">
            <header><strong>{x.g.name}</strong><span className={`pill ${x.score >= 15 ? "pos2" : x.score <= -15 ? "neg2" : ""}`}>{label(x)}</span></header>
            <small>{x.g.model} · {x.g.tactic === "primary" ? "spends in primaries" : x.g.tactic === "general" ? "spends in the fall" : "publishes a scorecard"}</small>
            <p>{x.g.note}</p>
            <div className="pm-bar"><span>Weight in your seat</span><i><b style={{ width: `${x.dep * 100}%` }} /></i></div>
            <div className="pm-gscore"><span>Their grade for you</span><i><b className={x.score >= 0 ? "ok" : "no"} style={{ width: `${Math.abs(x.score) / 2}%`, [x.score >= 0 ? "left" : "right"]: "50%" }} /></i></div>
            <p className="small"><span className="stat-label">Wants</span> {Object.entries(x.g.cares).filter(([pid]) => S.byId[pid]).slice(0, 4).map(([pid, v]) => `${v > 0 ? "yes" : "no"} on ${S.byId[pid].name}`).join("; ")}</p>
            {x.money > 0 && <p className="small">You have taken {money(x.money)} from them.</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
