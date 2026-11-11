// The bigger screens: the Capitol's power structure, your network, your office, the White House.
import * as S from "./sim.js";
import Portrait from "./Portrait.jsx";
import USMAP from "./data/usmap.json";

const { useState, useMemo } = React;
const pc = (p) => (p === "D" ? "dem" : "rep");
export const Face = ({ m, size = 44, ring }) => <Portrait id={m.id} g={m.g} born={m.born} p={m.p} size={size} ring={ring} fix={m.look} />;
const relLabel = (r) => (r <= -0.3 ? "Hostile" : r < -0.05 ? "Cool" : r < 0.1 ? "Neutral" : r < 0.35 ? "Friendly" : "Ally");
const relColor = (r) => (r <= -0.3 ? "#c8443a" : r < -0.05 ? "#e8a093" : r < 0.1 ? "#b9c2cf" : r < 0.35 ? "#9be27b" : "#2fbf71");
const tint = (v) => (v >= 16 ? "a-top" : v >= 12 ? "a-good" : v >= 8 ? "a-mid" : "a-low");

// A Football Manager style attribute grid. Unknown values show as a range or a question mark.
export function Attrs({ a, know = 3, seed = "" }) {
  return (
    <div className="pm-attrs">
      {Object.entries(a).map(([k, v]) => {
        const shown = know >= 3 ? String(v) : know === 2 ? `${Math.max(1, v - 2)}-${Math.min(20, v + 2)}` : "?";
        return <div key={k + seed} className="pm-attr"><span>{k}</span><b className={know >= 2 ? tint(v) : "a-unk"}>{shown}</b></div>;
      })}
    </div>
  );
}

// A small person card, like a squad photo tile.
function Tile({ m, s, real, setCard, sub }) {
  const rel = s.rel[m.id] || 0, me = m.id === s.youId;
  return (
    <button type="button" className={`pm-tile ${pc(m.p)} ${me ? "me" : ""}`} onClick={() => setCard(m.id)} title={S.nameOf(m, real)}>
      <span className="pm-tile-rel" style={{ background: me ? "#ffcf5a" : (s.know[m.id] || 0) ? relColor(rel) : "transparent" }} />
      <Face m={m} size={46} />
      <strong>{S.nameOf(m, real).split(" ").slice(-1)[0]}</strong>
      <small>{sub}</small>
    </button>
  );
}

