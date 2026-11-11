// Turning the week: a pixel Capitol under a sky that runs from dusk to dawn, a calendar page flipping,
// and the new week's first headlines. About two seconds; click to skip.
const { useEffect } = React;
// The Capitol in pixels, on a 64 x 40 grid.
const P = [
  // ground and steps
  ["#2d3b2a", 0, 36, 64, 4], ["#cfc9b8", 10, 34, 44, 2], ["#e6e1d3", 12, 33, 40, 1],
  // wings
  ["#efeadc", 4, 27, 18, 7], ["#efeadc", 42, 27, 18, 7], ["#d8d2c1", 4, 26, 18, 1], ["#d8d2c1", 42, 26, 18, 1],
  // center block and portico
  ["#f6f2e6", 22, 25, 20, 9], ["#d8d2c1", 21, 24, 22, 1], ["#e6e1d3", 26, 22, 12, 2],
  // drum and colonnade
  ["#f6f2e6", 25, 17, 14, 5], ["#d8d2c1", 24, 21, 16, 1], ["#d8d2c1", 24, 16, 16, 1],
  // dome
  ["#f6f2e6", 26, 13, 12, 3], ["#f6f2e6", 27, 11, 10, 2], ["#f6f2e6", 28, 9, 8, 2], ["#f6f2e6", 30, 8, 4, 1],
  // lantern and statue
  ["#e6e1d3", 31, 5, 2, 3], ["#c9a24a", 31, 3, 2, 2], ["#c9a24a", 31.5, 2, 1, 1],
];
const COLS = [6, 9, 12, 15, 18, 45, 48, 51, 54, 57, 24, 27, 30, 33, 36, 39], WIN = [7, 10, 13, 16, 19, 44, 47, 50, 53, 56];
export function Capitol({ lit = true }) {
  return (
    <svg viewBox="0 0 64 40" shapeRendering="crispEdges" className="wk-cap" aria-hidden="true">
      {P.map(([c, x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}
      {COLS.map((x) => <rect key={"c" + x} x={x} y={x > 23 && x < 41 ? 26 : 28} width="1" height={x > 23 && x < 41 ? 7 : 6} fill="#cfc9b8" />)}
      {[26, 28, 30, 32, 34, 36].map((x) => <rect key={"d" + x} x={x + 0.5} y="18" width="1" height="3" fill="#cfc9b8" />)}
      {WIN.map((x) => <rect key={"w" + x} x={x} y="30" width="1" height="2" className={lit ? "wk-win" : ""} fill="#3a4766" />)}
      <rect x="31" y="13" width="2" height="2" className={lit ? "wk-win" : ""} fill="#3a4766" />
    </svg>
  );
}
export default function WeekTurn({ turn, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, turn.alert ? 3200 : 2300); return () => clearTimeout(t); }, [turn]);
  return (
    <div className={`wk-back ${turn.alert ? "alert" : ""}`} onClick={onDone} role="presentation">
      <div className="wk-sky"><i className="wk-sun" /><i className="wk-moon" />{Array.from({ length: 14 }, (_, i) => <i key={i} className="wk-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 55}%`, animationDelay: `${0.5 + (i % 5) * 0.08}s` }} />)}</div>
      <div className="wk-top">
        <div className="wk-cal"><div className="wk-page old">{turn.from}</div><div className="wk-page new">{turn.to}</div></div>
        {turn.alert && <div className="wk-alert">BREAKING · {turn.alert}</div>}
        {turn.heads.length > 0 && <ul className="wk-heads">{turn.heads.map((h, i) => <li key={i} style={{ animationDelay: `${0.7 + i * 0.25}s` }}>{h}</li>)}</ul>}
      </div>
      <div className="wk-ground" />
      <Capitol />
      <span className="wk-skip">click to skip</span>
    </div>
  );
}
