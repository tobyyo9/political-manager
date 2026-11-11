// Pixel-art sets for scenes: a 160 x 75 grid, a few colors each, with small looping animations
// (blinking lights, camera flashes, a crowd that shifts in its seats).
const R = (x, y, w, h, c, cls) => ({ x, y, w, h, c, cls });
const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const SKIN = ["#f1c8a8", "#d9a37f", "#b07a52", "#7a4e33", "#e6b893"], SHIRT = ["#2b3a5c", "#5a2a2a", "#3d4a3d", "#24324f", "#4a4a5a", "#6b5a3a", "#283c6b"];
// A row of people seen from behind or the front, each bobbing on its own clock.
function crowd(y, n, x0 = 0, x1 = 160, seed = 1, hair = true) {
  const out = [], step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) { const x = Math.round(x0 + i * step + hash(i + seed) * 2), k = Math.floor(hash(i * 7 + seed) * 5), cls = `px-bob d${i % 5}`;
    out.push(R(x, y + 4, 7, 6, SHIRT[(i + seed) % SHIRT.length], cls), R(x + 2, y, 3, 4, SKIN[k], cls));
    if (hair) out.push(R(x + 2, y, 3, 1, ["#1f1a17", "#5b3a24", "#9a9a9a", "#b98a4f"][(i + seed) % 4], cls)); }
  return out;
}
const flag = (x, y) => [R(x, y, 1, 22, "#c9a24a"), R(x + 1, y, 10, 7, "#f4f4f4"), ...[0, 2, 4, 6].map((d) => R(x + 1, y + d, 10, 1, "#c8243a")), R(x + 1, y, 4, 4, "#24324f"), R(x + 2, y + 1, 1, 1, "#fff"), R(x + 3, y + 2, 1, 1, "#fff")];
const seal = (cx, cy, r, c) => { const out = []; for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; out.push(R(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 2, 2, c)); } out.push(R(cx - 3, cy - 3, 6, 6, c)); return out; };
const SETS = {
  studio: () => [R(0, 0, 160, 75, "#0b1a3a"), ...Array.from({ length: 14 }, (_, i) => R(i * 12, 30 - Math.round(hash(i) * 18), 10, 45, i % 2 ? "#13264f" : "#102044")),
    ...Array.from({ length: 30 }, (_, i) => R(3 + i * 5, 34 - Math.round(hash(i + 3) * 14), 1, 1, "#ffd36a", `px-blink d${i % 5}`)),
    R(8, 8, 40, 22, "#1d4fa8"), R(10, 10, 36, 18, "#2a63c9", "px-flicker"), R(112, 8, 40, 22, "#1d4fa8"), R(114, 10, 36, 18, "#2a63c9", "px-flicker d2"),
    ...Array.from({ length: 10 }, (_, i) => R(4 + i * 16, 0, 6, 3, "#fff6c2", `px-blink d${i % 5}`)), R(0, 62, 160, 13, "#071027")],
  hearing: () => [R(0, 0, 160, 75, "#4a3220"), ...Array.from({ length: 20 }, (_, i) => R(i * 8, 0, 1, 44, "#3b2a1d")), R(0, 0, 160, 3, "#6b4a2f"),
    R(30, 4, 100, 18, "#5a3f2a"), ...seal(80, 13, 7, "#c9a24a"), ...flag(8, 6), ...flag(140, 6), R(0, 40, 160, 6, "#6b4a2f"), R(0, 40, 160, 1, "#c8a96a"),
    ...crowd(52, 22, 0, 160, 3), R(0, 66, 160, 9, "#2a1d14"),
    R(20, 48, 2, 2, "#fff", "px-flash d1"), R(70, 50, 2, 2, "#fff", "px-flash d3"), R(130, 47, 2, 2, "#fff", "px-flash d4")],
  office: () => [R(0, 0, 160, 75, "#e9e2d0"), R(0, 44, 160, 31, "#7a5a3a"), R(8, 6, 46, 36, "#6b4a2f"),
    ...Array.from({ length: 4 }, (_, row) => Array.from({ length: 11 }, (_, i) => R(10 + i * 4, 8 + row * 9, 3, 7, ["#8a2a2a", "#24324f", "#3d5a3d", "#c9a24a", "#5a4a6b"][(i + row * 3) % 5]))).flat(),
    R(104, 8, 40, 26, "#9cc7e8"), R(104, 8, 40, 26, "#bfe0f5", "px-sky"), R(123, 8, 2, 26, "#e9e2d0"), R(104, 20, 40, 2, "#e9e2d0"), ...flag(64, 10), ...flag(150, 12)],
  debate: () => [R(0, 0, 160, 75, "#140b26"), ...[30, 80, 130].map((x, i) => R(x - 10, 0, 20, 50, "#3d1f5c55", `px-spot d${i}`)),
    R(40, 4, 80, 10, "#c8243a"), R(42, 6, 76, 6, "#24324f"), ...Array.from({ length: 12 }, (_, i) => R(46 + i * 6, 8, 3, 2, "#fff", `px-blink d${i % 5}`)),
    ...crowd(54, 26, 0, 160, 5), R(0, 68, 160, 7, "#0a0614")],
  briefing: () => [R(0, 0, 160, 75, "#1f3a6b"), R(0, 46, 160, 29, "#3a2a1a"), R(55, 4, 50, 34, "#24447a"), ...seal(80, 20, 11, "#c9a24a"), ...flag(30, 8), ...flag(120, 8),
    ...crowd(50, 24, 0, 160, 7), ...Array.from({ length: 6 }, (_, i) => R(12 + i * 27, 48 + (i % 2) * 3, 3, 3, "#fff", `px-flash d${i % 5}`))],
  oval: () => [R(0, 0, 160, 75, "#f6f0de"), R(0, 0, 160, 4, "#e8d9a8"), ...[22, 66, 110].map((x) => [R(x, 8, 28, 30, "#bfe0f5"), R(x, 8, 28, 30, "#d6ecf9", "px-sky"), R(x - 3, 6, 4, 36, "#c9a24a"), R(x + 27, 6, 4, 36, "#c9a24a"), R(x + 13, 8, 2, 30, "#f6f0de")]).flat(),
    ...flag(56, 14), ...flag(100, 14), R(0, 46, 160, 29, "#2a3f7a"), ...Array.from({ length: 16 }, (_, i) => R(i * 10 + 3, 58, 4, 1, "#c9a24a"))],
  chamber: () => [R(0, 0, 160, 75, "#5a1f24"), ...Array.from({ length: 16 }, (_, i) => R(i * 10, 0, 6, 26, "#4a181c")), R(0, 0, 160, 2, "#c9a24a"),
    R(60, 6, 40, 20, "#3d1418"), ...flag(75, 2), R(52, 26, 56, 4, "#c9a24a"), ...crowd(34, 30, 0, 160, 9, false), ...crowd(46, 26, 4, 156, 11), ...crowd(58, 22, 8, 152, 13), R(0, 70, 160, 5, "#2a1b10")],
};
export default function PixelSet({ setting }) {
  const rects = (SETS[setting] || SETS.studio)();
  return (
    <svg className="px-set" viewBox="0 0 160 75" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true">
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} className={r.cls} />)}
    </svg>
  );
}
