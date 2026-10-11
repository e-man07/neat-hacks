# The Nightly explainer video

A ~67 s, 1080p60 motion-design explainer for the hero: Nightly, the ghost, tells the story of one bad night,
with conversational captions, Inkbox-style UI cards, a code-generated soundtrack and an ElevenLabs voiceover.

```bash
cd video
python voice.py                 # ElevenLabs TTS per line (ELEVENLABS_API_KEY in ../.env) -> timeline.json, vo.npy, amp.json
python audio.py                 # marimba track + soft UI sound effects (numpy/scipy), ducked under the voice -> mix.wav
node render.js 0 4039           # renders scene.html frame by frame (60 fps, lossless PNG) -> frames/ ; split the range across workers
ffmpeg -framerate 60 -i frames/%05d.png -i mix.wav -c:v libx264 -crf 10 -tune animation -pix_fmt yuv420p \
  -c:a aac -b:a 320k -af loudnorm=I=-16 -shortest nightly-master-1080p60.mp4
node stills.js 5 18 32          # quick stills while editing
```

- `scene.html`: the whole film as a pure function `render(t)`. The ghost (`ghost-blank.png`, its face painted
  out) gets a vector face that blinks, looks at the cards, worries, sleeps, winks and lip-syncs to the voice
- `logos.json`: agent logos from simple-icons for the "I look after AI agents" ring
- `audio.py`: 100 BPM marimba, pad, bass and shaker; a music-box lullaby while "everyone's asleep"; pops, plinks,
  a gentle bonk, a notification knock, a click and chimes, all timed from the voiceover

The site plays the copy in `web/public/video/`, or a full-quality master from `NEXT_PUBLIC_HERO_VIDEO_URL`.
