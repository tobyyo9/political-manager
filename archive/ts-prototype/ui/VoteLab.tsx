import type { Bill, Member, RollCallResult, Stance } from "../engine/types";
import { rollCall, leanings, needFor } from "../engine/vote";
import { rng } from "../engine/rng";
import { BILLS } from "../engine/bills";
import { arcSeats, seat } from "./common";
import MemberCard from "./MemberCard";

const { useState, useMemo, useEffect, useRef } = React;
const MS = 3200;

function StanceToggle({ label, value, onChange, words }: { label: string; value: Stance; onChange: (s: Stance) => void; words: [string, string, string] }) {
  return (
    <div className="stance"><span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {([-1, 0, 1] as Stance[]).map((s, i) => <button key={s} type="button" className={value === s ? "on" : ""} aria-pressed={value === s} onClick={() => onChange(s)}>{words[i]}</button>)}
      </div>
    </div>
  );
}

export default function VoteLab({ members, real }: { members: Member[]; real: boolean }) {
  const [billId, setBillId] = useState(BILLS[0].id);
  const [over, setOver] = useState<Partial<Bill>>({});
  const [res, setRes] = useState<RollCallResult | null>(null);
  const [k, setK] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const seed = useRef(1);
  const bill = useMemo(() => ({ ...BILLS.find((b) => b.id === billId)!, ...over }) as Bill, [billId, over]);
  const byIdeo = useMemo(() => [...members].sort((a, b) => a.dim1 - b.dim1), [members]);
  const { seats, dotR } = useMemo(() => arcSeats(members.length), [members.length]);
  const forecast = useMemo(() => {
    const ls = leanings(members, bill);
    const exp = ls.reduce((a, l) => a + l.p, 0);
    const sdv = Math.sqrt(ls.reduce((a, l) => a + l.p * (1 - l.p), 0));
    return { lo: Math.round(exp - 2 * sdv), hi: Math.round(exp + 2 * sdv), unsure: ls.filter((l) => l.p > 0.25 && l.p < 0.75).length };
  }, [members, bill]);
  const need = needFor(bill, members.length);

  // Reveal seats in a shuffled order while the roll is called.
  const order = useMemo(() => { const r = rng(seed.current * 7 + 3); const o = members.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } const rank = new Array(o.length); o.forEach((x, n) => (rank[x] = n)); return rank; }, [res]);
  useEffect(() => {
    if (!res) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const x = Math.min(1, (t - t0) / MS); setK(x); if (x < 1) raf = requestAnimationFrame(tick); };
    setK(0); raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [res]);

  const call = () => { seed.current = Math.floor(Math.random() * 1e9); setSel(null); setRes(rollCall(members, bill, rng(seed.current))); };
  const pick = (id: string) => { setBillId(id); setOver({}); setRes(null); setSel(null); };
  const voteOf = (id: string) => res?.votes.find((v) => v.id === id);
  const shown = Math.floor(k * members.length);
  let yea = 0, nay = 0;
  if (res) byIdeo.forEach((m, i) => { if (order[i] < shown) (voteOf(m.id)!.yes ? yea++ : nay++); });
  const done = !!res && k >= 1;
  const crossed = done ? res!.votes.filter((v) => v.crossed).map((v) => ({ v, m: members.find((m) => m.id === v.id)! })).sort((a, b) => a.v.p - b.v.p) : [];
  const nm = (m: Member) => (real ? m.name : m.alias);
  const picked = sel ? members.find((m) => m.id === sel)! : null;

  return (
    <div className="lab">
      <section className="panel">
        <span className="kicker dk">Pick a bill</span>
        <div className="bills">
          {BILLS.map((b) => <button key={b.id} type="button" className={`billc ${b.id === billId ? "on" : ""}`} onClick={() => pick(b.id)}><strong>{b.title}</strong><span>{b.blurb}</span></button>)}
        </div>
        <div className="stances">
          <StanceToggle label="Democratic leaders" value={bill.lead.D} onChange={(s) => { setOver({ ...over, lead: { ...bill.lead, D: s } }); setRes(null); }} words={["Whip against", "Free vote", "Whip for"]} />
          <StanceToggle label="Republican leaders" value={bill.lead.R} onChange={(s) => { setOver({ ...over, lead: { ...bill.lead, R: s } }); setRes(null); }} words={["Whip against", "Free vote", "Whip for"]} />
          <StanceToggle label="The President" value={bill.president} onChange={(s) => { setOver({ ...over, president: s }); setRes(null); }} words={["Opposes", "Silent", "Supports"]} />
        </div>
      </section>

      <section className="panel dark floor">
        <div className="floor-top">
          <div><span className="kicker"><i className="live" /> {bill.kind === "override" ? "Veto override" : "On the floor"}</span><h2>{bill.title}</h2></div>
          <div className="whip"><span>Your whip count</span><b>{forecast.lo} to {forecast.hi} yes</b><small>{need} needed · {forecast.unsure} members too close to call</small></div>
        </div>
        <svg viewBox="-1.08 -1.06 2.16 1.12" className="chamber" role="img" aria-label="Roll call">
          {byIdeo.map((m, i) => {
            const v = res ? voteOf(m.id)! : null; const on = !!v && order[i] < shown;
            return <circle key={m.id} cx={seats[i].x} cy={-seats[i].y} r={dotR} className={`vs ${m.party === "D" ? "d" : "r"} ${on ? (v!.yes ? "yea" : "nay") : ""} ${on && v!.crossed ? "x" : ""} ${sel === m.id ? "on" : ""}`} onClick={() => done && setSel(m.id)}><title>{nm(m)} · {seat(m)}</title></circle>;
          })}
        </svg>
        <div className="tally">
          <span className="yea">YEA <b>{res ? yea : "–"}</b></span>
          <span className="tbar"><i style={{ width: `${(yea / members.length) * 100}%` }} /><em style={{ left: `${(need / members.length) * 100}%` }} /></span>
          <span className="nay">NAY <b>{res ? nay : "–"}</b></span>
        </div>
        {done && <div className={`verdict ${res!.passed ? "ok" : "no"}`}><span className="stamp">{res!.passed ? (bill.kind === "override" ? "OVERRIDDEN" : "PASSED") : (bill.kind === "override" ? "VETO SUSTAINED" : "FAILED")}</span><p>{res!.yes} to {res!.no}. Democrats {res!.byParty.D.yes}–{res!.byParty.D.no}, Republicans {res!.byParty.R.yes}–{res!.byParty.R.no}. {crossed.length} {crossed.length === 1 ? "member" : "members"} broke with their party.</p></div>}
        <div className="floor-actions">
          <button type="button" className="go" onClick={call}>{res ? "Call the roll again" : "Call the roll →"}</button>
          {res && !done && <button type="button" className="alt" onClick={() => setK(1)}>Skip</button>}
        </div>
        <p className="fine light">Every vote is a probability, so the same bill can land differently each time. Seats with a gold ring broke with their party.</p>
      </section>

      {done && (
        <div className="roster-cols">
          <section className="panel">
            <h3>Who broke ranks, and why</h3>
            {crossed.length === 0 && <p className="muted">Nobody. A pure party-line vote.</p>}
            <ul className="mlist">
              {crossed.slice(0, 40).map(({ v, m }) => (
                <li key={m.id}><button type="button" className={sel === m.id ? "on" : ""} onClick={() => setSel(m.id)}>
                  <i className={`dot ${m.party === "D" ? "dbg" : "rbg"}`} />
                  <span className="ml-name">{nm(m)}</span><span className="ml-seat">{seat(m)}</span>
                  <span className={`ml-safe ${v.yes ? "safe" : "bad"}`}>{v.yes ? "Yes" : "No"}</span>
                  <span className="ml-why">{v.pressures.find((p) => (p.value > 0) === v.yes)?.label || ""}</span>
                </button></li>
              ))}
            </ul>
          </section>
          <div className="card-slot">{picked ? <MemberCard m={picked} real={real} vote={voteOf(picked.id)} onClose={() => setSel(null)} /> : <div className="card empty"><p>Tap any seat or name to see what pushed that member's vote.</p></div>}</div>
        </div>
      )}
    </div>
  );
}
