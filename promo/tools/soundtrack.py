# Chiptune soundtrack for the trailer, synthesized from scratch (no samples), in the same style as the game's sfx.js.
# Times are in seconds and match the scene layout in src/Promo.tsx.
import numpy as np, wave, sys
SR = 48000
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 61.0
out = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
mix = np.zeros(int(SR * DUR) + SR)
rng = np.random.default_rng(7)
BPM = 128; BEAT = 60 / BPM; BAR = 4 * BEAT
def hz(n): return 440.0 * 2 ** (n / 12)          # n = semitones from A4
def env(n, a=0.004, r=0.08):
    e = np.ones(n); ai = max(1, int(a * SR)); ri = min(n, max(1, int(r * SR)))
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri) ** 1.5; return e
def osc(kind, f, d, duty=0.5, slide=0.0):
    n = int(d * SR); t = np.arange(n) / SR; fr = f + slide * t / max(d, 1e-6); ph = np.cumsum(fr) / SR
    if kind == "sq": return np.where((ph % 1) < duty, 1.0, -1.0)
    if kind == "tri": return 2 * np.abs(2 * (ph % 1) - 1) - 1
    if kind == "saw": return 2 * (ph % 1) - 1
    return np.sin(2 * np.pi * ph)
def add(t, sig, vol):
    i = int(t * SR); j = min(len(mix), i + len(sig)); mix[i:j] += sig[: j - i] * vol
def note(t, n, d, kind="sq", vol=0.1, duty=0.5, a=0.004, r=0.06): add(t, osc(kind, hz(n), d, duty) * env(int(d * SR), a, r), vol)
def noise(t, d, vol, decay=2.0, hp=False):
    n = int(d * SR); x = rng.uniform(-1, 1, n)
    if hp: x = np.diff(np.concatenate([[0], x]))
    add(t, x * np.linspace(1, 0, n) ** decay, vol)
def kick(t, vol=0.55): d = 0.16; add(t, osc("sin", 150, d, slide=-110) * env(int(d * SR), 0.001, 0.12), vol)
def snare(t, vol=0.22): noise(t, 0.14, vol, 2.2); add(t, osc("tri", 190, 0.08) * env(int(0.08 * SR)), vol * 0.6)
def hat(t, vol=0.06): noise(t, 0.035, vol, 3, hp=True)
def gavel(t, vol=1.0): noise(t, 0.09, 0.35 * vol, 3); add(t, osc("sq", 140, 0.2, slide=-70) * env(int(0.2 * SR), 0.001, 0.15), 0.18 * vol); noise(t + 0.22, 0.07, 0.2 * vol, 3); add(t + 0.22, osc("sq", 130, 0.16, slide=-60) * env(int(0.16 * SR), 0.001, 0.12), 0.12 * vol); kick(t, 0.7 * vol)
def crash(t, vol=0.12): noise(t, 1.4, vol, 1.6, hp=True)
def riser(t0, t1, vol=0.12):
    d = t1 - t0; n = int(d * SR); x = rng.uniform(-1, 1, n); x = np.diff(np.concatenate([[0], x]))
    add(t0, x * np.linspace(0, 1, n) ** 2, vol); add(t0, osc("sq", 220, d, 0.5, slide=660) * np.linspace(0, 1, n) ** 2 * 0.5, vol * 0.5)
def whoosh(t, vol=0.08): d = 0.35; n = int(d * SR); x = np.diff(np.concatenate([[0], rng.uniform(-1, 1, n)])); add(t, x * np.sin(np.linspace(0, np.pi, n)), vol)
def jingle(t, ns, step=0.09, vol=0.09, kind="sq"):
    for i, n in enumerate(ns): note(t + i * step, n, 0.14, kind, vol)
def tick(t): note(t, 15 + rng.integers(0, 3), 0.02, "sq", 0.03)

