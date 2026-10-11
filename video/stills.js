const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const tl = JSON.parse(fs.readFileSync("timeline.json")), amp = JSON.parse(fs.readFileSync("amp.json")), logos = JSON.parse(fs.readFileSync("logos.json"));
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on("pageerror", e => console.log("ERR", e.message));
  await p.addInitScript(([tl, amp, logos]) => { window.TIMELINE = tl; window.FPS = 60; window.AMP = amp; window.LOGOS = logos; }, [tl, amp, logos]);
  await p.goto("file://" + process.cwd() + "/scene.html");
  await p.evaluate(() => document.fonts.ready);
  for (const t of process.argv.slice(2).map(Number)) {
    await p.evaluate(([t]) => window.render(t, Math.round(t * 60)), [t]);
    await p.waitForTimeout(60);
    await p.screenshot({ path: `st_${t}.png` });
  }
  await b.close();
})();
