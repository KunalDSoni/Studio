const { chromium } = await import("playwright-core");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
for (const p of [0.78, 0.92]) {
  await page.evaluate((prog) => {
    const track = document.querySelector("#experience-track");
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * prog);
  }, p);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `scripts/out/story-p${p * 100}.png` });
}
await browser.close();
