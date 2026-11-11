import type { Member } from "../engine/types";
import { arcSeats, ideoColor, seat, safety } from "./common";
import MemberCard from "./MemberCard";

const { useState, useMemo } = React;

export default function Roster({ members, real }: { members: Member[]; real: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [party, setParty] = useState("all");
  const [sort, setSort] = useState("ideology");
  const { seats, dotR } = useMemo(() => arcSeats(members.length), [members.length]);
  const byIdeo = useMemo(() => [...members].sort((a, b) => a.dim1 - b.dim1), [members]);
  const picked = members.find((m) => m.id === sel) || null;
  const nm = (m: Member) => (real ? m.name : m.alias);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = members.filter((m) => (party === "all" || m.party === party) && (!s || nm(m).toLowerCase().includes(s) || seat(m).toLowerCase().includes(s)));
    if (sort === "ideology") l = [...l].sort((a, b) => a.dim1 - b.dim1);
    if (sort === "name") l = [...l].sort((a, b) => nm(a).localeCompare(nm(b)));
    if (sort === "seat") l = [...l].sort((a, b) => (a.ownLean ?? 99) - (b.ownLean ?? 99));
    if (sort === "loyal") l = [...l].sort((a, b) => (a.unity ?? 1) - (b.unity ?? 1));
    if (sort === "senior") l = [...l].sort((a, b) => a.since - b.since);
    return l;
  }, [members, q, party, sort, real]);
  const D = members.filter((m) => m.party === "D").length, R = members.filter((m) => m.party === "R").length;

  return (
    <div className="roster">
      <section className="panel dark">
        <div className="panel-top"><div><span className="kicker">The House · every seat is a character</span><h2><b className="dem-l">{D}</b> Democrats · <b className="rep-l">{R}</b> Republicans</h2></div><p>Seats run left to right by real voting record. Tap one to open its card.</p></div>
        <svg viewBox="-1.08 -1.06 2.16 1.12" className="chamber" role="img" aria-label="House seats by ideology">
          {byIdeo.map((m, i) => (
            <circle key={m.id} cx={seats[i].x} cy={-seats[i].y} r={dotR} fill={ideoColor(m)} className={`cs ${sel === m.id ? "on" : ""}`} onClick={() => setSel(m.id)}>
              <title>{nm(m)} · {seat(m)}</title>
            </circle>
          ))}
        </svg>
      </section>

      <div className="roster-cols">
        <section className="panel">
          <div className="tools">
            <input type="search" placeholder="Search a name or seat (TX-02)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
            <select value={party} onChange={(e) => setParty(e.target.value)} aria-label="Party"><option value="all">Both parties</option><option value="D">Democrats</option><option value="R">Republicans</option></select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="ideology">Left to right</option><option value="name">Name</option><option value="seat">Most at-risk seats</option><option value="loyal">Least loyal to party</option><option value="senior">Most senior</option></select>
          </div>
          <ul className="mlist">
            {list.slice(0, 80).map((m) => {
              const [sl, sc] = safety(m);
              return (
                <li key={m.id}><button type="button" className={sel === m.id ? "on" : ""} onClick={() => setSel(m.id)}>
                  <i className="dot" style={{ background: ideoColor(m) }} />
                  <span className="ml-name">{nm(m)}</span>
                  <span className="ml-seat">{seat(m)}</span>
                  <span className={`ml-safe ${sc}`}>{sl}</span>
                  <span className="ml-unity">{m.unity == null ? "" : `${Math.round(m.unity * 100)}%`}</span>
                </button></li>
              );
            })}
          </ul>
          {list.length > 80 && <p className="fine">Showing 80 of {list.length}. Search or filter to narrow.</p>}
        </section>
        <div className="card-slot">{picked ? <MemberCard m={picked} real={real} onClose={() => setSel(null)} /> : <div className="card empty"><p>Pick a seat or a name to open a character card.</p></div>}</div>
      </div>
    </div>
  );
}
