import * as S from "SIM";
// Real 2025-26 roll calls: party crossover rates. own = sponsor's party members voting yes; cross = other party voting yes.
export const BENCH = [
  ["SAVE Act (House, Apr 2025)", "save_act", "R", "H", null, { own: 1.0, cross: 4 / 212 }],
  ["Canada tariffs (House, Feb 2026)", "tariff_repeal", "D", "H", null, { own: 1 - 1 / 213, cross: 6 / 218 }],
  ["Canada tariffs (Senate, Apr 2025)", "tariff_repeal", "D", "S", null, { own: 1.0, cross: 4 / 53 }],
  ["ACA subsidies (House, Jan 2026)", "aca", "D", "H", null, { own: 1.0, cross: 17 / 218 }],
  ["Iran war powers (Senate, Jun 2025)", "war_powers", "D", "S", null, { own: 46 / 47, cross: 1 / 53 }],
  ["Rescissions (House, Jun 2025)", "foreign_aid", "R", "H", null, { own: 1 - 4 / 218, cross: 0 }],
  ["Big bill: Medicaid cap (House, Jul 2025)", "medicaid_cap", "R", "H", "reconciliation", { own: 1 - 2 / 220, cross: 0 }],
  ["Big bill: Medicaid cap (Senate, Jul 2025)", "medicaid_cap", "R", "S", "reconciliation", { own: 1 - 3 / 53, cross: 0 }],
];
export function run(seeds = 12) {
  let err = 0; const rows = [];
  for (const [name, pid, sp, ch, route, real] of BENCH) {
    let own = 0, cross = 0, nO = 0, nC = 0;
    for (let seed = 1; seed <= seeds; seed++) { const rc = S.rollCall(ch, pid, { sponsor: sp, kind: "passage", route, seed: seed * 7919, deals: {}, boost: {}, trust: {} });
      for (const m of (ch === "H" ? S.HOUSE : S.SENATE)) { if (m.p === sp) { nO++; own += rc.votes[m.id] ? 1 : 0; } else { nC++; cross += rc.votes[m.id] ? 1 : 0; } } }
    const o = own / nO, c = cross / nC; err += (o - real.own) ** 2 + (c - real.cross) ** 2;
    rows.push(`${name.padEnd(42)} own yes ${(o * 100).toFixed(1)}% (real ${(real.own * 100).toFixed(1)}%)   other party yes ${(c * 100).toFixed(1)}% (real ${(real.cross * 100).toFixed(1)}%)`);
  }
  return { err, rows };
}
if (true) { const r = run(); console.log(r.rows.join("\n")); console.log("error", r.err.toFixed(4)); }
