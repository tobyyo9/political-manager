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
      <NetWeb s={s} real={real} setCard={setCard} rows={rows} />
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

// The corkboard: you in the middle, your strongest ties pinned around you, string for every relationship.
function NetWeb({ s, real, setCard, rows }) {
  const you = S.memberById[s.youId];
  const pick = [...rows].sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel)).slice(0, 16);
  if (!pick.length) return null;
  const W = 760, H = 380, cx = W / 2, cy = H / 2;
  const pos = pick.map((r, i) => { const t = (i / pick.length) * Math.PI * 2 - Math.PI / 2, ring = i % 2 ? 0.78 : 1; return { r, x: cx + Math.cos(t) * 330 * ring, y: cy + Math.sin(t) * 150 * ring }; });
  return (
    <section className="pm-cork">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {pos.map(({ r, x, y }) => <path key={r.m.id} d={`M${cx},${cy} Q${(cx + x) / 2},${(cy + y) / 2 + 18} ${x},${y}`} fill="none" stroke={r.rel >= 0 ? "#2f8f4e" : "#b3261e"} strokeWidth={1 + Math.abs(r.rel) * 5} strokeOpacity=".85" strokeDasharray={r.rel < 0 ? "6 4" : ""} />)}
      </svg>
      <div className="pm-pin you" style={{ left: "50%", top: "50%" }}><Face m={you} size={58} ring="#ffcf5a" /><small>You</small></div>
      {pos.map(({ r, x, y }, i) => (
        <button key={r.m.id} type="button" className={`pm-pin ${r.rel < 0 ? "neg" : ""}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(-50%,-50%) rotate(${((i * 37) % 9) - 4}deg)` }} onClick={() => setCard(r.m.id)} title={`${S.nameOf(r.m, real)}: ${r.rel >= 0.35 ? "ally" : r.rel >= 0.1 ? "friendly" : r.rel <= -0.3 ? "hostile" : r.rel < -0.05 ? "cool" : "neutral"}`}>
          <Face m={r.m} size={40} /><small>{S.nameOf(r.m, real).split(" ").slice(-1)[0]}</small>
        </button>))}
      <p className="pm-cork-key">String thickness is how strong the tie is. Green: on your side. Red, dashed: against you.</p>
    </section>
  );
}

