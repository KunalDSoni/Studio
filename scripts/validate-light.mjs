// Captures the five stages at desktop + mobile sizes, plus the handoff pair.
const { chromium } = await import("playwright-core");

const STOPS = [0, 0.25, 0.5, 0.75, 1];
const NAMES = ["morning", "latemorning", "afternoon", "golden", "evening"];

async function run(width, height, tag) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // handoff pair: story authority vs slider authority, untouched slider
  for (const p of [0.92, 0.99]) {
    await page.evaluate((prog) => {
      const track = document.querySelector("#experience-track");
      const top = track.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * prog);
    }, p);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: `scripts/out/${tag}-handoff-p${p * 100}.png` });
  }

  // five stages via real thumb drags
  const box = await page.locator(".timeslider__track").boundingBox();
  const cy = box.y + box.height / 2;
  for (let i = 0; i < STOPS.length; i++) {
    await page.mouse.move(box.x + box.width * 0.5, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.max(2, box.width * STOPS[i] - 1), cy, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `scripts/out/${tag}-${NAMES[i]}.png` });
  }
  await browser.close();
}

await run(1280, 800, "desktop");
await run(390, 844, "mobile");
console.log("done — inspect scripts/out/");