# Chords (semitones from A4): Am, F, C, G
CH = [(-12, [0, 3, 7]), (-16, [-4, 0, 3]), (-21, [3, 7, 10]), (-14, [-2, 2, 5])]
LEAD = [[12, None, 15, 19, 17, None, 15, 12], [10, None, 12, 15, 14, 12, 10, None], [12, None, 15, 19, 22, None, 19, 17], [19, 17, 15, 14, 15, None, None, None]]
def band(t0, t1, drums=True, lead=True, arp=True, bass=True, vol=1.0):
    t = t0; bar = 0
    while t < t1 - 0.01:
        root, tri = CH[bar % 4]
        for e in range(8):                                   # eighth notes
            te = t + e * BEAT / 2
            if te >= t1: break
            if bass: note(te, root + (12 if e % 2 else 0), BEAT / 2 * 0.9, "sq", 0.085 * vol, 0.25)
            if drums:
                if e in (0, 4): kick(te, 0.5 * vol)
                if e in (2, 6): snare(te, 0.2 * vol)
                hat(te + BEAT / 4, 0.045 * vol); hat(te, 0.03 * vol)
            if lead:
                m = LEAD[bar % 4][e]
                if m is not None: note(te, m, BEAT / 2 * 0.95, "sq", 0.05 * vol, 0.5, r=0.05)
        if arp:
            for s in range(16):
                ts = t + s * BEAT / 4
                if ts >= t1: break
                note(ts, tri[s % 3] + (12 if (s // 3) % 2 else 0), BEAT / 4 * 0.8, "tri", 0.03 * vol)
        t += BAR; bar += 1

# 0 to 6.5s: the clock and the turning week
for i in range(13): kick(0.2 + i * BEAT, 0.18)
for k in range(48): tick(0.6 + k * (1.6 / 48))
note(2.4, -24, 1.8, "tri", 0.12, a=0.02, r=1.2)
whoosh(3.45, 0.1); noise(3.5, 0.09, 0.06); note(3.55, 3, 0.05, "tri", 0.05)
riser(4.6, 6.5, 0.14)
# 6.5s: the title hits
gavel(6.5, 1.0); crash(6.5, 0.12)
band(6.5, 25.0)
for t in [9.5, 14.0, 19.0]: whoosh(t - 0.15, 0.07)
jingle(21.4, [3, 7, 10, 15], 0.09, 0.08); jingle(23.7, [7, 10, 15, 19], 0.09, 0.07)   # the House passes it, then the Senate
# 25 to 32s: the funny headlines get a lighter, bouncier groove
band(25.0, 32.0, drums=False, lead=False, vol=0.9)
for i, t in enumerate([25.4, 27.7, 30.0]):
    hat(t, 0.08); jingle(t, [12, 19] if i % 2 == 0 else [15, 22], 0.07, 0.06, "sq")
for k in range(int(7 / (BEAT / 2))): hat(25.0 + k * BEAT / 2, 0.05)
# 32 to 38s: the hearing scene
band(32.0, 38.0, lead=False)
jingle(35.8, [7, 12, 15], 0.08, 0.06)
# 38s: the knock-down, everything drops out
for i in range(4): note(38.05 + i * 0.3, 12, 0.14, "saw", 0.05); note(38.2 + i * 0.3, 7, 0.14, "saw", 0.05)
kick(38.0, 0.6); note(38.0, -24, 3.2, "tri", 0.14, a=0.005, r=2.0)
riser(40.2, 41.5, 0.12)
# 41.5 to 55s: back in, building to election night
gavel(41.5, 0.7); crash(41.5, 0.1)
band(41.5, 55.0)
whoosh(44.85, 0.07); whoosh(49.85, 0.07); whoosh(52.35, 0.07)
jingle(49.0, [0, 4, 7, 12, 16, 19, 24], 0.07, 0.07)           # election night win
# 55s: the end card
gavel(55.0, 1.1); crash(55.0, 0.15)
for n in [-12, 0, 3, 7, 12]: note(55.0, n, 3.6, "sq" if n > 0 else "tri", 0.05, 0.5, a=0.01, r=3.0)
for n in [0, 3, 7]: note(55.0, n + 12, 3.6, "tri", 0.05, a=0.01, r=3.0)

# Gentle fades, a soft limiter, and write it out.
mix = mix[: int(SR * DUR)]
f = int(0.05 * SR); mix[:f] *= np.linspace(0, 1, f); f = int(2.0 * SR); mix[-f:] *= np.linspace(1, 0, f)
mix = np.tanh(mix * 1.4) / np.tanh(1.4); mix *= 0.85 / max(1e-6, np.abs(mix).max())
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, round(len(mix) / SR, 2), "s")
