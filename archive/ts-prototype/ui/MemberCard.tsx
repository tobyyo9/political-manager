import type { Member, MemberVote } from "../engine/types";
import { STATE_NAMES, seat, partyWord, initials, ideoColor, TRAIT, safety } from "./common";

// A Crusader Kings style character card: who they are, where they stand, what moves them.
export default function MemberCard({ m, real, vote, onClose }: { m: Member; real: boolean; vote?: MemberVote; onClose?: () => void }) {
  const name = real ? m.name : m.alias;
  const [safeLabel, safeCls] = safety(m);
  const pos = ((m.dim1 + 1) / 2) * 100;
  return (
    <aside className="card" aria-label={name}>
      {onClose && <button type="button" className="card-x" onClick={onClose} aria-label="Close">×</button>}
      <header className="card-head">
        <span className="portrait" style={{ background: ideoColor(m) }}>{initials(name)}</span>
        <div>
          <h3>{name}</h3>
          <p className="card-sub"><b className={m.party === "D" ? "dem" : "rep"}>{partyWord(m.party)}</b> · {STATE_NAMES[m.state] || m.state} · {seat(m)}</p>
          <p className="card-sub">In the House since {m.since} · {m.terms} {m.terms === 1 ? "term" : "terms"}</p>
        </div>
      </header>

      {vote && (
        <section className={`card-vote ${vote.yes ? "yea" : "nay"}`}>
          <div className="cv-top"><strong>{vote.yes ? "Voted yes" : "Voted no"}</strong><span>{Math.round(vote.p * 100)}% chance of yes going in{vote.crossed ? " · broke with the party" : ""}</span></div>
          <ul className="pressures">
            {vote.pressures.slice(0, 6).map((p) => (
              <li key={p.label}><span>{p.label}</span><span className="pbar"><i className={p.value > 0 ? "up" : "down"} style={{ width: `${Math.min(100, Math.abs(p.value) * 22)}%` }} /></span><b className={p.value > 0 ? "up" : "down"}>{p.value > 0 ? "+" : "−"}{Math.abs(p.value).toFixed(1)}</b></li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4>Where they stand <small>from their real voting record</small></h4>
        <div className="ideo"><span className="ideo-track" /><i style={{ left: `${pos}%`, background: ideoColor(m) }} /><span className="ideo-l">Left</span><span className="ideo-r">Right</span></div>
        <dl className="facts">
          <div><dt>Votes with their party</dt><dd>{m.unity == null ? "n/a" : `${Math.round(m.unity * 100)}%`}</dd></div>
          <div><dt>District in 2024</dt><dd>{m.presD == null ? "n/a" : m.presR! > m.presD ? `Trump +${(m.presR! - m.presD).toFixed(0)}` : `Harris +${(m.presD - m.presR!).toFixed(0)}`}</dd></div>
          <div><dt>Seat</dt><dd className={safeCls}>{safeLabel}</dd></div>
        </dl>
      </section>

      <section>
        <h4>Character <small>invented for the game</small></h4>
        <div className="chips">{m.traits.map((t) => <span key={t} className="chip" title={TRAIT[t]?.[1]}>{TRAIT[t]?.[0] || t}</span>)}</div>
        <div className="bars">
          {([["Ambition", m.ambition], ["Ethics", m.ethics], ["Media skill", m.media]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="bar"><span>{l}</span><span className="bar-t"><i style={{ width: `${v * 100}%` }} /></span></div>
          ))}
        </div>
        <p className="fine">In the full game these start hidden and are revealed as you get to know them.</p>
      </section>
    </aside>
  );
}