// ── The Capitol: leadership pyramid, caucus power, committees ──
export function Capitol({ s, real, setCard }) {
  const [ch, setCh] = useState("H");
  const [p, setP] = useState(S.memberById[s.youId].p);
  const [view, setView] = useState("leaders");
  const L = useMemo(() => S.leadership(ch, p), [ch, p]);
  const C = useMemo(() => S.caucuses(ch), [ch]);
  const K = useMemo(() => S.committees(ch), [ch]);
  const role = (m) => m.lead?.[0]?.replace(/ \((expected|contested)\)/, "") || ((m.comm || []).find((c) => c.role === "Chair" || c.role === "Ranking Member") ? `${(m.comm || []).find((c) => c.role === "Chair" || c.role === "Ranking Member").role}, ${(m.comm || []).find((c) => c.role === "Chair" || c.role === "Ranking Member").n}` : m.faction);
  return (
    <div className="stack">
      <div className="pm-headrow">
        <h2 className="pm-h">The Capitol</h2>
        <div className="hemi-by">{[["leaders", "Leadership"], ["caucus", "Caucuses"], ["comm", "Committees"]].map(([v, l]) => <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>)}</div>
        <div className="hemi-by">{[["H", "House"], ["S", "Senate"]].map(([v, l]) => <button key={v} type="button" className={ch === v ? "on" : ""} onClick={() => setCh(v)}>{l}</button>)}</div>
        {view === "leaders" && <div className="hemi-by">{[["D", "Democrats"], ["R", "Republicans"]].map(([v, l]) => <button key={v} type="button" className={p === v ? "on" : ""} onClick={() => setP(v)}>{l}</button>)}</div>}
      </div>

      {view === "leaders" && (
        <section className="pm-pyramid">
          <div className="pm-pyr-head"><Face m={S.PRES_M} size={40} /><div><strong>The President</strong><small>{ch === "H" ? `Leads the ${S.presParty() === "R" ? "Republican" : "Democratic"} Party from the White House` : "Signs or vetoes everything both chambers pass"}</small></div></div>
          {[["Party leaders", L.top, "lvl0"], [p === "D" ? "Committee chairs" : "Ranking members", L.chairs, "lvl1"], ["Most influential members", L.influential, "lvl2"]].map(([title, list, cls]) => list.length > 0 && (
            <div key={title} className={`pm-tier ${cls}`}>
              <div className="pm-tier-band">{title}</div>
              <div className="pm-tier-row">{list.map((m) => <Tile key={m.id} m={m} s={s} real={real} setCard={setCard} sub={role(m)} />)}</div>
            </div>
          ))}
          <div className="pm-tier lvl3"><div className="pm-tier-band">Rank and file</div><p className="muted small">{L.others} more {p === "D" ? "Democrats" : "Republicans"}. Every one of them can be opened from the Chamber tab.</p></div>
          <div className="pm-legend"><span><i style={{ background: "#2fbf71" }} />Your ally</span><span><i style={{ background: "#9be27b" }} />Friendly</span><span><i style={{ background: "#b9c2cf" }} />Neutral</span><span><i style={{ background: "#c8443a" }} />Hostile</span><span><i style={{ background: "#ffcf5a" }} />You</span></div>
        </section>
      )}

      {view === "caucus" && (
        <>
          <section className="panel">
            <h3>Who holds power</h3>
            <p className="muted small">Democrats hold {C.maj} seats; {C.need} is a majority, so any Democratic bloc bigger than {C.margin} can sink a party-line bill on its own. That is a veto, and it is where most of a caucus's power comes from.</p>
            <div className="pm-cpower">
              {C.rows.map((r) => (
                <div key={r.name} className={`pm-cp ${pc(r.p)}`} title={r.note}>
                  <div className="pm-cp-top"><strong>{r.name}</strong>{r.veto && <span className="pill neg2">Can sink party bills</span>}{r.roster ? <span className="pill pos2" title="Members matched to the caucus's published roster">Real roster</span> : ch === "H" ? <span className="pill" title="No public roster could be fetched; members placed by voting record">Estimated</span> : null}</div>
                  <p className="pm-cp-note">{r.note}</p>
                  <div className="pm-cp-bar"><i style={{ width: `${r.power}%` }} /></div>
                  <div className="pm-cp-meta"><span>Power <b>{r.power}</b></span><span>{r.size} members</span><span>Unity {r.cohesion}%</span><span>{r.posts} leaders or chairs</span></div>
                  <button type="button" className="pm-cp-lead linkless" onClick={() => setCard(r.leader.id)}><Face m={r.leader} size={28} /><span>{r.chair ? "Chair" : "Ringleader"}: <b>{S.nameOf(r.leader, real)}</b></span></button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h3>How the caucuses get along</h3>
            <div className="pm-matrix" style={{ gridTemplateColumns: `140px repeat(${C.rows.length}, minmax(0, 1fr))` }}>
              <span />{C.rows.map((r) => <span key={r.name} className={`pm-mx-h ${pc(r.p)}`}>{r.name.replace("Republican Study Committee", "RSC").replace("New Democrat Coalition", "New Dems").replace("Blue Dog Coalition", "Blue Dogs").replace("Democrats, no bloc", "D. no bloc").replace("Republicans", "R.").replace("Democrats", "D.").replace("conservatives", "cons.")}</span>)}
              {C.rows.map((a) => (
                <React.Fragment key={a.name}>
                  <span className={`pm-mx-h left ${pc(a.p)}`}>{a.name}</span>
                  {C.rows.map((b) => { const rel = a.name === b.name ? "" : S.caucusRelation(a, b); const c = { Allies: "#2fbf71", "Uneasy partners": "#9be27b", "Can do business": "#d9e8c4", Rivals: "#f0c27a", Opponents: "#f0a9a0", Enemies: "#c8443a" }[rel] || "var(--sunk)";
                    return <span key={b.name} className="pm-mx-c" style={{ background: c }} title={`${a.name} and ${b.name}: ${rel}`}>{rel}</span>; })}
                </React.Fragment>
              ))}
            </div>
            <p className="muted small">{ch === "H" ? "Based on how these blocs behave in fights over rules, spending and leadership." : "Based on how far apart their voting records are."} Allies vote together most of the time; enemies almost never.</p>
          </section>
        </>
      )}

      {view === "comm" && (
        <div className="pm-comms">
          {K.map((k) => (
            <article key={k.c} className="pm-comm">
              <h4>{k.n}</h4>
              <div className="pm-comm-heads">
                {k.chair && <button type="button" className="linkless pm-comm-p" onClick={() => setCard(k.chair.id)}><Face m={k.chair} size={34} /><span><small>Chair</small><b>{S.nameOf(k.chair, real)}</b></span></button>}
                {k.ranking && <button type="button" className="linkless pm-comm-p" onClick={() => setCard(k.ranking.id)}><Face m={k.ranking} size={34} /><span><small>Ranking member</small><b>{S.nameOf(k.ranking, real)}</b></span></button>}
              </div>
              <div className="pm-comm-seats">{k.members.map((m) => <i key={m.id} className={`${pc(m.p)} ${m.id === s.youId ? "me" : ""}`} title={S.nameOf(m, real)} onClick={() => setCard(m.id)} />)}</div>
              <small className="muted">{k.members.length} members{k.members.some((m) => m.id === s.youId) ? " · you sit here" : ""}</small>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Your network: everyone you have a relationship with, as a hierarchy ──
export function Network({ s, real, setCard }) {
  const rows = S.relations(s);
  const tiers = [["Allies", (r) => r.rel >= 0.35], ["Friendly", (r) => r.rel >= 0.1 && r.rel < 0.35], ["Know them", (r) => r.rel > -0.05 && r.rel < 0.1], ["Cool", (r) => r.rel <= -0.05 && r.rel > -0.3], ["Hostile", (r) => r.rel <= -0.3]];
  return (
    <div className="stack">
      <h2 className="pm-h">Your network</h2>
      <p className="muted">{rows.length} people you know in Washington. Meet colleagues, keep promises and do favors to move them up; a broken promise sends them down and they remember.</p>
      <section className="pm-pyramid net">
        <div className="pm-pyr-head you"><Face m={S.memberById[s.youId]} size={52} ring="#ffcf5a" /><div><strong>You</strong><small>{S.nameOf(S.memberById[s.youId], real)}</small></div></div>
        {tiers.map(([title, f], i) => { const list = rows.filter(f); return (
          <div key={title} className={`pm-tier lvl${i}`}>
            <div className={`pm-tier-band t-${title.split(" ")[0].toLowerCase()}`}>{title} <small>{list.length}</small></div>
            {list.length ? <div className="pm-tier-row">{list.slice(0, 24).map((r) => <Tile key={r.m.id} m={r.m} s={s} real={real} setCard={setCard} sub={`${r.m.p}-${r.m.seat}${r.owes ? " · owes you" : ""}${r.youOwe ? " · you owe" : ""}`} />)}{list.length > 24 && <small className="muted">+{list.length - 24} more</small>}</div> : <p className="muted small">Nobody yet.</p>}
          </div>); })}
      </section>
    </div>
  );
}

// ── Your office: your attributes and your staff ──
export function Office({ s, real, act, setS }) {
  const you = S.memberById[s.youId], a = S.yourAttrs(s);
  return (
    <div className="pm-two">
      <section className="stack">
        <h2 className="pm-h">You</h2>
        <section className="panel pm-profile">
          <Face m={you} size={96} ring="#ffcf5a" />
          <div><h3>{S.titleOf(you)} {S.nameOf(you, real)}</h3><p className="muted">{you.p === "D" ? "Democrat" : "Republican"} · {you.seat} · {you.faction} · in office since {you.since}</p>
            <p className="small">{(you.comm || []).map((c) => c.n + (c.role ? ` (${c.role}${c.exp ? ", expected" : ""})` : c.exp ? " (expected)" : "")).join(", ") || "No committee seats yet"}</p></div>
        </section>
        <section className="panel"><h3>Attributes</h3><p className="muted small">On a 1 to 20 scale, like Football Manager. They rise with use: TV builds Media, call time builds Fundraising, kept promises build Integrity.</p><Attrs a={a} know={3} /></section>
        <section className="panel"><h3>Your numbers over time</h3><Trend s={s} keys={[["a", "Approval at home", "#2fbf71"], ["b", "Your base", "#3d7bd9"], ["p", "The President", "#c8443a"]]} /></section>
      </section>
      <aside className="stack">
        {S.roleOf(s) !== "P" && (() => { const mm = S.moneyMix(s), ties = Object.entries(s.ties || {}).filter(([, v]) => v >= 20).sort((a, b) => b[1] - a[1]); return (
          <section className="panel">
            <h3>Where your money comes from</h3>
            <div className="pm-money"><div className="pm-money-bar">{[["Small donors", mm.small, "#2fbf71"], ["Big donors", mm.large, "#7fa6ec"], ["PACs", mm.pac, "#e0a94a"]].map(([l, v, c]) => <i key={l} style={{ width: `${v * 100}%`, background: c }} />)}</div>
              <div className="pm-money-key">{[["Small donors", mm.small, "#2fbf71"], ["Big donors", mm.large, "#7fa6ec"], ["PACs", mm.pac, "#e0a94a"]].map(([l, v, c]) => <span key={l}><i style={{ background: c }} />{l} <b>{Math.round(v * 100)}%</b></span>)}</div></div>
            <p className="small muted">Raised this career: ${Math.round(mm.total).toLocaleString()}K. {mm.pac > 0.45 ? "PAC-heavy: easy money, and your primary voters may hold it against you." : mm.small > 0.5 ? "Mostly small donors: nobody owns you, but you have to keep them fired up." : "A mix."}</p>
            {ties.length > 0 && <p className="small">Industries that expect your call back: {ties.map(([g, v]) => `${S.GROUP_NAME(g)} ($${Math.round(v)}K)`).join(", ")}.</p>}
            {s.pledge ? <span className="pill pos2">You've sworn off corporate PAC money</span> : <button type="button" className="ghost" onClick={() => setS(S.takePledge(s))}>Swear off corporate PAC money</button>}
          </section>); })()}
        <h2 className="pm-h">Your staff</h2>
        {s.staff.map((x) => (
          <article key={x.id} className="panel pm-staff">
            <Portrait id={x.id + s.seed + x.name} g={x.first.match(/a$|e$|y$|ine$|Ines|Joy|Grace/) ? "F" : "M"} born={2027 - 26 - x.exp} p="N" size={56} />
            <div><strong>{x.name}</strong><small>{x.title} · {x.exp} years in politics</small><p className="small muted">{x.note}</p>
              <div className="pm-attrs mini"><div className="pm-attr"><span>Skill</span><b className={tint(x.skill)}>{x.skill}</b></div><div className="pm-attr"><span>Loyalty</span><b className={tint(x.loyalty)}>{x.loyalty}</b></div></div>
              {x.skill < 20 && S.roleOf(s) !== "P" && <button type="button" className="ghost pm-hire" disabled={!S.can(s, "hire") || s.cash < S.hireCost(x)} onClick={() => act("hire", { role: x.role })}>Replace with a better hire (${S.hireCost(x)}K, 4h)</button>}</div>
          </article>
        ))}
        {(s.career || []).length > 0 && <section className="panel"><h3>Your career</h3><ul className="pm-cab-pending">{s.career.map((c) => <li key={c.congress}><span className="pill">{S.ord(c.congress)} Congress</span> {c.kind === "higher" ? `Won a Senate seat in ${c.year}` : c.kind === "term" ? "Finished the term" : `Reelected in ${c.year} by ${c.margin} points`} · {c.laws} of your bills became law</li>)}</ul></section>}
        <p className="muted small">Your legislative director's skill sets how accurate your whip counts are; your pollster's sets the margin of error on your polls.</p>
      </aside>
    </div>
  );
}

// A small line chart over the weeks.
export function Trend({ s, keys, h = 160 }) {
  const t = s.trend || [];
  if (t.length < 2) return <p className="muted small">The chart fills in as the weeks go by.</p>;
  const W = 600, pad = 28, xs = (i) => pad + (i / (t.length - 1)) * (W - pad - 8), ys = (v) => h - 20 - ((v - 20) / 60) * (h - 30);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="pm-trend" role="img" aria-label="Trend over time">
      {[30, 50, 70].map((v) => <g key={v}><line x1={pad} x2={W - 8} y1={ys(v)} y2={ys(v)} stroke="var(--line)" /><text x={4} y={ys(v) + 4} fontSize="10" fill="var(--muted)">{v}%</text></g>)}
      {keys.map(([k, l, c]) => <polyline key={k} fill="none" stroke={c} strokeWidth="2.2" points={t.map((d, i) => `${xs(i)},${ys(d[k])}`).join(" ")} />)}
      {keys.map(([k, l, c], i) => <text key={l} x={pad + i * 150} y={h - 4} fontSize="11" fill={c} fontWeight="700">● {l} {t[t.length - 1][k]}%</text>)}
    </svg>
  );
}

// ── The White House ──
export function WhiteHouse({ s, act }) {
  const you = S.memberById[s.youId];
  const live = S.activeBills(s);
  return (
    <div className="pm-two">
      <section className="stack">
        <section className="pm-wh-hero">
          <span className="pm-wh-av"><Face m={S.PRES_M} size={72} /></span>
          <div><span className="rc-live"><i className="live-dot" /> The White House</span><h2>The President</h2>
            <p>Approval <b>{Math.round(s.presApproval)}%</b> · Your rapport: <b>{S.RAPPORT(s.rapport || 0)}</b> · Executive orders this term: <b>{s.eo || 0}</b></p></div>
        </section>
        <h2 className="pm-h">What the President is saying</h2>
        <ul className="pm-wh-feed">{(s.pres || []).map((x, i) => <li key={i} className={x.text.startsWith("REVERSAL") ? "flip" : x.text.startsWith("EXECUTIVE") ? "eo" : ""}><small>{S.fmtDate(x.week)}</small>{x.text}</li>)}</ul>
        {!(s.pres || []).length && <p className="muted">Nothing yet. He'll weigh in on every bill, sooner or later.</p>}
      </section>
      <aside className="stack">
        <h2 className="pm-h">Where he stands</h2>
        {live.map((b) => { const v = S.presView(s, b); return (
          <div key={b.id} className="panel pm-wh-bill">
            <strong>{S.byId[b.pid].name}</strong>
            <div className="pm-wh-meter"><i style={{ left: `${Math.max(0, Math.min(100, 50 + v.score * 50))}%` }} /><em style={{ left: `${50 + (v.score - v.gap) * 50}%` }} /></div>
            <small className={v.signs ? "ok" : "no"}>{v.signs ? "Would sign" : "Would veto"}{v.firm ? " · firm" : " · movable"}{b.flipped ? " · has flipped once" : ""}</small>
            <button type="button" className="ghost" disabled={!S.can(s, "wh")} onClick={() => act("wh", { bill: b.id })}>Lobby him on it (8 hours)</button>
          </div>); })}
        <section className="panel"><h3>His approval</h3><Trend s={s} keys={[["p", "President", "#c8443a"]]} h={130} /></section>
        <p className="muted small">His party's members feel his pull on every vote, and twice as hard on a veto override. {you.p === "R" ? "As a Republican you get meetings more easily." : "As a Democrat, you need a real national profile before he takes your calls."}</p>
      </aside>
    </div>
  );
}

// ── The Cabinet: the executive branch as characters ──
const FEMALE = new Set(["Susie", "Brooke", "Linda", "Pam", "Jeanine", "Kari"]);
const cabFace = (c) => ({ id: "cab" + c.last, g: FEMALE.has(c.first) ? "F" : "M", born: c.born || 1970, p: "R", look: c.tone !== undefined ? { skin: c.tone } : undefined });
export function Cabinet({ s, real, act, role, you }) {
  const [eoQ, setEoQ] = useState("");
  const P = S.PRES_M, rival = role !== "P" && you.p !== S.presParty();
  const imps = (s.imp || []).filter((i) => !i.done), noms = (s.noms || []).filter((n) => !n.done);
  const orders = role === "P" ? S.POLICIES.filter((p) => (S.PRESIDENT_STANCE[p.id] || 0) > 0.3 && !s.laws.includes(p.id) && !(s.eos || []).some((e) => e.pid === p.id) && p.name.toLowerCase().includes(eoQ.toLowerCase())).slice(0, 10) : [];
  return (
    <div className="stack">
      <section className="pm-wh-hero pm-cab-hero">
        <Face m={P} size={84} ring="#ffcf5a" />
        <div>
          <span className="eyebrow">The executive branch</span>
          <h2>{role === "P" ? "Your administration" : `President ${S.nameOf(P, real)}'s administration`}</h2>
          <p className="muted small">Approval {Math.round(s.presApproval)}% · scandal heat {Math.round((s.presHeat || 0) * 100)}/100{s.presHeat > 0.75 ? " · impeachment talk is growing" : ""}. Cabinet officers rise and fall on scandal heat. Above 70 the press is on them; above 90 House Democrats move to impeach. Replacements need 51 senators.</p>
        </div>
      </section>
      {(imps.length > 0 || noms.length > 0) && (
        <section className="panel">
          <h3>In the Senate and House now</h3>
          <ul className="pm-cab-pending">
            {noms.map((n) => { const c = s.cab.find((x) => x.id === n.post); return <li key={n.id}><span className="pill">Nomination</span> {real ? `${n.first} ${n.last}` : S.swapPair(n.first, n.last).join(" ")} for {c.post}. Senate vote {S.fmtDate(n.vote)}. {n.cont > 0.5 ? "Expect a brawl." : "Looks confirmable."}</li>; })}
            {imps.map((i) => { const c = s.cab.find((x) => x.id === i.who); return <li key={i.id}><span className="pill neg2">Impeachment</span> {i.who === "POTUS" ? "The President" : `${c.post} ${S.cabName(c, real)}`}: {i.stage === "house" ? "House vote" : "Senate trial verdict"} {S.fmtDate(i.week)}.</li>; })}
          </ul>
        </section>
      )}
      <div className="pm-cab-grid">
        {s.cab.map((c) => (
          <article key={c.id} className={`pm-cab ${c.vacant ? "vacant" : ""} ${c.heat >= 0.7 ? "hot" : ""}`}>
            <header>{c.vacant ? <span className="pm-cab-empty">?</span> : <Face m={cabFace(c)} size={52} />}<div><small>{c.post}</small><strong>{c.vacant ? "Vacant (acting)" : S.cabName(c, real)}</strong></div></header>
            {!c.vacant && <div className="pm-heat" title="Scandal heat"><span>Heat</span><i><b style={{ width: `${c.heat * 100}%`, background: c.heat >= 0.7 ? "#c8443a" : c.heat >= 0.45 ? "#e0a94a" : "#2fbf71" }} /></i><em>{Math.round(c.heat * 100)}</em></div>}
            {!c.vacant && <p className="small muted">{c.note}{c.area?.length ? ` Fights over: ${c.area.slice(0, 3).map((id) => S.byId[id]?.name).filter(Boolean).join(", ")}.` : ""}</p>}
            <div className="bill-actions">
              {!c.vacant && role === "P" && c.id !== "vp" && <button type="button" className="ghost danger" disabled={!S.can(s, "fire")} onClick={() => act("fire", { id: c.id })}>Fire (4h)</button>}
              {!c.vacant && role !== "P" && rival && c.id !== "vp" && <button type="button" className="ghost" disabled={!S.can(s, "hearing")} onClick={() => act("hearing", { id: c.id })}>Oversight hearing (8h)</button>}
              {!c.vacant && role !== "P" && !rival && <button type="button" className="ghost" disabled={!S.can(s, "defend")} onClick={() => act("defend", { id: c.id })}>Defend on TV (4h)</button>}
            </div>
          </article>
        ))}
      </div>
      {role === "P" && (
        <section className="panel">
          <h3>Executive orders</h3>
          <p className="muted small">Act without Congress. It takes effect at once and moves opinion, but many orders get sued, and a judge can block them.</p>
          <input className="pm-search" placeholder="Search: tariffs, border, school choice…" value={eoQ} onChange={(e) => setEoQ(e.target.value)} />
          <div className="pm-results">{orders.map((p) => <button key={p.id} type="button" className="pm-row" disabled={!S.can(s, "eo")} onClick={() => act("eo", { pid: p.id })}><span><strong>{p.name}</strong><small>{p.desc}</small></span></button>)}</div>
          {(s.eos || []).length > 0 && <ul className="pm-cab-pending">{s.eos.map((e) => <li key={e.pid}><span className={`pill ${e.alive ? "pos2" : "neg2"}`}>{e.alive ? (e.court ? "In force, in court" : "In force") : "Blocked"}</span> {S.byId[e.pid].name} · signed {S.fmtDate(e.week)}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}

// ── Elections: the map ──
const STATE_NAME = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
// Probability (or seat share) of Democrats -> a color from deep red to deep blue.
const shade = (p) => (p >= 0.95 ? "#1b3f8f" : p >= 0.8 ? "#3d7bd9" : p >= 0.6 ? "#9db8f0" : p > 0.4 ? "#d9d4e6" : p > 0.2 ? "#f0a9a0" : p > 0.05 ? "#d4594d" : "#8f231b");
const SMALL = new Set(["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC", "HI"]);
export function Elections({ s }) {
  const [view, setView] = useState("pres");
  const [when, setWhen] = useState("now");
  const [hover, setHover] = useState(null);
  const year = S.electionYear(s), presYear = year % 4 === 0;
  const past = when === "last";
  const pres = past && s.lastPres ? s.lastPres : S.presMap(s);
  const sen = past && s.lastSenate ? s.lastSenate : S.senateMap(s);
  const house = S.houseMap();
  const fill = (st) => {
    if (view === "pres") return shade(pres.states[st]?.pD ?? 0.5);
    if (view === "senate") { const x = sen.states[st]; return x ? shade(x.pD) : "#e6e9ef"; }
    const x = house.states[st]; return x ? shade(x.pD) : "#e6e9ef";
  };
  const tip = (st) => {
    if (view === "pres") { const x = pres.states[st]; return x && `${STATE_NAME[st]} · ${x.ev} electoral votes · ${x.m > 0 ? "D" : "R"}+${Math.abs(x.m).toFixed(1)}${pres.final ? "" : ` · Democrats ${Math.round(x.pD * 100)}% to win`}`; }
    if (view === "senate") { const x = sen.states[st]; if (!x) return `${STATE_NAME[st]} · no Senate race this cycle`; const m = S.memberById[x.who]; return `${STATE_NAME[st]} · ${past ? "won by" : "held by"} ${past ? (x.w === "D" ? "Democrats" : "Republicans") : `${S.nameOf(m)} (${m.p})`} · ${x.m > 0 ? "D" : "R"}+${Math.abs(x.m).toFixed(1)}${past ? "" : ` · Democrats ${Math.round(x.pD * 100)}% to win`}`; }
    const x = house.states[st]; return x && `${STATE_NAME[st]} · ${x.D} Democrats, ${x.R} Republicans in the House`;
  };
  const evD = pres.ev.D, evR = pres.ev.R;
  const senUp = Object.values(sen.states), senD = SENATE_SAFE(s, sen);
  return (
    <div className="stack">
      <div className="pm-headrow">
        <h2 className="pm-h">Elections {past ? (s.lastPres || s.lastSenate ? `· ${year - 2}` : "") : `· ${year} forecast`}</h2>
        <div className="hemi-by">{[["pres", "President"], ["senate", "Senate"], ["house", "House delegations"]].map(([v, l]) => <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>)}</div>
        {(s.lastPres || s.lastSenate) && <div className="hemi-by">{[["now", "Forecast"], ["last", "Last election"]].map(([v, l]) => <button key={v} type="button" className={when === v ? "on" : ""} onClick={() => setWhen(v)}>{l}</button>)}</div>}
      </div>
      {view === "pres" && (
        <section className="panel pm-evbar">
          <div className="pm-ev-nums"><span className="dem"><b>{evD}</b> Democrats</span><span className="muted small">{pres.final ? `Final, ${pres.year}` : presYear ? `If the election were held today · national ${pres.nat >= 0 ? "D" : "R"}+${Math.abs(pres.nat).toFixed(1)}` : `Next presidential election ${year + 2} · if it were held today`}</span><span className="rep">Republicans <b>{evR}</b></span></div>
          <div className="pm-ev-track"><i className="d" style={{ width: `${(evD / 538) * 100}%` }} /><i className="r" style={{ width: `${(evR / 538) * 100}%` }} /><em style={{ left: "50.2%" }} title="270 to win" /></div>
        </section>
      )}
      {view === "senate" && <section className="panel small">{senUp.length} seats {past ? "were" : "are"} on the {past ? "last" : year} ballot (class {sen.cls}). Democrats hold {S.SENATE.filter((m) => m.p === "D").length} seats now{!past ? `; on this forecast they would hold about ${senD}` : ""}.</section>}
      {view === "house" && <section className="panel small">Democrats hold {S.HOUSE.filter((m) => m.p === "D").length} of 435 seats. The generic ballot is {s.mood >= 0 ? "D" : "R"}+{Math.abs(s.mood).toFixed(1)}.</section>}
      <section className="pm-map-wrap">
        <svg viewBox="0 0 975 610" className="pm-map" role="img" aria-label="Map of the United States">
          {Object.entries(USMAP).map(([st, g]) => <path key={st} d={g.d} fill={fill(st)} stroke="#fff" strokeWidth={hover === st ? 2.5 : 0.8} onMouseEnter={() => setHover(st)} onMouseLeave={() => setHover(null)} onClick={() => setHover(st)} />)}
          {Object.entries(USMAP).filter(([st]) => !SMALL.has(st)).map(([st, g]) => <text key={st} x={g.c[0]} y={g.c[1]} className="pm-map-lbl">{st}</text>)}
        </svg>
        <div className="pm-map-tip">{hover ? tip(hover) : "Hover or tap a state."}</div>
        <div className="pm-legend">{[["Safe D", 0.97], ["Likely D", 0.85], ["Lean D", 0.65], ["Toss-up", 0.5], ["Lean R", 0.35], ["Likely R", 0.15], ["Safe R", 0.02]].map(([l, p]) => <span key={l}><i style={{ background: shade(p) }} />{l}</span>)}</div>
      </section>
      <p className="muted small">The forecast moves with the generic ballot, which follows the President's approval and the economy. Each state starts from its 2024 presidential result. Maine and Nebraska's district electoral votes are counted with the statewide winner. {view === "senate" ? "Senate forecasts include incumbency." : ""}</p>
    </div>
  );
}
const SENATE_SAFE = (s, sen) => S.SENATE.filter((m) => m.p === "D" && sen.states[m.st]?.who !== m.id).length + Object.values(sen.states).filter((x) => x.pD >= 0.5).length;

// ── Election night: the map fills in, east to west, as the networks call states ──
export function ElectionNight({ night, real }) {
  const order = useMemo(() => {
    const src = night.pres ? night.pres.states : night.senate.states;
    return Object.keys(src).filter((st) => USMAP[st]).sort((a, b) => (USMAP[b].c[0] - USMAP[a].c[0]) || (src[a].m - src[b].m));
  }, [night]);
  const calm = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  const [n, setN] = useState(calm ? order.length : 0), [run, setRun] = useState(0);
  React.useEffect(() => { if (calm) return; setN(0); let i = 0; const t = setInterval(() => { i++; setN(i); if (i >= order.length) clearInterval(t); }, 95); return () => clearInterval(t); }, [order, run]);
  const called = new Set(order.slice(0, n));
  const src = night.pres ? night.pres.states : night.senate.states;
  let D = 0, R = 0; for (const st of called) { const x = src[st]; if (night.pres) (x.w === "D" ? (D += x.ev) : (R += x.ev)); else (x.w === "D" ? D++ : R++); }
  const winner = night.pres ? (D >= 270 ? "D" : R >= 270 ? "R" : null) : n >= order.length ? (night.senD >= 51 ? "D" : "R") : null;
  const latest = order[n - 1];
  return (
    <section className="pm-elx">
      <div className="pm-elx-head">
        <span className="rc-live"><i className="live-dot" /> Election night {night.year}</span>
        <strong>{night.pres ? "The race for the White House" : "The Senate races"}</strong>
        {latest && n < order.length && <span className="pm-elx-call">Projected: {latest} goes {src[latest].w === "D" ? "Democratic" : "Republican"}</span>}
        <button type="button" className="linkbtn" onClick={() => setRun((x) => x + 1)}>Replay</button>
      </div>
      <div className="pm-elx-tally">
        <span className="dem"><b>{D}</b> {night.pres ? "Democrats" : "D wins"}</span>
        <div className="pm-ev-track">{night.pres ? <><i className="d" style={{ width: `${(D / 538) * 100}%` }} /><i className="r" style={{ width: `${(R / 538) * 100}%` }} /><em style={{ left: "50.2%" }} /></> : <><i className="d" style={{ width: `${(D / order.length) * 100}%` }} /><i className="r" style={{ width: `${(R / order.length) * 100}%` }} /></>}</div>
        <span className="rep">{night.pres ? "Republicans" : "R wins"} <b>{R}</b></span>
      </div>
      <svg viewBox="0 0 975 610" className="pm-map">
        {Object.entries(USMAP).map(([st, g]) => { const x = src[st], on = called.has(st); return <path key={st} d={g.d} fill={!x ? "#2a3550" : on ? (x.w === "D" ? (Math.abs(x.m) > 10 ? "#1b3f8f" : "#3d7bd9") : (Math.abs(x.m) > 10 ? "#8f231b" : "#d4594d")) : "#55627d"} stroke="#0b1220" strokeWidth="1" className={on ? "called" : ""} />; })}
      </svg>
      {winner && <div className="pm-elx-win"><span className="rc-stamp">{night.pres ? `${winner === "D" ? "DEMOCRATS" : "REPUBLICANS"} WIN THE WHITE HOUSE` : `${winner === "D" ? "DEMOCRATS" : "REPUBLICANS"} HOLD THE SENATE`}</span><small>{night.pres ? `${Math.max(night.pres.ev.D, night.pres.ev.R)} electoral votes. ` : ""}Senate: {night.senD} Democrats · House: {night.houseD} Democrats</small></div>}
    </section>
  );
}
