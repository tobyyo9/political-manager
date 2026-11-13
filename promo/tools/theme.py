# A cable-news, election-night style theme for the trailer, synthesized from scratch:
# brass, strings, timpani, snare, cymbals and a hall reverb, all built from basic waveforms.
# Section changes land on the scene cuts in src/Promo.tsx.
import sys, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 61.0
OUT = sys.argv[1] if len(sys.argv) > 1 else "theme.wav"
N = int(SR * (DUR + 4))
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)
BEAT = 0.5                                    # 120 BPM
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)   # MIDI note number to Hz
def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR / 2 - 100) / (SR / 2), "low", output="sos"), x)
def hp(x, f, order=2): return sosfilt(butter(order, f / (SR / 2), "high", output="sos"), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos"), x)
def put(t, x, vol, pan=0.0):
    i = int(t * SR); j = min(N, i + len(x)); x = x[: j - i] * vol
    L[i:j] += x * np.sqrt(0.5 * (1 - pan)); R[i:j] += x * np.sqrt(0.5 * (1 + pan))
def adsr(n, a, d, s, r):
    e = np.full(n, s); a_ = max(1, int(a * SR)); d_ = max(1, int(d * SR)); r_ = max(1, min(n, int(r * SR)))
    e[:a_] = np.linspace(0, 1, a_); e[a_:a_ + d_] = np.linspace(1, s, len(e[a_:a_ + d_])); e[-r_:] *= np.linspace(1, 0, r_); return e
def saw(f, n, phase=0.0):
    t = np.arange(n) / SR; return 2 * ((f * t + phase) % 1) - 1

# ── Instruments ──
def brass(t, m, d, vol=0.12, pan=0.0):
    n = int((d + 0.15) * SR); tt = np.arange(n) / SR; f = hz(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.clip((tt - 0.18) / 0.3, 0, 1)
    ph = np.cumsum(f * vib) / SR
    x = sum(2 * ((ph * k + rng.random()) % 1) - 1 for k in (1.0, 1.003, 0.997)) / 3
    env = adsr(n, 0.05, 0.15, 0.8, 0.15)
    # brightness swells with the note, like a player leaning in
    x = lp(x, 900, 2) * 0.5 + lp(x, 3200, 2) * 0.5 * np.clip(env * 1.2, 0, 1)
    put(t, x * env, vol, pan)
def strings(t, m, d, vol=0.06, pan=0.0, attack=0.35):
    n = int((d + 0.4) * SR)
    x = sum(saw(hz(m) * (1 + c), n, rng.random()) for c in (-0.006, -0.002, 0.002, 0.006)) / 4
    put(t, lp(x, 2600) * adsr(n, attack, 0.2, 0.9, 0.4), vol, pan)
def stab(t, m, vol=0.05, pan=0.0, d=0.13):        # short, driving string ostinato note
    n = int((d + 0.05) * SR); x = (saw(hz(m), n) + saw(hz(m) * 1.004, n)) / 2
    put(t, lp(x, 3000) * adsr(n, 0.004, 0.05, 0.6, 0.06), vol, pan)
def pizz(t, m, vol=0.09, pan=0.0):                 # plucked, for the comic section
    n = int(0.35 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(2 * np.pi * hz(m) * 2 * tt)
    put(t, x * np.exp(-tt * 14), vol, pan)
def bassoon(t, m, d, vol=0.08):
    n = int((d + 0.05) * SR); x = np.where((np.arange(n) / SR * hz(m)) % 1 < 0.3, 1.0, -1.0)
    put(t, lp(x, 700) * adsr(n, 0.01, 0.05, 0.7, 0.05), vol, 0.15)
def timp(t, m, vol=0.5, pan=-0.15):
    n = int(1.8 * SR); tt = np.arange(n) / SR; f = hz(m) * (1 + 0.04 * np.exp(-tt * 30))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * np.exp(-tt * 5)
    x += lp(rng.uniform(-1, 1, n), 400) * np.exp(-tt * 40) * 0.6
    put(t, x, vol, pan)
def timp_roll(t0, t1, m, v0=0.05, v1=0.3):
    k = 0; step = 0.055
    while t0 + k * step < t1:
        p = k * step / (t1 - t0); timp(t0 + k * step, m, v0 + (v1 - v0) * p ** 2); k += 1
def snare(t, vol=0.12, pan=0.1):
    n = int(0.2 * SR); tt = np.arange(n) / SR
    x = bp(rng.uniform(-1, 1, n), 1200, 7000) * np.exp(-tt * 22) + 0.5 * np.sin(2 * np.pi * 185 * tt) * np.exp(-tt * 30)
    put(t, x, vol, pan)
def snare_roll(t0, t1, v0=0.02, v1=0.14):
    k = 0; step = 0.0625
    while t0 + k * step < t1:
        p = k * step / (t1 - t0); snare(t0 + k * step, v0 + (v1 - v0) * p ** 1.5); k += 1
# Metallic cymbal: six inharmonic square waves (the classic drum-machine recipe) plus a little noise, high-passed hard.
METAL = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)
def metal(n):
    tt = np.arange(n) / SR; x = sum(np.where((tt * f * 4.1 + rng.random()) % 1 < 0.5, 1.0, -1.0) for f in METAL) / 6
    return hp(bp(x, 3000, 14000) * 0.8 + rng.uniform(-1, 1, n) * 0.2, 4500, 4)
def cymbal(t, vol=0.12, d=3.0):
    n = int(d * SR); tt = np.arange(n) / SR; put(t, metal(n) * (np.exp(-tt * 1.7) * 0.85 + np.exp(-tt * 18) * 0.6), vol * 0.55, 0.3)
def swell(t_end, d=1.6, vol=0.1):
    n = int(d * SR); x = metal(n) * np.linspace(0, 1, n) ** 3; put(t_end - d, x, vol * 0.6, -0.3)
def boom(t, vol=0.5):
    vol *= 0.55
    n = int(2.0 * SR); tt = np.arange(n) / SR; put(t, np.sin(2 * np.pi * 42 * tt) * np.exp(-tt * 2.2), vol)
def tick(t, vol=0.06, hi=True):
    n = int(0.05 * SR); tt = np.arange(n) / SR; put(t, np.sin(2 * np.pi * (1900 if hi else 1500) * tt) * np.exp(-tt * 120), vol, 0.4 if hi else -0.4)
def pulse(t, m, vol=0.06):                         # synth pulse for the ticking tension sections
    n = int(0.22 * SR); tt = np.arange(n) / SR; x = lp(saw(hz(m), n), 800) * np.exp(-tt * 12); put(t, x, vol)

# ── Harmony: D major heroics. Chords as MIDI notes ──
D, Bm, G, A, Em, F, Bb = [50, 62, 66, 69], [47, 62, 66, 71], [43, 62, 67, 71], [45, 61, 64, 69], [40, 59, 64, 67], [41, 60, 65, 69], [46, 62, 65, 70]
PROG = [D, Bm, G, A]
def pad_chords(t0, t1, prog, bar=2.0, vol=0.045):
    t = t0; i = 0
    while t < t1 - 0.05:
        c = prog[i % len(prog)]; d = min(bar, t1 - t)
        strings(t, c[0] - 12, d, vol * 1.3, 0.0, 0.2)
        for k, m in enumerate(c[1:]): strings(t, m, d, vol, (-0.5, 0.0, 0.5)[k])
        t += bar; i += 1
def ostinato(t0, t1, prog, bar=2.0, vol=0.045):
    t = t0; i = 0
    while t < t1 - 0.05:
        c = prog[(int((t - t0) // bar)) % len(prog)]
        pattern = [c[1], c[2], c[3], c[2]]
        stab(t, pattern[i % 4] - 12 + (12 if (i // 4) % 2 else 0), vol, -0.35 if i % 2 else 0.35)
        t += 0.125; i += 1
def march(t0, t1, vol=1.0):
    t = t0; i = 0
    while t < t1 - 0.05:
        b = i % 8
        if b in (0, 4): timp(t, 38 if b == 0 else 33, 0.28 * vol)
        if b in (2, 6): snare(t, 0.11 * vol)
        if b == 7: snare(t + 0.125, 0.06 * vol)
        t += 0.25; i += 1

# Fanfare melody (MIDI note, length in beats)
THEME = [(57, 0.5), (62, 0.25), (66, 0.25), (69, 1.5), (67, 0.5), (66, 0.5), (64, 0.5), (66, 1.5), (62, 0.5),
         (59, 0.5), (62, 0.5), (67, 1.0), (69, 0.5), (71, 0.5), (69, 2.0)]
THEME2 = [(69, 0.5), (74, 0.25), (78, 0.25), (81, 1.5), (79, 0.5), (78, 0.5), (76, 0.5), (78, 1.0), (74, 1.0),
          (71, 0.5), (74, 0.5), (79, 1.0), (78, 0.5), (76, 0.5), (74, 2.0)]
def play(t, mel, vol=0.11, octave=0, harmony=False):
    for m, b in mel:
        d = b * BEAT
        brass(t, m + octave, d * 0.95, vol, -0.15)
        if harmony: brass(t, m + octave - 5 if m % 12 in (2, 7) else m + octave - 3, d * 0.95, vol * 0.6, 0.25)
        t += d
    return t

# ── 0 to 6.5s: the clock running down, the week turning ──
for k in range(13): tick(0.0 + k * 0.5, 0.1, k % 2 == 0)
for k in range(26): pulse(0.0 + k * 0.25, 38, 0.09)
strings(0.0, 38, 6.4, 0.09, 0, 1.2); strings(0.0, 50, 6.4, 0.06, -0.3, 1.2); strings(2.0, 57, 4.4, 0.05, 0.3, 1.0)
snare_roll(4.5, 6.45, 0.01, 0.16); timp_roll(5.0, 6.45, 38, 0.03, 0.25); swell(6.5, 1.8, 0.12)

# ── 6.5s: the title. Full orchestra hit and the theme ──
boom(6.5, 0.5); timp(6.5, 38, 0.7); cymbal(6.5, 0.16)
for m in (50, 57, 62, 66, 69): brass(6.5, m, 1.6, 0.07, (m % 5 - 2) * 0.2)
pad_chords(8.5, 25.0, PROG); ostinato(8.5, 25.0, PROG); march(8.5, 25.0)
t = play(9.0, THEME, 0.10)
play(17.0, THEME2, 0.08, -12, harmony=True)
cymbal(14.0, 0.06, 1.5); cymbal(19.0, 0.07, 1.5)
for x in (21.35, 23.65): timp(x, 38, 0.35); brass(x, 69, 0.4, 0.06); brass(x + 0.2, 74, 0.6, 0.06)   # the roll call passes

# ── 25 to 32s: the funny headlines. Same key, but oom-pah ──
t = 25.0
for i in range(28):
    c = [D, G, A, D][(i // 4) % 4]
    if i % 2 == 0: bassoon(t, c[0] - 12, 0.2, 0.12)
    else: pizz(t, c[2], 0.1, 0.3); pizz(t, c[3], 0.08, -0.3)
    t += 0.25
for x, mel in ((25.4, [74, 78, 81]), (27.7, [76, 79, 83]), (30.0, [78, 81, 86])):
    for k, m in enumerate(mel): pizz(x + k * 0.09, m, 0.07, 0.2)
    snare(x, 0.05)

# ── 32 to 38s: the hearing. Tension ──
strings(32.0, 38, 6.0, 0.09, 0, 0.6); strings(32.0, 53, 6.0, 0.055, -0.4, 0.8); strings(34.0, 56, 4.0, 0.05, 0.4, 0.8)
for k in range(24): pulse(32.0 + k * 0.25, 38 if k % 8 < 6 else 41, 0.09)
for k in range(12): tick(32.0 + k * 0.5, 0.04, k % 2 == 0)
timp(32.0, 38, 0.3); timp(35.85, 38, 0.3)
brass(35.85, 62, 0.5, 0.06); brass(36.1, 66, 0.7, 0.06)            # the room is with you

# ── 38s: the knock-down. A dissonant stab, then silence and a roll back in ──
boom(38.0, 0.6); timp(38.0, 37, 0.6)
for m in (49, 55, 61, 64): brass(38.0, m, 0.9, 0.07)
strings(38.4, 37, 3.0, 0.05, 0, 0.8); strings(38.4, 44, 3.0, 0.03, 0.3, 0.8)
snare_roll(40.0, 41.45, 0.01, 0.15); timp_roll(40.3, 41.45, 33, 0.03, 0.3); swell(41.5, 1.4, 0.12)

# ── 41.5 to 55s: the build to election night ──
boom(41.5, 0.4); timp(41.5, 38, 0.6); cymbal(41.5, 0.12)
pad_chords(41.5, 55.0, [G, A, Bm, A, G, A, D, D], vol=0.05); ostinato(41.5, 55.0, [G, A, Bm, A, G, A, D, D], vol=0.05); march(41.5, 55.0, 1.1)
play(41.5, THEME, 0.10, 0, harmony=True)
cymbal(45.0, 0.08, 1.8)
play(49.5, THEME2[:9], 0.11, -12, harmony=True)
cymbal(49.0, 0.1, 2.0); timp(49.0, 38, 0.5)
snare_roll(53.2, 54.95, 0.02, 0.16); timp_roll(53.5, 54.95, 33, 0.04, 0.32); swell(55.0, 1.6, 0.14)

# ── 55s: the end card. Final chord, let it ring ──
boom(55.0, 0.6); timp(55.0, 38, 0.8); cymbal(55.0, 0.18, 4.0)
for m, p in ((38, 0), (50, -0.3), (57, 0.3), (62, -0.2), (66, 0.2), (69, 0), (74, 0)): brass(55.0, m, 3.6, 0.065, p)
for m in (50, 62, 66, 69, 74): strings(55.0, m, 4.2, 0.035, 0, 0.1)
timp(57.0, 33, 0.35); timp(57.5, 38, 0.45)

# ── Mix: hall reverb, gentle bus compression, fades ──
irn = int(2.4 * SR); tt = np.arange(irn) / SR
irL = lp(rng.uniform(-1, 1, irn), 5000) * np.exp(-tt * 2.9); irR = lp(rng.uniform(-1, 1, irn), 5000) * np.exp(-tt * 2.9)
irL[: int(0.02 * SR)] = 0; irR[: int(0.023 * SR)] = 0
wetL = fftconvolve(L, irL)[:N]; wetR = fftconvolve(R, irR)[:N]
sc = max(np.abs(wetL).max(), np.abs(wetR).max()) / max(np.abs(L).max(), 1e-9)
Lm = L + wetL / sc * 0.38; Rm = R + wetR / sc * 0.38
n = int(DUR * SR); Lm, Rm = Lm[:n], Rm[:n]
f = int(0.03 * SR); ramp = np.linspace(0, 1, f); Lm[:f] *= ramp; Rm[:f] *= ramp
f = int(2.5 * SR); ramp = np.linspace(1, 0, f) ** 1.5; Lm[-f:] *= ramp; Rm[-f:] *= ramp
pk = max(np.abs(Lm).max(), np.abs(Rm).max()); Lm /= pk; Rm /= pk
Lm = np.tanh(Lm * 3.2) / np.tanh(3.2) * 0.89; Rm = np.tanh(Rm * 3.2) / np.tanh(3.2) * 0.89   # soft limiter so the hits do not bury the music
pcm = (np.stack([Lm, Rm], 1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, round(n / SR, 1), "s")
