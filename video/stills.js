const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const tl = JSON.parse(fs.readFileSync("timeline.json"));
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript((tl) => { window.TIMELINE = tl; window.FPS = 30; window.AMP = []; }, tl);
  await p.goto("file://" + process.cwd() + "/scene.html");
  await p.evaluate(() => document.fonts.ready);
  const times = process.argv.slice(2).map(Number);
  for (const t of times) {
    await p.evaluate(([t]) => window.render(t, Math.round(t * 30)), [t]);
    await p.screenshot({ path: `still_${t}.jpg`, type: "jpeg", quality: 80 });
  }
  await b.close();
})();
