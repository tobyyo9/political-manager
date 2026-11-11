// Tiny chiptune sound effects made on the fly with Web Audio: no files to load. Off unless the player turns them on.
let ctx = null, on = false;
try { on = localStorage.getItem("pm-sound") === "1"; } catch { /* storage can be blocked */ }
export const soundOn = () => on;
export function setSound(v) { on = !!v; try { localStorage.setItem("pm-sound", on ? "1" : "0"); } catch { /* ignore */ } if (on) blip(880, 0.06, "square", 0.05); }
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === "suspended") ctx.resume(); return ctx; }
function blip(freq, dur = 0.08, type = "square", vol = 0.06, at = 0, slide = 0) {
  const a = ac(); if (!a) return; const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur = 0.12, vol = 0.12, at = 0) {
  const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(), g = a.createGain(); src.buffer = b; g.gain.value = vol; src.connect(g); g.connect(a.destination); src.start(a.currentTime + at);
}
const SFX = {
  tick: () => blip(1200 + Math.random() * 300, 0.02, "square", 0.015),
  gavel: () => { noise(0.08, 0.25); blip(140, 0.18, "square", 0.12, 0, -60); noise(0.06, 0.15, 0.22); blip(130, 0.15, "square", 0.08, 0.22, -50); },
  pass: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.12, "square", 0.05, i * 0.09)),
  fail: () => [392, 330, 262, 196].forEach((f, i) => blip(f, 0.16, "triangle", 0.07, i * 0.11)),
  cash: () => { blip(1319, 0.06, "square", 0.05); blip(1760, 0.18, "square", 0.05, 0.07); },
  alarm: () => { for (let i = 0; i < 4; i++) { blip(880, 0.14, "sawtooth", 0.05, i * 0.3); blip(660, 0.14, "sawtooth", 0.05, i * 0.3 + 0.15); } },
  page: () => { noise(0.09, 0.06); blip(520, 0.05, "triangle", 0.03, 0.05, 200); },
  call: () => [784, 988, 1175].forEach((f, i) => blip(f, 0.1, "square", 0.045, i * 0.07)),
  flash: () => noise(0.05, 0.08),
};
export function sfx(name) { if (!on) return; try { SFX[name]?.(); } catch { /* audio may be unavailable */ } }