// ── Your office: your attributes and your staff ──
export function Office({ s, real, act, setS, setToast }) {
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
        {setS && <Earnings s={s} setS={setS} setToast={setToast} />}
        <section className="panel"><h3>Your numbers over time</h3><Trend s={s} keys={[["a", "Approval at home", "#2fbf71"], ["b", "Your base", "#3d7bd9"], ["p", "The President", "#c8443a"]]} /></section>
      </section>
      <aside className="stack">
        {S.isMem(S.roleOf(s)) && (() => { const mm = S.moneyMix(s), ties = Object.entries(s.ties || {}).filter(([, v]) => v >= 20).sort((a, b) => b[1] - a[1]); return (
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
              {x.skill < 20 && S.isMem(S.roleOf(s)) && <button type="button" className="ghost pm-hire" disabled={!S.can(s, "hire") || s.cash < S.hireCost(x)} onClick={() => act("hire", { role: x.role })}>Replace with a better hire (${S.hireCost(x)}K, 4h)</button>}</div>
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
export function WhiteHouse({ s, act, real }) {
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
        <ul className="pm-wh-feed">{(s.pres || []).map((x, i) => <li key={i} className={x.text.startsWith("REVERSAL") ? "flip" : x.text.startsWith("EXECUTIVE") ? "eo" : ""}><small>{S.fmtDate(x.week)}</small>{realYou(x.text, s, real)}</li>)}</ul>
        {!(s.pres || []).length && <p className="muted">Nothing yet. {S.presPron("He'll")} weigh in on every bill, sooner or later.</p>}
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
        <section className="panel"><h3>{S.presPron("His")} approval</h3><Trend s={s} keys={[["p", "President", "#c8443a"]]} h={130} /></section>
        <p className="muted small">{S.presPron("His party's members feel his pull on every vote, and twice as hard on a veto override.")} {you.p === "R" ? "As a Republican you get meetings more easily." : "As a Democrat, you need a real national profile before he takes your calls."}</p>
      </aside>
    </div>
  );
}

// ── The Cabinet: the executive branch as characters ──
const FEMALE = new Set(["Susie", "Brooke", "Linda", "Pam", "Jeanine", "Kari"]);
const cabFace = (c) => ({ id: "cab" + c.last, g: FEMALE.has(c.first) ? "F" : "M", born: c.born || 1970, p: S.presParty(), look: c.tone !== undefined ? { skin: c.tone } : undefined });
export function Cabinet({ s, real, act, role, you }) {
  const [eoQ, setEoQ] = useState("");
  const P = S.PRES_M, rival = (role === "H" || role === "S") && you.p !== S.presParty();
  const imps = (s.imp || []).filter((i) => !i.done), noms = (s.noms || []).filter((n) => !n.done);
  const orders = role === "P" ? S.POLICIES.filter((p) => (S.PRESIDENT_STANCE[p.id] || 0) > 0.3 && !s.laws.includes(p.id) && !(s.eos || []).some((e) => e.pid === p.id) && p.name.toLowerCase().includes(eoQ.toLowerCase())).slice(0, 10) : [];
  return (
    <div className="stack">
      <section className="pm-wh-hero pm-cab-hero">
        <Face m={P} size={84} ring="#ffcf5a" />
        <div>
          <span className="eyebrow">The executive branch</span>
          <h2>{role === "P" ? "Your administration" : `President ${S.nameOf(P, real)}'s administration`}</h2>
          <p className="muted small">Approval {Math.round(s.presApproval)}% · scandal heat {Math.round((s.presHeat || 0) * 100)}/100{s.presHeat > 0.75 ? " · impeachment talk is growing" : ""}. Cabinet officers rise and fall on scandal heat. Above 70 the press is on them; above 90 House {S.presParty() === "D" ? "Republicans" : "Democrats"} move to impeach. Replacements need 51 senators.</p>
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
      {role === "C" && (() => { const c = S.cabPost(s), C = s.cabCareer; return c && (
        <section className="panel pm-dept"><h3>Your department: {c.post}</h3>
          <p className="small">In your lane: {(c.area || []).map((id) => S.byId[id]?.name).filter(Boolean).join(", ") || "the whole of government, as the President sees fit"}.</p>
          {C.rules.length ? <ul className="small">{C.rules.map((x) => <li key={x.pid}>{S.byId[x.pid]?.name}: {x.alive ? (x.court ? `in effect, court date ${S.fmtDate(x.court)}` : "in effect") : "blocked in court"}</li>)}</ul> : <p className="small muted">No rules yet. Issue one from your inbox's action list.</p>}
          <p className="small muted">The President's trust: {Math.round((C.trust + 1) * 50)}/100. Below 25 you're fired. Department heat above 90 can force you out.</p>
        </section>); })()}
      <div className="pm-cab-grid">
        {s.cab.map((c) => (
          <article key={c.id} className={`pm-cab ${c.vacant ? "vacant" : ""} ${c.heat >= 0.7 ? "hot" : ""}`}>
            <header>{c.vacant ? <span className="pm-cab-empty">?</span> : <Face m={cabFace(c)} size={52} />}<div><small>{c.post}</small><strong>{c.vacant ? "Vacant (acting)" : S.cabName(c, real)}{c.you ? " (you)" : ""}</strong></div></header>
            {!c.vacant && <div className="pm-heat" title="Scandal heat"><span>Heat</span><i><b style={{ width: `${c.heat * 100}%`, background: c.heat >= 0.7 ? "#c8443a" : c.heat >= 0.45 ? "#e0a94a" : "#2fbf71" }} /></i><em>{Math.round(c.heat * 100)}</em></div>}
            {(() => { const pr = (s.probes || []).find((x) => x.cab === c.id && x.stage !== "done"); return pr ? <p className="pm-probe small"><b>Under investigation</b> · {S.probeStage(pr)}{pr.by === s.youId ? " · yours" : ""}{!pr.power ? " · minority, no subpoenas" : ""}</p> : null; })()}
            {!c.vacant && <p className="small muted">{c.note}{c.area?.length ? ` Fights over: ${c.area.slice(0, 3).map((id) => S.byId[id]?.name).filter(Boolean).join(", ")}.` : ""}</p>}
            <div className="bill-actions">
              {!c.vacant && role === "P" && c.id !== "vp" && <button type="button" className="ghost danger" disabled={!S.can(s, "fire")} onClick={() => act("fire", { id: c.id })}>Fire (4h)</button>}
              {!c.vacant && (role === "H" || role === "S") && rival && c.id !== "vp" && <button type="button" className="ghost" disabled={!S.can(s, "hearing")} onClick={() => act("hearing", { id: c.id })}>Oversight hearing (8h)</button>}
              {!c.vacant && (role === "H" || role === "S") && rival && c.id !== "vp" && !(s.probes || []).some((x) => x.cab === c.id && x.stage !== "done") && <button type="button" className="ghost" disabled={!S.can(s, "probe")} onClick={() => act("probe", { id: c.id })}>Open an investigation (10h)</button>}
              {!c.vacant && (role === "H" || role === "S") && !rival && <button type="button" className="ghost" disabled={!S.can(s, "defend")} onClick={() => act("defend", { id: c.id })}>Defend on TV (4h)</button>}
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
const STATE_NAME = S.STATE_NAME;
// Probability (or seat share) of Democrats -> a color from deep red to deep blue.
const shade = (p) => (p >= 0.95 ? "#1b3f8f" : p >= 0.8 ? "#3d7bd9" : p >= 0.6 ? "#9db8f0" : p > 0.4 ? "#d9d4e6" : p > 0.2 ? "#f0a9a0" : p > 0.05 ? "#d4594d" : "#8f231b");
const SMALL = new Set(["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC", "HI"]);
export function Elections({ s, real }) {
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
    if (view === "gov") { const g = S.govOf(s, st); return !g ? "#e6e9ef" : shade(g.p === "D" ? (g.lead ? 0.65 : 0.92) : g.lead ? 0.35 : 0.08); }
    const x = house.states[st]; return x ? shade(x.pD) : "#e6e9ef";
  };
  const tip = (st) => {
    if (view === "pres") { const x = pres.states[st]; return x && `${STATE_NAME[st]} · ${x.ev} electoral votes · ${x.m > 0 ? "D" : "R"}+${Math.abs(x.m).toFixed(1)}${pres.final ? "" : ` · Democrats ${Math.round(x.pD * 100)}% to win`}`; }
    if (view === "senate") { const x = sen.states[st]; if (!x) return `${STATE_NAME[st]} · no Senate race this cycle`; const m = S.memberById[x.who], nn = (n) => (real ? `${n.first} ${n.last}` : `${n.sf} ${n.sl}`), noms = !past && x.noms ? ["D", "R"].filter((p) => x.noms[p]).map((p) => `${nn(x.noms[p])} (${p})`).join(" vs. ") : ""; return `${STATE_NAME[st]} · ${past ? "won by" : x.open ? "open seat, held by" : "held by"} ${past ? (x.w === "D" ? "Democrats" : "Republicans") : `${S.nameOf(m, real)} (${m.p})`}${noms ? ` · running: ${noms}` : ""} · ${x.m > 0 ? "D" : "R"}+${Math.abs(x.m).toFixed(1)}${past ? "" : ` · Democrats ${Math.round(x.pD * 100)}% to win`}`; }
    if (view === "gov") { const g = S.govOf(s, st); return g ? `${STATE_NAME[st]} · Governor ${real ? `${g.first} ${g.last}` : `${g.sf} ${g.sl}`} (${g.p})${g.you ? " · you" : ""}${g.lead ? " · race not yet called; leading" : ""} · next election ${g.next}${g.tl ? ", term-limited" : ""}` : `${STATE_NAME[st]} · no governor`; }
    const x = house.states[st]; return x && `${STATE_NAME[st]} · ${x.D} Democrats, ${x.R} Republicans in the House`;
  };
  const evD = pres.ev.D, evR = pres.ev.R;
  const senUp = Object.values(sen.states), senD = SENATE_SAFE(s, sen);
  return (
    <div className="stack">
      <div className="pm-headrow">
        <h2 className="pm-h">Elections {past ? (s.lastPres || s.lastSenate ? `· ${year - 2}` : "") : `· ${year} forecast`}</h2>
        <div className="hemi-by">{[["pres", "President"], ["senate", "Senate"], ["house", "House delegations"], ["gov", "Governors"], ...(s.amb?.pr && !past ? [["race", `${s.amb.year} primaries`]] : [])].map(([v, l]) => <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>)}</div>
        {(s.lastPres || s.lastSenate) && <div className="hemi-by">{[["now", "Forecast"], ["last", "Last election"]].map(([v, l]) => <button key={v} type="button" className={when === v ? "on" : ""} onClick={() => setWhen(v)}>{l}</button>)}</div>}
      </div>
      {view === "pres" && (
        <section className="panel pm-evbar">
          <div className="pm-ev-nums"><span className="dem"><b>{evD}</b> Democrats</span><span className="muted small">{pres.final ? `Final, ${pres.year}` : presYear ? `If the election were held today · national ${pres.nat >= 0 ? "D" : "R"}+${Math.abs(pres.nat).toFixed(1)}` : `Next presidential election ${year + 2} · if it were held today`}</span><span className="rep">Republicans <b>{evR}</b></span></div>
          <div className="pm-ev-track"><i className="d" style={{ width: `${(evD / 538) * 100}%` }} /><i className="r" style={{ width: `${(evR / 538) * 100}%` }} /><em style={{ left: "50.2%" }} title="270 to win" /></div>
        </section>
      )}
      {view === "senate" && <section className="panel small">{senUp.length} seats {past ? "were" : "are"} on the {past ? "last" : year} ballot (class {sen.cls}). Democrats hold {S.SENATE.filter((m) => m.p === "D").length} seats now{!past ? `; on this forecast they would hold about ${senD}` : ""}.</section>}
      {view === "gov" && <section className="panel small">{(() => { const g = Object.values(s.govs || {}), d = g.filter((x) => x.p === "D").length, up = g.filter((x) => x.next === year).length; return `Democrats hold ${d} governorships, Republicans ${g.length - d}. ${up} are on the ${year} ballot. Governors appoint senators when a seat opens, and their states sue to block laws they oppose. Alaska and Kansas were still uncalled as of November 10, 2026; the candidate leading is shown, in a lighter shade.`; })()}</section>}
      {view === "house" && <section className="panel small">Democrats hold {S.HOUSE.filter((m) => m.p === "D").length} of 435 seats. The generic ballot is {s.mood >= 0 ? "D" : "R"}+{Math.abs(s.mood).toFixed(1)}.</section>}
      {view === "race" && s.amb?.pr ? <PrimaryRace s={s} real={real} /> : <>
      <section className="pm-map-wrap">
        <svg viewBox="0 0 975 610" className="pm-map" role="img" aria-label="Map of the United States">
          {Object.entries(USMAP).map(([st, g]) => <path key={st} d={g.d} fill={fill(st)} stroke="#fff" strokeWidth={hover === st ? 2.5 : 0.8} onMouseEnter={() => setHover(st)} onMouseLeave={() => setHover(null)} onClick={() => setHover(st)} />)}
          {Object.entries(USMAP).filter(([st]) => !SMALL.has(st)).map(([st, g]) => <text key={st} x={g.c[0]} y={g.c[1]} className="pm-map-lbl">{st}</text>)}
        </svg>
        <div className="pm-map-tip">{hover ? tip(hover) : "Hover or tap a state."}</div>
        <div className="pm-legend">{[["Safe D", 0.97], ["Likely D", 0.85], ["Lean D", 0.65], ["Toss-up", 0.5], ["Lean R", 0.35], ["Likely R", 0.15], ["Safe R", 0.02]].map(([l, p]) => <span key={l}><i style={{ background: shade(p) }} />{l}</span>)}</div>
      </section>
      </>}
      <p className="muted small">The forecast moves with the generic ballot, which follows the President's approval and the economy. Each state starts from how it voted in the 2026 midterms, blended with its 2024 presidential vote, so states that swung hardest in 2026 (Texas, North Carolina, Georgia) start further left than they used to. House districts move half as far as their state. Maine and Nebraska's district electoral votes are counted with the statewide winner. {view === "senate" ? "Senate forecasts include incumbency." : ""}</p>
    </div>
  );
}
// The race for each party's nomination: the field, support, delegates and the calendar.
export function PrimaryRace({ s, real }) {
  const P = s.amb?.pr; if (!P) return null;
  const you = S.memberById[s.youId], t0 = s.termStart || 0;
  const nm = (c) => (c.you ? S.nameOf(you, real) : real ? `${c.first} ${c.last}` : `${c.sf} ${c.sl}`);
  const col = (p) => {
    const X = P[p], need = Math.floor(S.DELS[p] / 2) + 1, rows = [...X.c].sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || (b.out || 0) - (a.out || 0) || b.del - a.del || b.sup - a.sup);
    return (
      <section className={`panel pm-prim ${p}`}>
        <h3>{p === "D" ? "Democrats" : "Republicans"}{X.solo ? " · the President runs again" : X.nom ? ` · nominee: ${nm(X.nom)}` : ""}</h3>
        {!X.c.length ? <p className="muted small">Nobody has declared yet. Candidates usually announce in the year before the election.</p> : (
          <ul className="pm-prim-list">{rows.map((c) => (
            <li key={c.last + c.first} className={c.out ? "out" : c === X.nom ? "nom" : ""}>
              <Face m={{ id: c.id || "pr" + c.last, g: c.g, born: c.born, p: c.p, look: c.look }} size={34} />
              <span className="nm">{nm(c)}{c.you ? " (you)" : ""}<small>{c.out ? `Dropped out${c.endorse ? `, endorsed ${nm(c.endorse)}` : ""}` : c.title === "Sen." ? `Senator, ${c.st}` : c.title === "Rep." ? `Representative, ${c.st}` : c.title || ""}</small></span>
              <span className="pm-prim-bar"><i style={{ width: `${c.out ? 0 : Math.round(c.sup * 100)}%` }} /></span>
              <b>{c.out ? "–" : `${Math.round(c.sup * 100)}%`}</b>
              <span className="del">{c.del ? `${c.del.toLocaleString()}` : ""}</span>
            </li>))}
          </ul>)}
        {!X.solo && <p className="muted small">{need.toLocaleString()} delegates to clinch. Support is a polling average; delegates are won in the contests below.</p>}
      </section>
    );
  };
  return (
    <div className="stack">
      <div className="pm-prim-cols">{col("D")}{col("R")}</div>
      <section className="panel"><h3>The calendar</h3>
        <ol className="pm-cal">{P.cal.map((ev) => <li key={ev.w} className={ev.res ? "done" : ""}><b>{S.fmtDate(t0 + ev.w)}</b> {ev.name}{ev.res && ["D", "R"].filter((p) => ev.res[p]).map((p) => <span key={p} className={`pm-cal-w ${p}`}>{p}: {ev.res[p][0].you ? "you" : nm(ev.res[p][0])} {ev.res[p][0].v}%</span>)}</li>)}</ol>
      </section>
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

// Swap your own altered name back to the real one when real names are on.
export const realYou = (t, s, real) => { const y = S.memberById[s.youId]; if (!real || !y || !t || y.fictional || y.custom) return t; return t.split(`${y.sf} ${y.sl}`).join(`${y.first} ${y.last}`).split(y.sl).join(y.last); };
// ── Your campaign, and money in politics ──
const fmtK = (k) => (Math.abs(k) >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${Math.round(k)}K`);
function Polls({ s }) {
  const ps = s.polls || [];
  if (ps.length < 1) return <p className="muted small">No polls yet. Public polls start once you have an opponent, and you can commission your own.</p>;
  const W = 600, h = 170, pad = 30, w0 = ps[0].w, w1 = Math.max(ps[ps.length - 1].w, w0 + 1);
  const xs = (w) => pad + ((w - w0) / (w1 - w0)) * (W - pad - 12), ys = (v) => h - 22 - ((v - 25) / 50) * (h - 34);
  const line = (k) => ps.map((p) => `${xs(p.w)},${ys(p[k])}`).join(" ");
  const last = ps[ps.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="pm-trend" role="img" aria-label="Your polls over time">
      {[30, 50, 70].map((v) => <g key={v}><line x1={pad} x2={W - 12} y1={ys(v)} y2={ys(v)} stroke="var(--line)" strokeDasharray={v === 50 ? "" : "3 4"} /><text x={4} y={ys(v) + 4} fontSize="10" fill="var(--muted)">{v}%</text></g>)}
      <polyline fill="none" stroke="#2fbf71" strokeWidth="2.4" points={line("you")} />
      <polyline fill="none" stroke="#c8443a" strokeWidth="2.4" points={line("opp")} />
      {ps.map((p, i) => <g key={i}><circle cx={xs(p.w)} cy={ys(p.you)} r={p.internal ? 4.5 : 3} fill={p.internal ? "#fff" : "#2fbf71"} stroke="#2fbf71" strokeWidth="2" /><circle cx={xs(p.w)} cy={ys(p.opp)} r={p.internal ? 4.5 : 3} fill={p.internal ? "#fff" : "#c8443a"} stroke="#c8443a" strokeWidth="2" /></g>)}
      <text x={pad} y={h - 4} fontSize="11" fill="#2fbf71" fontWeight="700">● You {last.you}%</text>
      <text x={pad + 110} y={h - 4} fontSize="11" fill="#c8443a" fontWeight="700">● {s.opp ? s.opp.last : "Challenger"} {last.opp}%</text>
      <text x={pad + 250} y={h - 4} fontSize="10" fill="var(--muted)">hollow dots: your internal polls (±{last.err})</text>
    </svg>
  );
}
export function Campaign({ s, setS, real, setCard, setToast }) {
  const you = S.memberById[s.youId], role = S.roleOf(s), rw = s.week - (s.termStart || 0), left = S.ELECTION_WEEK - rw, race = S.yourRace(s);
  const run = (n) => { if (n.toast && setToast) setToast(n.toast); n.toast = null; setS(n); };
  const o = s.opp, goal = S.duesGoal(you), paid = s.dues?.paid || 0, comm = S.PARTY_COMM(you.ch, you.p), ew = S.earWindow(s), ears = (s.ear || []).filter((e) => e.term === (s.term || 1));
  const bg = S.battleground(s, you.ch, you.p), leader = S.isLeader(s);
  const air = S.campPts(s), airO = S.oppPts(s);
  return (
    <div className="pm-two">
      <section className="stack">
        <h2 className="pm-h">Your race</h2>
        {!race ? <section className="panel"><p>{s.runFor ? "You're running statewide. That race is decided by statewide approval, money and the national mood." : `You're not on the ballot this Congress. ${role === "S" ? "Six-year terms buy time." : ""} You can still pay dues, help colleagues and bring money home.`}</p></section>
          : !o ? <section className="panel"><p>No opponent yet. Challengers usually file by late summer of the first year ({S.fmtDate((s.termStart || 0) + S.CAMPAIGN_START)}). Every dollar you raise now is a reason for a strong one to stay out.</p></section>
          : <section className="panel pm-opp">
            <div className="pm-opp-head">
              <Portrait id={`opp${s.seed}${o.first}${o.last}`} g={o.g} born={1972} p={o.p} size={64} />
              <div><span className="eyebrow">Your opponent · {o.p === "D" ? "Democrat" : "Republican"}</span><h3>{real && o.rname ? o.rname : `${o.first} ${o.last}`}</h3><p className="small muted">{o.bio[0].toUpperCase() + o.bio.slice(1)}. {o.q > 0.6 ? "A top recruit." : o.q > 0.3 ? "A credible challenger." : "A long shot."}</p></div>
            </div>
            <div className="pm-vs">
              <div><span className="stat-label">Your war chest</span><b>{fmtK(s.cash)}</b><small>spent {fmtK(s.camp?.spent || 0)}{s.camp?.auto ? `, ${fmtK(s.camp.auto)} by your campaign manager` : ""}</small></div>
              <div><span className="stat-label">{o.last} has raised</span><b>{fmtK(o.raised)}</b><small>{left > 10 ? "banking most of it for the fall" : "spending it all now"}</small></div>
            </div>
            <div className="pm-air"><span className="stat-label">The air war: who voters are hearing from</span>
              <div className="pm-air-bar"><i className="you" style={{ width: `${(air / Math.max(0.5, air + airO)) * 100}%` }} /><i className="opp" style={{ width: `${(airO / Math.max(0.5, air + airO)) * 100}%` }} /></div>
              <small className="muted">{air + airO < 0.6 ? "Barely anyone is on the air yet." : air > airO * 1.2 ? "You're out-communicating them." : airO > air * 1.2 ? "They're out-communicating you." : "Roughly even."}</small></div>
          </section>}
        {race && <section className="panel"><div className="pm-headrow"><h3>Polls</h3><button type="button" className="ghost" disabled={s.cash < 25} onClick={() => run(S.buyPoll(s))}>Commission an internal poll ($25K)</button></div><Polls s={s} /></section>}
        {race && o && left > 0 && <section className="panel">
          <h3>Spend your war chest</h3>
          <p className="muted small">{left} weeks to election day. Money in the bank scares off donors to your opponent, but it doesn't persuade anyone. If you don't spend, your campaign manager will buy ads on autopilot in the last ten weeks, at worse rates.</p>
          {Object.entries(S.SPEND).map(([k, d]) => <div key={k} className="pm-spend">
            <div><strong>{d.label}</strong><small className="muted">{d.note}</small></div>
            <div className="bill-actions">{[50, 100, 250, 500].map((a) => <button key={a} type="button" className="ghost" disabled={s.cash < a} onClick={() => run(S.campaignSpend(s, k, a))}>{fmtK(a)}</button>)}</div>
          </div>)}
          <div className="pm-spend"><div><strong>Ask the {comm} for help</strong><small className="muted">Party committees spend their own money in the closest races. Whether they pick yours depends on your polls, your dues and your standing with leadership.</small></div>
            <div className="bill-actions"><button type="button" className="ghost" disabled={s.hours < 2 || (s.askedHelp ?? -99) > s.week - 8} onClick={() => run(S.askForHelp(s))}>Make the call (2 hours)</button></div></div>
        </section>}
        <section className="panel">
          <h3>Bring money home: {you.ch === "S" ? "Congressionally Directed Spending" : "Community Project Funding"}</h3>
          <p className="muted small">Earmarks ride on the full-year funding bill. Members ask; appropriators decide. Majority members, appropriators and the chair's friends do best. Stopgap bills carry none.</p>
          {ew ? <>
            <p className="small">Requests for the {ew.name.toLowerCase()} are open until {S.fmtDate(ew.deadline - 3)}. You can submit {S.EAR_MAX}; each takes 2 hours of staff work.</p>
            <div className="pm-ears">{S.earOptions(s).map((e) => { const done = ears.some((x) => x.i === e.i); return <button key={e.i} type="button" className={`pm-row ${done ? "on" : ""}`} disabled={done || ears.length >= S.EAR_MAX || s.hours < 2} onClick={() => run(S.requestEarmark(s, e.i))}><span><strong>{e.name}</strong><small>{fmtK(e.amt)}{done ? " · requested" : ""}</small></span></button>; })}</div>
          </> : <p className="small">{ears.length ? "" : `The request window opens about six months before the full-year funding bill is due.`}</p>}
          {ears.length > 0 && <ul className="pm-cab-pending">{ears.map((e) => <li key={e.i}><span className={`pill ${e.status === "funded" ? "pos2" : e.status === "cut" ? "neg2" : ""}`}>{e.status}</span> {e.name}, {fmtK(e.amt)}</li>)}</ul>}
        </section>
      </section>
      <aside className="stack">
        <h2 className="pm-h">Money between politicians</h2>
        <section className="panel">
          <h3>Your {comm} dues</h3>
          {goal ? <>
            <div className="pm-money-bar"><i style={{ width: `${Math.min(100, (paid / goal) * 100)}%`, background: "#3d7bd9" }} /></div>
            <p className="small">{fmtK(paid)} of {fmtK(goal)}. Parties expect members in safe seats to pay for the ones in tough seats, and set bigger goals for leaders and members of the top committees. Leadership remembers who paid.</p>
            <div className="bill-actions">{[25, 50, 100, Math.max(0, goal - paid)].filter((a, i, arr) => a > 0 && arr.indexOf(a) === i).map((a) => <button key={a} type="button" className="ghost" disabled={s.cash < a} onClick={() => run(S.payDues(s, a))}>Pay {fmtK(a)}{a === goal - paid ? " (the rest)" : ""}</button>)}</div>
          </> : <p className="small">You're a Frontline member in a competitive seat, so the {comm} doesn't ask you for dues: your money is better spent on your own race.{paid ? ` You've given ${fmtK(paid)} anyway.` : ""}</p>}
        </section>
        <section className="panel">
          <h3>Leadership PAC</h3>
          {s.lpac ? <p className="small">{fmtK(s.lpac.cash)} on hand ({fmtK(s.lpac.raised)} raised). It can give {fmtK(10)} a cycle to a candidate: $5,000 per election.</p>
            : <><p className="small muted">A separate PAC that ambitious members use to fund colleagues and build a following. Your campaign can only give $2,000 per election; a leadership PAC can give $5,000.</p><button type="button" className="ghost" disabled={s.hours < S.LPAC_COST} onClick={() => run(S.startLpac(s))}>Start one ({S.LPAC_COST} hours)</button></>}
        </section>
        {leader && <section className="panel pm-pot"><h3>The battleground fund: {fmtK(s.pot || 0)}</h3><p className="small muted">As a party leader you steer money into the closest races. Dues refill it. Members you save, and challengers you elect, remember it.</p></section>}
        <section className="panel">
          <h3>The battleground</h3>
          <p className="small muted">The closest {you.ch === "S" ? "Senate races this cycle" : "House races"}, as of today. Green: seats your party must hold. Purple: seats you could take, with the challenger running there.</p>
          <div className="pm-bg">{bg.map(({ m, mm, mine }) => { const c = mine ? null : S.candFor({ ...s }, m.id), tgt = mine ? m.id : `cand:${m.id}`, g = (s.given || {})[tgt] || (s.given || {})[m.id];
            return <div key={m.id} className={`pm-bgrow ${mine ? "hold" : "take"}`}>
              <div><strong>{m.seat}</strong> <span className="muted small">{Math.abs(mm) < 0.5 ? "even" : `${mm > 0 ? "D" : "R"} +${Math.abs(Math.round(mm))}`}</span><br />
                <small>{mine ? <button type="button" className="linkbtn" onClick={() => setCard(m.id)}>{S.nameOf(m, real)}</button> : <>{c.first} {c.last}, {c.bio}</>}{g ? ` · you gave ${fmtK(g.amt)}` : ""}{(s.alloc || {})[m.id] ? ` · fund ${fmtK(s.alloc[m.id])}` : ""}</small></div>
              <div className="bill-actions">
                <button type="button" className="ghost sm" disabled={s.cash < 4} onClick={() => run(S.giveTo(s, tgt, "check"))} title={S.GIVE.check.note}>$4K</button>
                {s.lpac && <button type="button" className="ghost sm" disabled={s.lpac.cash < 10} onClick={() => run(S.giveTo(s, tgt, "lpac"))} title={S.GIVE.lpac.note}>PAC $10K</button>}
                <button type="button" className="ghost sm" disabled={s.hours < 6} onClick={() => run(S.giveTo(s, tgt, "event"))} title={S.GIVE.event.note}>Fundraiser (6h)</button>
                {leader && <><button type="button" className="ghost sm" disabled={(s.pot || 0) < 250} onClick={() => run(S.allocate(s, m.id, 250))}>Fund $250K</button><button type="button" className="ghost sm" disabled={(s.pot || 0) < 1000} onClick={() => run(S.allocate(s, m.id, 1000))}>Fund $1M</button></>}
              </div></div>; })}</div>
        </section>
        <p className="muted small">The rules are real: a campaign can give another candidate $2,000 per election and a leadership PAC $5,000 (FEC, 2025-26). Transfers to the party committees are unlimited. Dues goals follow the DCCC's 2026 targets.</p>
      </aside>
    </div>
  );
}

// ── The Supreme Court and the federal bench ──
export function Court({ s, real }) {
  const c = s.court; if (!c) return <p className="muted">The Court opens its term soon.</p>;
  const yr = S.dateOf(s.week).getUTCFullYear(), med = S.courtMedian(s), n = c.nom, docket = c.docket.filter((k) => !k.done).sort((a, b) => a.week - b.week);
  const bar = (x) => <div className="pm-lean"><i style={{ left: `${(x + 1) * 50}%` }} /></div>;
  return (
    <div className="pm-two">
      <section className="stack">
        <h2 className="pm-h">The Supreme Court</h2>
        <p className="muted small">The median justice decides close cases. Today that's a {med > 0.35 ? "solid conservative" : med > 0.1 ? "center-right" : med > -0.1 ? "true swing" : "liberal"} vote. Leanings are the game's rough placements.</p>
        <div className="pm-justices">{c.j.map((j) => (
          <div key={j.id} className={`pm-justice ${j.gone ? "gone" : ""} ${j.by === "D" ? "dem" : "rep"}`}>
            <Portrait id={"jus" + j.last + j.since} g={j.g} born={j.born} p={j.by} size={58} fix={j.skin != null ? { skin: j.skin } : undefined} />
            <strong>{j.gone ? "Vacant" : `${j.chief ? "Chief Justice " : ""}${real ? `${j.first} ${j.last}` : `${j.sf} ${j.sl}`}`}</strong>
            <small>{j.gone ? `Seat left by ${j.last} in ${j.left}` : `Age ${yr - j.born} · since ${j.since} · named by a ${j.by === "D" ? "Democrat" : "Republican"}`}</small>
            {!j.gone && bar(j.x)}
          </div>))}</div>
        {c.vac && <section className="panel pm-vacancy"><h3>An open seat</h3>
          {!n ? <p className="small">The President is choosing a nominee.</p>
            : <p className="small"><strong>{real ? `${n.first} ${n.last}` : `${n.sf} ${n.sl}`}</strong> {n.consensus ? "(a consensus pick)" : ""}. {n.blocked ? "The Senate majority refuses to hold hearings before the election." : `Hearings ${S.fmtDate(n.hearing)}, floor vote ${S.fmtDate(n.vote)}. Needs 51 votes.`} {n.cont > 0.6 ? "A brawl." : n.cont > 0.35 ? "A real fight." : "Confirmable."}</p>}
        </section>}
      </section>
      <aside className="stack">
        <section className="panel"><h3>On the docket</h3>
          {docket.length ? <ul className="pm-cab-pending">{docket.map((k) => <li key={k.id}><span className="pill">{S.fmtDate(k.week)}</span> {k.name}{k.real ? " (granted for real)" : ""}</li>)}</ul> : <p className="small muted">Nothing pending. Laws you pass that are open to a constitutional challenge will land here.</p>}
        </section>
        <section className="panel"><h3>Decided</h3>
          {c.decided.length ? <ul className="pm-cab-pending">{c.decided.map((k) => <li key={k.id}><span className={`pill ${k.cons ? "rep" : "dem"}`}>{k.cons ? "Conservative" : "Liberal"}</span> {k.text}</li>)}</ul> : <p className="small muted">Big decisions come down in late June.</p>}
        </section>
        <section className="panel"><h3>The lower courts</h3><p className="small"><b>{s.bench?.confirmed || 0}</b> federal judges confirmed this Congress. {S.presParty() === (S.SENATE.filter((m) => m.p === "D").length >= 51 ? "D" : "R") ? "The President's party runs the Senate, so they move quickly." : "The other party runs the Senate, so nominations crawl."} Senators decide on "blue slips" for district judges from their states.</p></section>
      </aside>
    </div>
  );
}

// ── Your own money ──
export function Earnings({ s, setS, setToast }) {
  const role = S.roleOf(s), e = s.earn || {}, ban = s.laws.includes("stock_ban"), total = S.earnTotal(s);
  const run = (n) => { if (n.toast && setToast) setToast(n.toast); n.toast = null; setS(n); };
  const rows = [["Salary", e.salary], ["Investments", e.invest], ["Book", e.book], ["Teaching", e.outside], ["Spouse", e.spouse], ["Family business", e.family], ["After office (est.)", e.after]].filter(([, v]) => Math.abs(v || 0) >= 0.5);
  return (
    <section className="panel pm-earn">
      <h3>Your own money</h3>
      <p className="pm-earn-total">{fmtK(total)} <small>earned so far</small></p>
      <div className="pm-earn-rows">{rows.map(([l, v]) => <span key={l}>{l} <b className={v < 0 ? "no" : ""}>{fmtK(v)}</b></span>)}</div>
      <p className="small muted">{role === "P" ? "The President earns $400,000 a year." : `Your salary is ${fmtK(S.salaryOf(s))} a year. Campaign money is not yours: spending it on yourself is a crime. Members can't take speaking fees, and other outside earned income is capped at $33,855 a year. Book royalties are the big exception.`}</p>
      {(role === "H" || role === "S") && <>
        <h4>Your portfolio: {fmtK(s.port || 0)}</h4>
        <div className="pm-trade">{Object.entries(S.TRADE).map(([k, t]) => { const off = ban && (k === "active" || k === "informed"); return <button key={k} type="button" className={`ghost sm ${s.trade === k ? "on" : ""} ${k === "informed" ? "danger" : ""}`} disabled={off} onClick={() => run(S.setMoney(s, "trade", k))}>{t.label}</button>; })}</div>
        <p className="small muted">{ban ? "The stock trading ban is law: no individual stocks." : s.trade === "informed" ? "Members can legally own and trade stocks, but not on nonpublic information. Trackers watch every disclosure. The returns are real; so is the risk of a story, or worse." : "Members can trade stocks if they disclose within 45 days. Most trade a little; a few trade a lot."}</p>
        <h4>Ways to earn</h4>
        <div className="pm-earnopts">
          <div><strong>Write a book</strong><small>Royalties from an established publisher are exempt from the cap. Needs a national profile (25+). 10 hours.</small>
            {s.book?.term === (s.term || 1) ? <><span className="pill pos2">Advance {fmtK(s.book.adv)}</span><button type="button" className="ghost sm danger" disabled={s.cash < 100} onClick={() => run(S.bookDeal(s, true))} title="Legal and common. Frowned on.">Have your campaign buy copies ($100K)</button></> : <button type="button" className="ghost sm" disabled={s.profile < 25 || s.hours < 10} onClick={() => run(S.bookDeal(s))}>Sign a book deal</button>}</div>
          <div><strong>Teach a class</strong><small>Allowed, up to the $33,855 cap. Costs 3 hours a week.</small><button type="button" className={`ghost sm ${s.teach ? "on" : ""}`} onClick={() => run(S.setMoney(s, "teach", !s.teach))}>{s.teach ? "Teaching (stop)" : "Start teaching"}</button></div>
          <div><strong>Put your spouse on the campaign payroll</strong><small>Legal if it's real work at a fair rate. It moves donors' money into your household, and reporters check.</small><button type="button" className={`ghost sm danger ${s.spousePay ? "on" : ""}`} onClick={() => run(S.setMoney(s, "spousePay", !s.spousePay))}>{s.spousePay ? "On the payroll (stop)" : "Hire them"}</button></div>
          <div><strong>Your spouse's consulting firm takes lobbying clients</strong><small>No law clearly bars it. Companies with business before your committee would love to hire them.</small><button type="button" className={`ghost sm danger ${s.spouseConsult ? "on" : ""}`} onClick={() => run(S.setMoney(s, "spouseConsult", !s.spouseConsult))}>{s.spouseConsult ? "Taking clients (stop)" : "Let them"}</button></div>
        </div></>}
      {role === "P" && <div className="pm-earnopts"><div><strong>Let the family business take foreign deals</strong><small>Presidents are exempt from most conflict-of-interest law. The emoluments clause isn't, and the press is watching.</small><button type="button" className={`ghost sm danger ${s.family ? "on" : ""}`} onClick={() => run(S.setMoney(s, "family", !s.family))}>{s.family ? "Deals on (stop)" : "Allow it"}</button></div></div>}
    </section>
  );
}
export function AfterOffice({ s, setS }) {
  const paths = S.afterPaths(s);
  return (
    <section className="panel pm-after"><h3>After Washington</h3>
      <p className="small muted">What will the next ten years be worth? Rough estimates, added to your lifetime earnings and the hall of fame. Former members face a lobbying ban of one year (House) or two (Senate).</p>
      <div className="pm-earnopts">{paths.map(([k, l, v]) => <button key={k} type="button" className={`pm-row ${s.afterPath === l ? "on" : ""}`} onClick={() => setS(S.chooseAfter(s, k))}><span><strong>{l}</strong><small>about {fmtK(v)} over ten years</small></span></button>)}</div>
      <p className="small">Lifetime earnings: <b>{fmtK(S.earnTotal(s))}</b></p>
    </section>
  );
}

// ── Your race on election night: precincts report, the lead swings, then the call ──
export function RaceNight({ s, real }) {
  const r = s.result, you = S.memberById[s.youId];
  const calm = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  const [pct, setPct] = useState(calm ? 100 : 0), [run, setRun] = useState(0);
  React.useEffect(() => { if (calm) return; setPct(0); let p = 0; const t = setInterval(() => { p = Math.min(100, p + 1 + Math.random() * 3); setPct(p); if (p >= 100) clearInterval(t); }, 90); return () => clearInterval(t); }, [run]);
  if (!r || (r.kind !== "general" && r.kind !== "higher" && r.kind !== "primary") || r.margin == null) return null;
  // Early returns wander (mail ballots, then election-day votes, then the late count) and settle on the real margin.
  const h = (k) => { let x = 0; for (const c of `${s.seed}${k}`) x = (x * 31 + c.charCodeAt(0)) % 9973; return x / 9973 - 0.5; };
  const wander = (1 - pct / 100) ** 1.4 * (14 * h("a") + 8 * Math.sin(pct / 9 + h("b") * 6));
  const m = r.margin + wander, mine = Math.max(1, Math.min(99, 50 + m / 2));
  const prim = r.kind === "primary", oppName = prim ? (real ? r.oppR : r.opp) || "The challenger" : real && s.opp?.rname ? s.opp.rname : r.opp?.name || (s.opp ? `${s.opp.first} ${s.opp.last}` : "Your opponent"), called = pct >= 100 || (pct > 70 && Math.abs(r.margin) > 12) || (pct > 88 && Math.abs(r.margin) > 4);
  const votes = Math.round((you.ch === "S" || r.kind === "higher" ? 3200000 : 330000) * (prim ? 0.22 : 1) * pct / 100);
  return (
    <section className="pm-race">
      <div className="pm-race-head"><span className="rc-live"><i className="live-dot" /> {prim ? `${you.p === "D" ? "Democratic" : "Republican"} primary · ${you.ch === "S" ? you.st : you.seat}` : r.kind === "higher" ? `U.S. Senate · ${you.st}` : you.seat}</span><span className="muted small">{Math.floor(pct)}% reporting · {votes.toLocaleString()} votes counted</span><button type="button" className="linkbtn" onClick={() => setRun((x) => x + 1)}>Replay</button></div>
      <div className="pm-race-row you"><span>{S.nameOf(you, real)} ({you.p})</span><div className="pm-race-bar"><i style={{ width: `${mine}%` }} /></div><b>{mine.toFixed(1)}%</b></div>
      <div className="pm-race-row opp"><span>{oppName} ({prim ? you.p : you.p === "D" ? "R" : "D"})</span><div className="pm-race-bar"><i style={{ width: `${100 - mine}%` }} /></div><b>{(100 - mine).toFixed(1)}%</b></div>
      <p className={`pm-race-call ${called ? (r.won ? "ok" : "no") : ""}`}>{called ? `PROJECTED WINNER: ${r.won ? S.nameOf(you, real) : oppName}` : pct < 30 ? "Too early to call" : "Too close to call"}</p>
    </section>
  );
}

// ── Donors, PACs, movement groups and the people from abroad ──
const KINDS = [["donor", "Megadonors", "One person, one checkbook, and a super PAC that does what they want."], ["pac", "PACs and industries", "Checks for your campaign, bundles from executives, and a lobbyist who calls before votes."],
  ["org", "Movement groups", "Endorsements, volunteers, audiences and pressure. Little money, a lot of energy."], ["foreign", "Influence from abroad", "Foreign nationals can't legally give to U.S. campaigns. They try anyway. They come to you; you don't call them."]];
function Meter2({ v, label }) { const pct = (v + 1) * 50; return <div className="pm-m2" title={`${label}: ${v.toFixed(2)}`}><span>{label}</span><i><b style={{ left: `${pct}%`, background: v > 0.2 ? "#2f8f4e" : v < -0.2 ? "#b3261e" : "#9a8f78" }} /></i></div>; }
export function Donors({ s, setS, real, setToast }) {
  const rows = S.orgRows(s), you = S.memberById[s.youId];
  const run = (n) => { if (n.toast && setToast) setToast(n.toast); n.toast = null; setS(n); };
  if (S.roleOf(s) === "P") return <p className="muted">Donors and groups come to members of Congress. As President, they come through your party.</p>;
  const total = rows.reduce((a, r) => a + (r.st.given || 0), 0);
  return (
    <div className="stack">
      <h2 className="pm-h">Donors and groups</h2>
      <p className="muted">Everyone with money or an army wants something from you. Meet them, take their support, or keep your distance. Taking it moves your votes toward theirs, and your opponents keep track. {total ? `So far they've put about ${fmtK(total)} into your races.` : ""}</p>
      {KINDS.map(([k, title, blurb]) => (
        <section key={k} className={`pm-orgs ${k}`}>
          <h3>{title}</h3><p className="small muted">{blurb}</p>
          <div className="pm-orggrid">{rows.filter((r) => r.o.kind === k && !(r.o.id === "emily" && you.g !== "F")).sort((a, b) => b.fit - a.fit).map(({ o, st, fit }) => {
            const cares = Object.entries(o.cares || S.groupById[o.gid]?.cares || {}).slice(0, 4);
            const off = o.party !== "any" && o.party !== you.p;
            return (
              <article key={o.id} className={`pm-org ${off ? "off" : ""}`}>
                <header><strong>{S.orgName(o, real)}</strong>{o.party !== "any" && <span className={`pill ${o.party === "D" ? "dem" : "rep"}`}>{o.party === "D" ? "Democrats" : "Republicans"}</span>}{st.endorsed && <span className="pill pos2">Endorsed you</span>}</header>
                <p className="small">{o.note}</p>
                {cares.length > 0 && <p className="small pm-cares">{cares.map(([pid, v]) => <span key={pid} className={v > 0 ? "for" : "against"}>{v > 0 ? "For" : "Against"}: {S.byId[pid]?.name}</span>)}</p>}
                {k !== "foreign" && <><Meter2 v={fit} label="How well you fit" /><Meter2 v={st.rel || 0} label="Relationship" /></>}
                <p className="small muted">{st.met ? `Met ${Math.ceil(st.met)} time${st.met > 1 ? "s" : ""}. ` : ""}{st.given ? `Has spent ${fmtK(st.given)} for you.` : k === "foreign" ? "" : "No money yet."}</p>
                {k !== "foreign" && <div className="bill-actions">
                  <button type="button" className="ghost sm" disabled={s.hours < 3} onClick={() => run(S.orgAction(s, o.id, "meet"))}>Request a meeting (3h)</button>
                  {!off && <button type="button" className="ghost sm" disabled={s.hours < 2} onClick={() => run(S.orgAction(s, o.id, "ask"))}>{o.kind === "org" ? "Ask for an endorsement (2h)" : "Ask for support (2h)"}</button>}
                  {(st.given > 0 || st.endorsed) && <button type="button" className="ghost sm danger" onClick={() => run(S.orgAction(s, o.id, "cut"))}>Cut ties</button>}
                </div>}
              </article>); })}</div>
        </section>))}
      <p className="muted small">With real names on, groups show as the real organizations and people. Their positions and public records are real; everything they say and do in the game is invented. Foreign influence is shown generically: it's about the law, not any one country.</p>
    </div>
  );
}

// ── Governor: your state at a glance ──
export function GovPanel({ s, real }) {
  const G = s.govCareer; if (!G) return null;
  const st = G.st, g = s.govs?.[st], others = Object.values(s.govs || {}), d = others.filter((x) => x.p === "D").length;
  const sens = S.SENATE.filter((m) => m.st === st), lean = S.LEAN[st] ?? 0;
  return (
    <div className="stack">
      <h2 className="pm-h">Governing {S.STATE_NAME[st]}</h2>
      <section className="panel">
        <div className="pm-gov-grid">
          <div><span className="stat-label">Term</span><b>{G.terms}{g?.tl ? " (last)" : ""}</b><small>{g?.tl ? "term-limited" : `next election ${g?.next}`}</small></div>
          <div><span className="stat-label">State lean</span><b>{lean >= 0 ? "D" : "R"}+{Math.abs(lean).toFixed(0)}</b><small>vs. the nation, after 2026</small></div>
          <div><span className="stat-label">Budgets passed</span><b>{G.budgets}</b><small>{G.disasters} disasters handled</small></div>
          <div><span className="stat-label">Lawsuits vs. Washington</span><b>{G.suits}</b><small>{S.presParty() === s.govCareer.me.p ? "your party holds the White House" : "the other party holds the White House"}</small></div>
          <div><span className="stat-label">Medicaid</span><b>{G.medicaid ? "Expanded" : "Not expanded"}</b><small>legacy score {G.legacy}</small></div>
          <div><span className="stat-label">Governors</span><b>{d} D · {others.length - d} R</b><small>nationwide</small></div>
        </div>
        <p className="small muted">Your senators: {sens.map((m) => `${S.nameOf(m, real)} (${m.p})`).join(" and ")}. If either seat opens, you name the replacement.</p>
      </section>
    </div>
  );
}

// ── Your record: achievements, the offices you've held, and the moments that defined your career ──
export function Record({ s, real }) {
  const A = S.achievements(s), got = A.filter((a) => a.week != null), you = S.memberById[s.youId];
  const laws = (s.lawsMine || 0) + s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law").length;
  const lawList = s.bills.filter((b) => b.sponsor === s.youId && b.stage === "law");
  return (
    <div className="stack">
      <h2 className="pm-h">Your record</h2>
      <section className="panel pm-gov-grid">
        <div><span className="stat-label">Achievements</span><b>{got.length} / {A.length}</b><small>unlocked</small></div>
        <div><span className="stat-label">Laws you wrote</span><b>{laws}</b><small>across your career</small></div>
        <div><span className="stat-label">Votes cast</span><b>{s.votesCast.length}</b><small>{s.votesCast.filter((v) => !v.partyLine).length} against your party</small></div>
        <div><span className="stat-label">Terms completed</span><b>{(s.career || []).length}</b><small>{(s.career || []).map((c) => c.year).join(", ") || "first term"}</small></div>
        <div><span className="stat-label">Lifetime earnings</span><b>${Math.round(S.earnTotal(s)).toLocaleString()}K</b><small>salary, investments and more</small></div>
        <div><span className="stat-label">Integrity</span><b>{Math.round(s.integrity)}</b><small>{s.integrity >= 80 ? "a reputation for straight dealing" : s.integrity >= 55 ? "about average for Washington" : "people check their wallets"}</small></div>
      </section>
      <section className="panel"><h3>Achievements</h3>
        <ul className="pm-ach">{A.map((a) => <li key={a.id} className={a.week != null ? "got" : ""}><b>{a.week != null ? "★" : "☆"} {a.title}</b><small>{a.desc}{a.week != null ? ` · ${S.fmtDate(a.week)}` : ""}</small></li>)}</ul>
      </section>
      {(s.career || []).length > 0 && <section className="panel"><h3>Career</h3><ol className="pm-cal">{s.career.map((c, i) => <li key={i}><b>{c.year}</b> {({ H: "House", S: "Senate", P: "President", C: "Cabinet", G: "Governor" })[c.role] || ""} · {({ general: "re-elected", term: "term completed", higher: "won a Senate seat", pres: "won the presidency", gov: "won the governorship", cabinet: "served in the Cabinet", governor: "governed", midterm: "midterms" })[c.kind] || c.kind}{c.margin != null ? ` (${c.margin > 0 ? "+" : ""}${c.margin})` : ""}{c.laws ? ` · ${c.laws} law${c.laws === 1 ? "" : "s"}` : ""}</li>)}</ol></section>}
      {lawList.length > 0 && <section className="panel"><h3>Your laws this Congress</h3><ul className="small">{lawList.map((b) => <li key={b.id}>{S.byId[b.pid].name}</li>)}</ul></section>}
      <section className="panel"><h3>Moments</h3>{(s.moments || []).length ? <ul className="small pm-moments">{[...s.moments].reverse().slice(0, 40).map((m, i) => <li key={i}><small>{S.fmtDate(m.week)}</small> {m.text}</li>)}</ul> : <p className="muted small">Nothing yet. Make some news.</p>}</section>
    </div>
  );
}
