"""Music + sound effects for the Nightly explainer, synthesised in numpy, mixed under the voiceover."""
import json
import wave

import numpy as np

SR = 44100
tl = json.load(open("timeline.json"))
S = {s["id"]: s for s in tl["scenes"]}
L = [l["start"] for l in tl["lines"]]
TOTAL = tl["total"]
N = int(TOTAL * SR) + SR
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_adsr(n, a=0.01, d=0.1, s=0.6, r=0.2):
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    s_ = max(0, n - a_ - d_ - r_)
    return np.concatenate([np.linspace(0, 1, a_, False), np.linspace(1, s, d_, False), np.full(s_, s), np.linspace(s, 0, r_)])[:n]


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # small buffers only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def place(buf, sig, at, gain=1.0):
    s = int(at * SR)
    if s >= len(buf) or s + len(sig) <= 0:
        return
    e = min(len(buf), s + len(sig))
    buf[max(s, 0):e] += gain * sig[max(0, -s):e - s]


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- music
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # midi notes: Fmaj7, Em7, Dm9, Cmaj7(add9)
    [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62],
]
music = np.zeros(N, np.float32)
drums = np.zeros(N, np.float32)
arp = np.zeros(N, np.float32)
bass = np.zeros(N, np.float32)

nob0, nob1 = S["nobody"]["vstart"], S["dig"]["vstart"] + 0.2
end0 = S["end"]["vstart"]


def intensity(t):
    if t < BAR * 0.5:
        return 0.0
    if nob0 <= t < nob1:
        return 0.0
    return 1.0


nbars = int(TOTAL / BAR) + 2
for b in range(nbars):
    t0 = b * BAR
    ch = CHORDS[b % 4]
    # pad
    n = int(BAR * 1.15 * SR)
    tt = np.arange(n) / SR
    pad = np.zeros(n)
    for m in ch:
        f = note(m + 12)
        for det in (-0.12, 0.0, 0.11):
            pad += np.sin(2 * np.pi * f * (1 + det / 100) * tt + rng.random() * 6) * 0.5
            pad += 0.18 * np.sin(2 * np.pi * 2 * f * (1 + det / 100) * tt)
    pad *= env_adsr(n, a=0.9, d=0.4, s=0.8, r=0.6) / (len(ch) * 3)
    tense = nob0 <= t0 < nob1
    place(music, (pad * (0.55 if tense else 1.0)).astype(np.float32), t0, 0.5)
    # bass
    if intensity(t0) > 0:
        for bt in (0, 2.5):
            nb = int(BEAT * 1.4 * SR)
            tb = np.arange(nb) / SR
            f = note(ch[0] - 12)
            sig = (np.sin(2 * np.pi * f * tb) + 0.25 * np.sin(2 * np.pi * 2 * f * tb)) * np.exp(-tb * 2.2)
            place(bass, sig.astype(np.float32), t0 + bt * BEAT, 0.42)
    # arpeggio: plucked bell 8ths
    if intensity(t0) > 0 or t0 < BAR:
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]
        for i, pi in enumerate(pattern):
            m = ch[pi % len(ch)] + 24
            na = int(0.9 * SR)
            ta = np.arange(na) / SR
            f = note(m)
            sig = (np.sin(2 * np.pi * f * ta) * 0.7 + np.sin(2 * np.pi * 2.01 * f * ta) * 0.18 + np.sin(2 * np.pi * 3.98 * f * ta) * 0.06) * np.exp(-ta * 5.5)
            sig *= np.minimum(1, ta * 400)
            vel = 0.55 + 0.25 * (i % 2 == 0)
            place(arp, sig.astype(np.float32), t0 + i * BEAT / 2, 0.16 * vel)
    # drums
    if intensity(t0) > 0:
        for bt in range(4):
            tb = t0 + bt * BEAT
            if bt in (0, 2):  # soft kick
                nk = int(0.35 * SR)
                tk = np.arange(nk) / SR
                f = 45 + 70 * np.exp(-tk * 30)
                k = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tk * 9)
                place(drums, k.astype(np.float32), tb, 0.55)
            else:  # brush snare
                ns = int(0.22 * SR)
                ts = np.arange(ns) / SR
                s = rng.standard_normal(ns) * np.exp(-ts * 18)
                s = s - np.convolve(s, np.ones(8) / 8, "same")
                place(drums, s.astype(np.float32), tb, 0.10)
            for h in (0, 0.5):  # hats
                nh = int(0.05 * SR)
                th = np.arange(nh) / SR
                hsig = rng.standard_normal(nh) * np.exp(-th * 90)
                hsig = hsig - np.convolve(hsig, np.ones(4) / 4, "same")
                place(drums, hsig.astype(np.float32), tb + h * BEAT, 0.05 if h else 0.035)

# tension drone during "nobody"
nd = int((nob1 - nob0 + 0.6) * SR)
td = np.arange(nd) / SR
drone = (np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 82.4 * td) + 0.3 * np.sin(2 * np.pi * 110.5 * td)) * np.minimum(1, td / 0.4) * np.minimum(1, (td[::-1]) / 0.5)
place(music, drone.astype(np.float32), nob0, 0.12)

# delay on arp
d = int(BEAT * 0.75 * SR)
arp_d = arp.copy()
arp_d[d:] += 0.35 * arp[:-d]
arp_d[2 * d:] += 0.15 * arp[:-2 * d]

mus = music + arp_d + bass + drums
# fade in / out
fi = np.minimum(1, np.arange(N) / (SR * 1.2))
fo = np.clip((TOTAL + 0.3 - np.arange(N) / SR) / 2.2, 0, 1)
mus *= fi * fo

