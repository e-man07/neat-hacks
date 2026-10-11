"""Nightly explainer soundtrack: playful marimba track + soft UI sound effects, mixed under the voice."""
import json
import wave

import numpy as np
from scipy.signal import lfilter

SR = 48000
tl = json.load(open("timeline.json"))
S = {s["id"]: s for s in tl["scenes"]}
L = [l["start"] for l in tl["lines"]]
TOTAL = tl["total"]
N = int(TOTAL * SR) + SR
rng = np.random.default_rng(11)


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x)


def hp(x, fc):
    return x - lp(x, fc)


def put(buf, sig, at, g=1.0):
    s = int(at * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(sig))
    if s < 0:
        sig = sig[-s:]; s = 0
    buf[s:e] += g * sig[: e - s]


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


# ------------------------------------------------------------------ instruments
def marimba(m, d=0.9, bright=1.0):
    t = tt(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 6) + 0.35 * bright * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t * 22) + 0.12 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t * 60)
    return s * np.minimum(1, t * 900)


def musicbox(m, d=1.4):
    t = tt(d); f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3) + 0.2 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 9)) * np.exp(-t * 3.2)
    return s * np.minimum(1, t * 1500)


def pad(ms, d):
    t = tt(d); s = np.zeros_like(t)
    for m in ms:
        f = hz(m)
        for det in (-.15, 0, .13):
            s += np.sin(2 * np.pi * f * (1 + det / 100) * t + rng.random() * 6)
    s = lp(s / (len(ms) * 3), 1400)
    a = int(.6 * SR); r = int(.8 * SR); env = np.ones_like(t)
    env[:a] = np.linspace(0, 1, a); env[-r:] = np.linspace(1, 0, r)
    return s * env


def pluck_bass(m, d=0.7):
    t = tt(d); f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 4) * np.minimum(1, t * 400)


def shaker(d=0.07):
    t = tt(d); s = hp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 70)
    return s


def kick():
    t = tt(.3); f = 50 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)


# ------------------------------------------------------------------ music
BPM = 100; B = 60 / BPM; BAR = 4 * B
PROG = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]  # Cmaj7 Am7 Fmaj7 G7
MEL = [[76, 74, 72, 74, 76, 79, 76, 74], [72, 71, 69, 71, 72, 76, 72, 69], [69, 72, 76, 74, 72, 69, 72, 74], [71, 74, 79, 77, 74, 71, 74, 76]]
music = np.zeros(N); perc = np.zeros(N)
nob0, nob1 = S["nobody"]["vstart"], L[11] + 0.2
end0 = S["end"]["vstart"]
for b in range(int(TOTAL / BAR) + 2):
    t0 = b * BAR
    if t0 > TOTAL + 1:
        break
    ch = PROG[b % 4]
    sleepy = nob0 - .2 <= t0 < nob1
    put(music, pad([m + 12 for m in ch[:3]] + [ch[0] - 12 + 24], BAR * 1.2), t0, .9 if not sleepy else .7)
    if sleepy:
        for i, m in enumerate(MEL[b % 4][::2]):
            put(music, musicbox(m + 12), t0 + i * B, .22)
        continue
    intro = t0 < BAR
    # marimba arpeggio 8ths
    for i in range(8):
        m = ch[[0, 2, 1, 3, 2, 1, 3, 2][i]] + 12
        put(music, marimba(m, .7, .8), t0 + i * B / 2, .16 if i % 2 == 0 else .11)
    # melody (sparser) after intro
    if not intro and t0 < end0 + 2:
        for i, m in enumerate(MEL[b % 4]):
            if i % 2 == 0 or (b % 2 == 1):
                put(music, marimba(m, .9, 1.0), t0 + i * B / 2 + .01, .10)
    if not intro:
        put(music, pluck_bass(ch[0] - 24), t0, .5); put(music, pluck_bass(ch[0] - 24), t0 + 2.5 * B, .35)
        put(perc, kick(), t0, .35); put(perc, kick(), t0 + 2 * B, .22)
        for i in range(8):
            put(perc, shaker(), t0 + i * B / 2 + (0.012 if i % 2 else 0), .05 if i % 2 else .035)
# ending: resolve on C with a music-box flourish
for i, m in enumerate([72, 76, 79, 84]):
    put(music, musicbox(m, 2.5), end0 + 1.2 + i * .18, .25)
put(music, pad([60, 64, 67, 72], 3.5), end0 + 1.0, .8)
mus = music + perc
fade = np.clip((TOTAL + .2 - np.arange(N) / SR) / 2.0, 0, 1) * np.minimum(1, np.arange(N) / (SR * .6))
mus *= fade

# ------------------------------------------------------------------ sound effects
sfx = np.zeros(N)


def pop(at, g=.25, f0=500, f1=1000, d=.06):
    t = tt(d); f = f0 + (f1 - f0) * (t / d) ** .5
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45) * np.minimum(1, t * 3000), at, g)


