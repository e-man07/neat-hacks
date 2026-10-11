# The Nightly explainer video

A ~50 s motion-design explainer (the hero video on the site): Nightly, the ghost, explains what it does,
with captions, UI scenes, a code-generated soundtrack and an ElevenLabs voiceover.

```bash
cd video
python voice.py                     # ElevenLabs TTS per line -> timeline.json, vo.npy, amp.json
python audio.py                     # music + sound effects in numpy/scipy, mixed under the voice -> mix.wav
node render.js                      # renders scene.html frame by frame with Playwright -> frames/
ffmpeg -framerate 30 -i frames/%05d.jpg -i mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -c:a aac -af loudnorm=I=-16 -shortest nightly-1080p.mp4
node stills.js 5 18 32              # quick stills while editing
```

- `script.json`: the lines and which scene each belongs to
- `scene.html`: the whole animation as a pure function `render(t)`. The ghost (`ghost.png`) bobs,
  blinks and lip-syncs to the voice envelope; every scene is timed from the voiceover's word timestamps
- `audio.py`: an 84 BPM night-time track (pads, plucked arpeggio, bass, brushed drums), a tension drone,
  and synced sound effects (pops, whooshes, ticks, error blips, typing, a Slack-style notification, an end chime)