# ---------------------------------------------------------------- sfx
sfx = np.zeros(N, np.float32)


def pop(at, g=0.35, f0=320, f1=980):
    n = int(0.09 * SR); tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / tt[-1]) ** 0.6
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38)
    place(sfx, s.astype(np.float32), at, g)


def whoosh(at, g=0.22, d=0.42):
    n = int(d * SR); tt = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = lp_fast(s, 1800) - lp_fast(s, 300)
    s *= np.sin(np.pi * tt / d) ** 2
    place(sfx, (s / (np.abs(s).max() + 1e-9)).astype(np.float32), at, g)


def tick(at, g=0.12, f=2100):
    n = int(0.04 * SR); tt = np.arange(n) / SR
    place(sfx, (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120)).astype(np.float32), at, g)


def err(at, g=0.12):
    for k, f in enumerate((196, 165)):
        n = int(0.09 * SR); tt = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 + np.sin(2 * np.pi * f * tt) * 0.5
        s = lp_fast(s, 1200) * np.exp(-tt * 22)
        place(sfx, s.astype(np.float32), at + k * 0.1, g)


def ding(at, g=0.25, f=1318.5):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt) + 0.15 * np.sin(2 * np.pi * 3.01 * f * tt)) * np.exp(-tt * 4.5)
    place(sfx, s.astype(np.float32), at, g)


def notify(at, g=0.3):
    for k, f in enumerate((987.8, 1318.5)):
        n = int(0.32 * SR); tt = np.arange(n) / SR
        s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 10) * np.minimum(1, tt * 300)
        place(sfx, s.astype(np.float32), at + k * 0.12, g)


def typing(at, dur, g=0.05):
    t = at
    while t < at + dur:
        n = int(0.012 * SR)
        s = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 400)
        place(sfx, s.astype(np.float32), t, g * (0.7 + 0.6 * rng.random()))
        t += 0.045 + rng.random() * 0.05


def swell(at, d=1.6, g=0.18):
    n = int(d * SR); tt = np.arange(n) / SR
    s = rng.standard_normal(n); s = lp_fast(s, 500)
    s *= (tt / d) ** 2 * np.minimum(1, (d - tt) * 8)
    place(sfx, (s / (np.abs(s).max() + 1e-9)).astype(np.float32), at, g)


def chime(at, g=0.22):
    for k, m in enumerate((77, 81, 84, 88)):
        ding(at + k * 0.12, g * (1 - k * 0.12), note(m))


pop(S["hi"]["vstart"] + 0.1, 0.45, 220, 760)
pop(L[1] - 0.1); whoosh(L[2] - 0.15)
for i in range(8):
    pop(S["watch"]["vstart"] + 0.4 + i * 0.18, 0.18, 400 + i * 40, 1100 + i * 40)
    tick(L[4] + i * 0.12, 0.08, 2400)
whoosh(S["runs"]["vstart"], 0.25)
runs0, fix0 = S["runs"]["vstart"], S["fix"]["vstart"]
i = 0
while True:
    at = runs0 + 0.3 + i * 0.55
    if at >= S["nobody"]["vstart"]:
        break
    bad = at >= L[7] - 0.9 and i % 4 != 0
    (err(at, 0.07) if bad else tick(at, 0.06))
    i += 1
whoosh(L[6] - 0.05, 0.16)
swell(S["nobody"]["vstart"] - 0.6)
whoosh(S["dig"]["vstart"], 0.2)
for st in (L[10] + 0.1, L[10] + 1.0, L[10] + 1.9, L[11] + 0.5):
    typing(st, 0.85)
    tick(st + 0.9, 0.09, 1600)
ding(L[12] + 0.2, 0.22)
for k in range(3):
    tick(L[13] + 0.5 + k * 0.5, 0.1, 1900 + k * 200)
ding(L[13] + 1.6, 0.2, 1568)
notify(S["slack"]["vstart"] + 0.35)
for k in range(4):
    pop(S["slack"]["vstart"] + 0.35 + k * 0.4, 0.08, 500, 900)
tick(L[15] + 0.1, 0.12, 1200)
whoosh(S["tagline"]["vstart"] + 0.15, 0.2)
pop(L[17] - 0.1, 0.3, 300, 1200)
whoosh(S["sdk"]["vstart"], 0.2)
typing(S["sdk"]["vstart"] + 0.3, 0.5)
typing(S["sdk"]["vstart"] + 0.9, 0.5)
for d_ in (1.3, 1.8, 2.3, 2.8):
    tick(S["sdk"]["vstart"] + 0.3 + d_, 0.09, 1800)
chime(end0 + 0.3)

# ---------------------------------------------------------------- mix
vo = np.load("vo.npy")[:N]
vo = np.pad(vo, (0, max(0, N - len(vo))))
# ducking envelope from voice
frame = 1024
venv = np.repeat([np.sqrt(np.mean(vo[i:i + frame] ** 2)) for i in range(0, N, frame)], frame)[:N]
duck_target = np.where(venv > 0.01, 0.55, 1.0)
duck = lp_fast(duck_target.astype(np.float64), 3.0)

mus_l = mus * duck * 0.2
mix = vo * 1.0 + mus_l + sfx * 0.9
mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # gentle limiter
peak = np.abs(mix).max()
mix = mix / peak * 0.92
# stereo: small widening of music via delay
right = mix.copy()
left = mix.copy()
st = (mus_l / peak * 0.92) * 0.08
dly = int(0.012 * SR)
left[dly:] += st[:-dly]
right[:-dly] += st[dly:]
out = np.stack([left, right], 1)
out = np.clip(out, -1, 1)
with wave.open("mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print("mix.wav", out.shape[0] / SR, "s")