def bubble(at, g=.22):  # chat bubble: two quick tones
    pop(at, g, 620, 900, .05); pop(at + .045, g * .8, 900, 1250, .05)


def plink(at, m, g=.2):
    put(sfx, marimba(m, .6, 1.2), at, g)


def tap(at, g=.18):  # soft card/paper tap
    t = tt(.08)
    s = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 60) + .6 * np.sin(2 * np.pi * 140 * t) * np.exp(-t * 40)
    put(sfx, s, at, g)


def bonk(at, g=.25):
    t = tt(.22); f = 320 * np.exp(-t * 4)
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * np.minimum(1, t * 2000), at, g)


def chime(at, notes, g=.18, gap=.07):
    for i, m in enumerate(notes):
        put(sfx, musicbox(m, 1.6), at + i * gap, g)


def knock(at, g=.3):  # notification
    chime(at, [83, 88], g, .11)


def click(at, g=.25):
    t = tt(.03); put(sfx, hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 200), at, g)


def typing(at, d, g=.035):
    t = at
    while t < at + d:
        click(t, g * (.7 + .6 * rng.random())); t += .05 + rng.random() * .05


PENTA = [72, 74, 76, 79, 81, 84, 86, 88]
pop(S["hi"]["vstart"] + .1, .35, 300, 900, .09); chime(S["hi"]["vstart"] + .45, [79, 84], .12)
pop(L[1] - .1, .18)          # chip
tap(L[2] - .1, .12); tap(L[3] - .1, .12)
pop(L[4] - .3, .18)
for i in range(8):
    plink(L[5] + i * .16, PENTA[i], .16)
    pop(L[5] + 2.0 + i * .08, .1, 1200, 1700, .04)
tap(S["runs"]["vstart"] + .1, .2)
bubble(S["runs"]["vstart"] + .5); bubble(S["runs"]["vstart"] + 1.4)
chime(L[7] - .1, [84, 88], .14)
tap(L[8] + 1.2, .16); bubble(L[9] - .3); bubble(L[9] + .5); bonk(L[9] + .5, .2); bonk(L[9] + 1.3, .22); bonk(L[9] + 1.45, .16)
pop(S["nobody"]["vstart"] + .1, .14)
chime(L[11] + .4, [79, 83, 86, 91], .12, .05)
tap(S["dig"]["vstart"] + .1, .2)
for i, st in enumerate([L[13] + .1, L[13] + 1.3, L[14] + .2, L[15] + .3]):
    typing(st, .7); plink(st + .6, [76, 79, 81, 84][i], .2)
plink(L[16] + .6, 79, .2)
for k in range(3):
    pop(L[17] + .5 + k * .5, .12, 900 + k * 150, 1300 + k * 150, .05)
plink(L[18] - .1 + .4, 84, .16)
chime(L[18] - .1, [76, 79, 84, 88], .18, .06)
knock(S["slack"]["vstart"] + .35)
for k in range(3):
    pop(S["slack"]["vstart"] + .8 + k * .5, .08, 700, 950, .04)
click(L[20] + 1.1, .35); chime(L[20] + 1.2, [84, 91], .12)
pop(S["tagline"]["vstart"] + .2, .14); pop(L[22] - .1, .14, 600, 1100)
tap(S["sdk"]["vstart"] + .1, .15)
typing(S["sdk"]["vstart"] + .4, .7); typing(S["sdk"]["vstart"] + 1.3, .8)
for k, d in enumerate((1.9, 2.2, 2.5)):
    plink(S["sdk"]["vstart"] + .4 + d, [79, 81, 84][k], .13)
pop(S["end"]["vstart"] + .3, .25, 300, 900, .09)

# ------------------------------------------------------------------ mix
vo48 = np.load("vo.npy")
# vo.npy is 44.1 kHz: resample to 48 kHz
x_old = np.arange(len(vo48)) / 44100
x_new = np.arange(int(len(vo48) * SR / 44100)) / SR
vo = np.interp(x_new, x_old, vo48)
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
frame = 960
env = np.repeat([np.sqrt(np.mean(vo[i:i + frame] ** 2)) for i in range(0, N, frame)], frame)[:N]
duck = lp(np.where(env > .01, .5, 1.0), 4.0)
mix = vo * 1.0 + mus * .14 * duck + sfx * .7
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix = mix / np.abs(mix).max() * .9
music_only = mus * .14 * duck / np.abs(mix).max()
dl = int(.011 * SR)
left, right = mix.copy(), mix.copy()
left[dl:] += .1 * music_only[:-dl]; right[:-dl] += .1 * music_only[dl:]
out = np.clip(np.stack([left, right], 1), -1, 1)
with wave.open("mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print("mix", out.shape[0] / SR)
