const { chromium } = await import("playwright-core");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const track = document.querySelector("#experience-track");
  const top = track.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, top + (track.offsetHeight - window.innerHeight));
});
await page.waitForTimeout(7000);
await page.screenshot({ path: "scripts/out/slider-visible.png" });
// drag the thumb to the far left (Morning)
const box = await page.locator(".timeslider__track").boundingBox();
const cy = box.y + box.height / 2;
await page.mouse.move(box.x + box.width * 0.75, cy);
await page.mouse.down();
await page.mouse.move(box.x + 2, cy, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(4000);
await page.screenshot({ path: "scripts/out/slider-morning.png" });
await browser.close();
