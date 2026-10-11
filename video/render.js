const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const [a, bEnd] = process.argv.slice(2).map(Number);
  const tl = JSON.parse(fs.readFileSync("timeline.json")), amp = JSON.parse(fs.readFileSync("amp.json")), logos = JSON.parse(fs.readFileSync("logos.json"));
  const FPS = 60;
  fs.mkdirSync("frames", { recursive: true });
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
  const p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript(([tl, amp, logos]) => { window.TIMELINE = tl; window.FPS = 60; window.AMP = amp; window.LOGOS = logos; }, [tl, amp, logos]);
  await p.goto("file://" + process.cwd() + "/scene.html");
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => (i.onload = r)))));
  const t0 = Date.now();
  for (let f = a; f < bEnd; f++) {
    await p.evaluate(([t, f]) => window.render(t, f), [f / FPS, f]);
    await p.screenshot({ path: `frames/${String(f).padStart(5, "0")}.png` });
    if ((f - a) % 300 === 0) console.log(a, f, Math.round((Date.now() - t0) / 1000) + "s");
  }
  await br.close();
  console.log("done", a, bEnd);
})();
