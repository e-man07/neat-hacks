const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const tl = JSON.parse(fs.readFileSync("timeline.json"));
  const amp = JSON.parse(fs.readFileSync("amp.json"));
  const FPS = 30, frames = Math.round(tl.total * FPS);
  fs.mkdirSync("frames", { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript(([tl, amp]) => { window.TIMELINE = tl; window.FPS = 30; window.AMP = amp; }, [tl, amp]);
  await p.goto("file://" + process.cwd() + "/scene.html");
  await p.evaluate(() => document.fonts.ready);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await p.evaluate(([t, f]) => window.render(t, f), [f / FPS, f]);
    await p.screenshot({ path: `frames/${String(f).padStart(5, "0")}.jpg`, type: "jpeg", quality: 90 });
    if (f % 150 === 0) console.log(f, "/", frames, Math.round((Date.now() - t0) / 1000) + "s");
  }
  await b.close();
  console.log("done", frames);
})();
