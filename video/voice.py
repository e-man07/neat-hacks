"""Voiceover with ElevenLabs (per line, with character timestamps) -> timeline.json, vo.npy, amp.json.
Needs ELEVENLABS_API_KEY in the repo .env. Run from this folder: python voice.py"""
import base64, json, os, subprocess, urllib.request, wave
import numpy as np

KEY = [l.split("=", 1)[1].strip() for l in open("../.env") if l.startswith("ELEVENLABS_API_KEY=")][0]
VOICE = "cgSgspJ2msm6clMCkdW9"  # premade voice closest in pitch to the reference
SR, FPS = 44100, 60
PAD_AFTER = {"hi": .45, "fact": .45, "watch": .6, "runs": .5, "deploy": .55, "nobody": .5, "dig": .6, "fix": .55,
             "slack": .7, "tagline": .6, "sdk": .9, "end": 2.6}
os.makedirs("vo", exist_ok=True)
lines = json.load(open("script.json"))
for i, l in enumerate(lines):
    if os.path.exists(f"vo/{i:02d}.json"):
        continue
    body = {"text": l["text"], "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": .32, "similarity_boost": .8, "style": .6, "use_speaker_boost": True},
            "previous_text": lines[i - 1]["text"] if i else None, "next_text": lines[i + 1]["text"] if i + 1 < len(lines) else None}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    open(f"vo/{i:02d}.mp3", "wb").write(base64.b64decode(d["audio_base64"]))
    json.dump(d["alignment"], open(f"vo/{i:02d}.json", "w"))

# timeline
t, out, prev = .9, [], None
for i, l in enumerate(lines):
    al = json.load(open(f"vo/{i:02d}.json"))
    if prev and prev != l["scene"]:
        t += PAD_AFTER[prev]
    elif prev:
        t += .22
    words, cur, ws, pe = [], "", 0, 0
    for c, a, b in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if c == " ":
            if cur:
                words.append({"w": cur, "s": round(t + ws, 3), "e": round(t + pe, 3)}); cur = ""
            continue
        if not cur:
            ws = a
        cur += c; pe = b
    if cur:
        words.append({"w": cur, "s": round(t + ws, 3), "e": round(t + pe, 3)})
    dur = al["character_end_times_seconds"][-1]
    out.append({"i": i, "scene": l["scene"], "text": l["text"], "start": round(t, 3), "end": round(t + dur, 3), "words": words})
    t += dur; prev = l["scene"]
total = round(t + PAD_AFTER[prev], 2)
scenes = []
for o in out:
    if not scenes or scenes[-1]["id"] != o["scene"]:
        scenes.append({"id": o["scene"], "start": o["start"]})
for a, b in zip(scenes, scenes[1:]):
    a["end"] = b["start"]
scenes[-1]["end"] = total
for s in scenes:
    s["vstart"] = round(max(0, s["start"] - .35), 3)
json.dump({"total": total, "lines": out, "scenes": scenes}, open("timeline.json", "w"), indent=1)

# voice track + mouth envelope
N = int(total * SR) + SR
vo = np.zeros(N, np.float32)
for o in out:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"vo/{o['i']:02d}.mp3", "-ac", "1", "-ar", str(SR), "/tmp/_l.wav"], check=True)
    w = wave.open("/tmp/_l.wav"); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    s = int(o["start"] * SR); vo[s:s + len(x)] += x[:N - s]
np.save("vo.npy", vo)
hop = SR // FPS
env = np.array([np.sqrt(np.mean(vo[i * hop:(i + 1) * hop] ** 2)) for i in range(int(total * FPS) + 1)])
env = np.clip(env / np.percentile(env[env > .005], 95), 0, 1.2)
json.dump([round(float(v), 3) for v in np.convolve(env, [.25, .5, .25], "same")], open("amp.json", "w"))
print("timeline", total, "s")
