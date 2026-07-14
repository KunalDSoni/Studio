# Experience Through Light — Part 1: Time Engine + Slider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A time-of-day slider that fades in when the scroll story ends and lets the visitor drag the environment from Morning to blue-hour Evening with zero jumps.

**Architecture:** A pure keyframe-interpolation module (`lib/environment.ts`, no three.js dependency) defines five art-directed environment states. `Scene.tsx` becomes the single lighting authority: each frame it blends story-driven lighting with `envAt(store.time)` using a handoff weight `w = seg(progress, 0.93, 0.985)`, and publishes scalar levels through the store that `Interior` and `Effects` read. A DOM-overlay slider (Hud idiom: rAF + style mutation, no React re-renders) writes `store.timeTarget`.

**Tech Stack:** Next.js 15 / React 19 / three.js + @react-three/fiber (existing), node:test with Node 26 native type-stripping (unit tests), playwright-core (already in node_modules, visual validation).

**Spec:** `docs/superpowers/specs/2026-07-14-experience-through-light-design.md`

## Global Constraints

- Zero per-frame allocations in any `useFrame`/rAF loop (existing codebase idiom): pre-allocate every `Color`/`Vector3`/state object; mutate in place.
- The scroll story (p < 0.93) must render *pixel-identical* to today. All new behavior is gated by `w = seg(p, 0.93, 0.985)`.
- Golden Hour keyframe values are FIXED by handoff (do not tune): sun `#ffd3a0` intensity 2.5 at position `[7, 5.5, 15]`; hemi `#fff6e6`/`#d8c9b2` at 0.75; practicals 1.0 (= lamp 3.4, ceiling 4.2, pendant 1.6, shade emissive 1.5, pendant-glass 1.9, cove 2.6); sheer opacity 0.36; bloom 0.38; background/fog `#f1ece1`.
- Mobile-first: slider works with one thumb, touch target ≥ 44px, tested at 390×844.
- No clipping / floating geometry in any validated frame (Design Bible).
- Dev server assumed running at `http://localhost:3000` (`npm run dev`). Validation scripts live in `scripts/` inside the repo, so `await import("playwright-core")` resolves against the repo's node_modules; run them from the repo root.
- Other stage color values are starting points; Task 4 tunes them visually.

---

### Task 1: Environment engine (`lib/environment.ts`)

**Files:**
- Create: `lib/environment.ts`
- Test: `scripts/environment.test.ts`
- Modify: `tsconfig.json` (exclude `scripts` from the Next typecheck so `.ts`-extension imports in the node:test file don't fail `tsc --noEmit`)

**Interfaces:**
- Consumes: nothing (pure module; MUST NOT import three.js or use the `@/` alias — keeps it runnable under plain `node --test`)
- Produces (used by Tasks 2 and 3):
  - `type Rgb = [number, number, number]` (0–1 floats)
  - `interface EnvState { sunAzimuth: number; sunElevation: number; sunColor: Rgb; sunIntensity: number; hemiSky: Rgb; hemiGround: Rgb; hemiIntensity: number; bg: Rgb; practicals: number; sheerOpacity: number; bloom: number }`
  - `const SUN_RADIUS = 17.44`
  - `const STAGE_NAMES = ["Morning", "Late Morning", "Afternoon", "Golden Hour", "Evening"]`
  - `function createEnvState(): EnvState`
  - `function envAt(t: number, out: EnvState): EnvState` — clamps t to [0,1], interpolates between adjacent keyframes, writes into `out`, returns `out`, allocates nothing.

- [ ] **Step 1: Write the failing test**

Create `scripts/environment.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { envAt, createEnvState, STAGE_NAMES, SUN_RADIUS } from "../lib/environment.ts";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test("golden hour keyframe reproduces the story-end lighting exactly", () => {
  const s = envAt(0.75, createEnvState());
  close(s.sunIntensity, 2.5);
  // #ffd3a0 → 255/211/160
  close(s.sunColor[0], 1, 1e-3);
  close(s.sunColor[1], 211 / 255, 1e-3);
  close(s.sunColor[2], 160 / 255, 1e-3);
  close(s.hemiIntensity, 0.75);
  close(s.practicals, 1);
  close(s.sheerOpacity, 0.36);
  close(s.bloom, 0.38);
  // azimuth/elevation must resolve to the current sun position [7, 5.5, 15]
  const az = (s.sunAzimuth * Math.PI) / 180;
  const el = (s.sunElevation * Math.PI) / 180;
  close(SUN_RADIUS * Math.cos(el) * Math.sin(az), 7, 0.05);
  close(SUN_RADIUS * Math.sin(el), 5.5, 0.05);
  close(SUN_RADIUS * Math.cos(el) * Math.cos(az), 15, 0.05);
});

test("clamps t outside [0,1]", () => {
  const a = envAt(-5, createEnvState());
  const b = envAt(0, createEnvState());
  assert.deepEqual(a, b);
  const c = envAt(7, createEnvState());
  const d = envAt(1, createEnvState());
  assert.deepEqual(c, d);
});

test("midpoint between stops is the average of the two keyframes", () => {
  const a = envAt(0.75, createEnvState());
  const b = envAt(1.0, createEnvState());
  const mid = envAt(0.875, createEnvState());
  close(mid.sunIntensity, (a.sunIntensity + b.sunIntensity) / 2);
  close(mid.practicals, (a.practicals + b.practicals) / 2);
  close(mid.bg[0], (a.bg[0] + b.bg[0]) / 2);
});

test("envAt reuses the out object (no per-call allocation)", () => {
  const out = createEnvState();
  const ret = envAt(0.3, out);
  assert.equal(ret, out);
  const sunColorRef = out.sunColor;
  envAt(0.9, out);
  assert.equal(out.sunColor, sunColorRef, "inner arrays must be reused");
});

test("stage names cover the five stops", () => {
  assert.equal(STAGE_NAMES.length, 5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/environment.test.ts`
Expected: FAIL — `Cannot find module '../lib/environment.ts'`

- [ ] **Step 3: Write the implementation**

Create `lib/environment.ts`:

```ts
// Pure time-of-day environment model. No three.js imports — this module is
// unit-tested under plain `node --test` and consumed by Scene/TimeSlider.

export type Rgb = [number, number, number];

export interface EnvState {
  sunAzimuth: number;   // degrees; 0 = +Z, positive toward +X
  sunElevation: number; // degrees above horizon
  sunColor: Rgb;
  sunIntensity: number;
  hemiSky: Rgb;
  hemiGround: Rgb;
  hemiIntensity: number;
  bg: Rgb;              // scene background + fog color
  practicals: number;   // 0..n master level for interior lights/emissives
  sheerOpacity: number;
  bloom: number;
}

/** distance of the sun light from origin — matches |[7, 5.5, 15]| */
export const SUN_RADIUS = 17.44;

export const STAGE_NAMES = [
  "Morning",
  "Late Morning",
  "Afternoon",
  "Golden Hour",
  "Evening",
] as const;

const hex = (h: number): Rgb => [
  ((h >> 16) & 255) / 255,
  ((h >> 8) & 255) / 255,
  (h & 255) / 255,
];

// Keyframes at t = 0, 0.25, 0.5, 0.75, 1. Golden Hour (index 3) is FIXED —
// it must equal the scroll story's final lighting so the handoff is invisible.
// (#ffd3a0 sun at the bearing of [7, 5.5, 15]: azimuth 25°, elevation 18.4°.)
const KEYS: EnvState[] = [
  { // Morning — low eastern sun, cool pale gold, long shadows
    sunAzimuth: 85, sunElevation: 13,
    sunColor: hex(0xffe9c4), sunIntensity: 1.7,
    hemiSky: hex(0xf2f6f0), hemiGround: hex(0xcfc4ae), hemiIntensity: 1.0,
    bg: hex(0xedefe6), practicals: 0, sheerOpacity: 0.3, bloom: 0.06,
  },
  { // Late Morning — climbing whiter sun, crisper shadows
    sunAzimuth: 60, sunElevation: 38,
    sunColor: hex(0xfff4dd), sunIntensity: 2.1,
    hemiSky: hex(0xf4f7f3), hemiGround: hex(0xd6cab2), hemiIntensity: 1.1,
    bg: hex(0xf2f1e8), practicals: 0, sheerOpacity: 0.3, bloom: 0.04,
  },
  { // Afternoon — high neutral-warm sun, shortest shadows
    sunAzimuth: 40, sunElevation: 55,
    sunColor: hex(0xfff9ea), sunIntensity: 2.3,
    hemiSky: hex(0xf7f5ec), hemiGround: hex(0xdccfb6), hemiIntensity: 1.15,
    bg: hex(0xf4efe2), practicals: 0, sheerOpacity: 0.32, bloom: 0.05,
  },
  { // Golden Hour — FIXED: equals the story-end state
    sunAzimuth: 25, sunElevation: 18.4,
    sunColor: hex(0xffd3a0), sunIntensity: 2.5,
    hemiSky: hex(0xfff6e6), hemiGround: hex(0xd8c9b2), hemiIntensity: 0.75,
    bg: hex(0xf1ece1), practicals: 1, sheerOpacity: 0.36, bloom: 0.38,
  },
  { // Evening — blue hour: sun gone, slate fill keeps shadow shape
    sunAzimuth: 10, sunElevation: 6,
    sunColor: hex(0x7d8bb0), sunIntensity: 0.22,
    hemiSky: hex(0x46506b), hemiGround: hex(0x3a3630), hemiIntensity: 0.5,
    bg: hex(0x2e3547), practicals: 1.3, sheerOpacity: 0.5, bloom: 0.55,
  },
];

export function createEnvState(): EnvState {
  return {
    sunAzimuth: 0, sunElevation: 0,
    sunColor: [0, 0, 0], sunIntensity: 0,
    hemiSky: [0, 0, 0], hemiGround: [0, 0, 0], hemiIntensity: 0,
    bg: [0, 0, 0], practicals: 0, sheerOpacity: 0, bloom: 0,
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function lerp3(a: Rgb, b: Rgb, k: number, out: Rgb): void {
  out[0] = lerp(a[0], b[0], k);
  out[1] = lerp(a[1], b[1], k);
  out[2] = lerp(a[2], b[2], k);
}

/** Interpolated environment at time t (0..1, clamped). Writes into `out`. */
export function envAt(t: number, out: EnvState): EnvState {
  const x = Math.min(1, Math.max(0, t)) * (KEYS.length - 1);
  const i = Math.min(KEYS.length - 2, Math.floor(x));
  const k = x - i;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  out.sunAzimuth = lerp(a.sunAzimuth, b.sunAzimuth, k);
  out.sunElevation = lerp(a.sunElevation, b.sunElevation, k);
  lerp3(a.sunColor, b.sunColor, k, out.sunColor);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, k);
  lerp3(a.hemiSky, b.hemiSky, k, out.hemiSky);
  lerp3(a.hemiGround, b.hemiGround, k, out.hemiGround);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, k);
  lerp3(a.bg, b.bg, k, out.bg);
  out.practicals = lerp(a.practicals, b.practicals, k);
  out.sheerOpacity = lerp(a.sheerOpacity, b.sheerOpacity, k);
  out.bloom = lerp(a.bloom, b.bloom, k);
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/environment.test.ts`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Keep `tsc --noEmit` clean**

`scripts/environment.test.ts` imports with an explicit `.ts` extension (required by node's type-stripping loader) which Next's tsconfig rejects. Exclude the scripts dir: in `tsconfig.json`, change the `"exclude"` array to include `"scripts"` (e.g. `"exclude": ["node_modules", "scripts"]`).

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add lib/environment.ts scripts/environment.test.ts tsconfig.json
git commit -m "feat: time-of-day environment engine with five keyframed stages"
```

---

### Task 2: Single lighting authority — store + Scene blend, Interior/Effects consumers

**Files:**
- Modify: `lib/store.ts` (add fields)
- Modify: `components/three/Scene.tsx` (blend story ↔ time env; publish scalars)
- Modify: `components/three/Interior.tsx:595-611` (read scalars instead of computing lightP)
- Modify: `components/three/Effects.tsx` (read `store.bloomLevel`)

**Interfaces:**
- Consumes (Task 1): `envAt(t, out)`, `createEnvState()`, `SUN_RADIUS`, `EnvState`.
- Produces (Task 3 relies on): `store.time` (smoothed 0..1, initial 0.75), `store.timeTarget` (raw, initial 0.75). Also publishes `store.lightLevel`, `store.sheerLevel`, `store.bloomLevel` (read-only for everyone but Scene).

- [ ] **Step 1: Add store fields**

In `lib/store.ts`, after `pendingClick: false,` add:

```ts
  /** time of day, 0 Morning .. 1 Evening; smoothed by the Scene loop */
  time: 0.75,
  /** raw slider value the Scene loop eases `time` toward */
  timeTarget: 0.75,
  /** blended master level for interior practicals (Scene writes, others read) */
  lightLevel: 0,
  /** blended sheer-curtain opacity (Scene writes, Interior reads) */
  sheerLevel: 0,
  /** blended bloom intensity (Scene writes, Effects reads) */
  bloomLevel: 0,
```

- [ ] **Step 2: Rework Scene.tsx lighting choreography**

In `components/three/Scene.tsx`:

a) Add imports: `import { envAt, createEnvState, SUN_RADIUS } from "@/lib/environment";` and add `easeInOut` to the store import.

b) The scene background is currently the shared `PAPER` const — it must become mutable per-frame. Replace the background/fog `useMemo` with:

```ts
  const bgColor = useMemo(() => new THREE.Color(PAPER), []);
  useMemo(() => {
    scene.background = bgColor;
    scene.fog = new THREE.Fog(PAPER, 26, 70);
  }, [scene, bgColor]);
```

c) Pre-allocate blend workspace next to the other refs (no per-frame allocation):

```ts
  const env = useMemo(() => createEnvState(), []);
  const blend = useMemo(
    () => ({
      sunColor: new THREE.Color(),
      hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(),
      bg: new THREE.Color(),
      storySun: new THREE.Color("#ffd3a0"),
      storyHemiSky: new THREE.Color("#fff6e6"),
      storyHemiGround: new THREE.Color("#d8c9b2"),
      storyBg: new THREE.Color(PAPER),
      sunPos: new THREE.Vector3(),
    }),
    []
  );
```

d) Replace the entire `// -- lighting choreography` block (currently the `lightP`/`interiorP` computations and the five `if (x.current)` statements) with:

```ts
    // -- lighting: story authority blended with the time-of-day engine -------
    store.time += (store.timeTarget - store.time) * Math.min(1, dt * 3.2);
    const w = seg(p, 0.93, 0.985); // 0 = scroll story owns light, 1 = slider owns it
    envAt(store.time, env);

    const lightP = seg(p, 0.64, 0.76);
    const interiorP = seg(p, 0.74, 0.9);
    const furnP = easeInOut(seg(p, 0.55, 0.72));

    // published scalars — Interior and Effects read these
    store.lightLevel = lightP * (1 - w) + env.practicals * w;
    store.sheerLevel =
      0.36 * seg(furnP, 0.82, 1) * (1 - w) + env.sheerOpacity * w;
    store.bloomLevel =
      seg(p, 0.64, 0.78) * 0.38 * (1 - w) + env.bloom * w;

    if (sun.current) {
      sun.current.intensity =
        (0.6 + lightP * 1.9) * (1 - w) + env.sunIntensity * w;
      blend.sunColor
        .setRGB(env.sunColor[0], env.sunColor[1], env.sunColor[2])
        .lerpColors(blend.storySun, blend.sunColor, w);
      sun.current.color.copy(blend.sunColor);
      const az = (env.sunAzimuth * Math.PI) / 180;
      const el = (env.sunElevation * Math.PI) / 180;
      blend.sunPos.set(
        SUN_RADIUS * Math.cos(el) * Math.sin(az),
        SUN_RADIUS * Math.sin(el),
        SUN_RADIUS * Math.cos(el) * Math.cos(az)
      );
      sun.current.position.set(7, 5.5, 15).lerp(blend.sunPos, w);
    }
    if (hemi.current) {
      hemi.current.intensity =
        (1.05 - interiorP * 0.3) * (1 - w) + env.hemiIntensity * w;
      blend.hemiSky
        .setRGB(env.hemiSky[0], env.hemiSky[1], env.hemiSky[2])
        .lerpColors(blend.storyHemiSky, blend.hemiSky, w);
      hemi.current.color.copy(blend.hemiSky);
      blend.hemiGround
        .setRGB(env.hemiGround[0], env.hemiGround[1], env.hemiGround[2])
        .lerpColors(blend.storyHemiGround, blend.hemiGround, w);
      hemi.current.groundColor.copy(blend.hemiGround);
    }
    if (lamp.current) lamp.current.intensity = 3.4 * store.lightLevel;
    if (ceiling.current) ceiling.current.intensity = 4.2 * store.lightLevel;
    if (pendant.current) pendant.current.intensity = 1.6 * store.lightLevel;

    blend.bg
      .setRGB(env.bg[0], env.bg[1], env.bg[2])
      .lerpColors(blend.storyBg, blend.bg, w);
    bgColor.copy(blend.bg);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(blend.bg);
```

Note on equivalence: at `w = 0` every expression reduces to today's exact formulas (lamp `3.4 * lightP`, sun `0.6 + lightP * 1.9`, background `PAPER`, …), so the story is pixel-identical. At `w = 1` with `time = 0.75` the Golden Hour keyframe reproduces the same values, so the handoff is invisible.

- [ ] **Step 3: Interior reads the published scalars**

In `components/three/Interior.tsx`, in the `useFrame` at the bottom, replace:

```ts
    const lightP = seg(p, 0.64, 0.76);
```
(delete that line — `seg` stays imported for `furnP`) and replace the four `fx` lines with:

```ts
    const f = fx.current;
    const L = store.lightLevel;
    if (f.lampShade) f.lampShade.emissiveIntensity = 1.5 * L;
    if (f.pendantGlass) f.pendantGlass.emissiveIntensity = 1.9 * L;
    if (f.cove) f.cove.emissiveIntensity = 2.6 * L;
    if (f.sheer) f.sheer.opacity = store.sheerLevel;
```

- [ ] **Step 4: Effects reads the published scalar**

In `components/three/Effects.tsx`, replace the `useFrame` body with:

```ts
    if (bloom.current) {
      bloom.current.intensity = store.bloomLevel;
    }
```
Remove the now-unused `seg` import.

- [ ] **Step 5: Typecheck and story-regression screenshots**

Run: `npx tsc --noEmit` — expected clean.

With the dev server running, capture the story at p = 0.78 and p = 0.92 using the scratch script pattern (adjust the absolute playwright-core path):

```js
// scripts/story-check.mjs
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
```

Run: `mkdir -p scripts/out && node scripts/story-check.mjs`, then LOOK at both images. Expected: indistinguishable from the pre-change captures (golden-hour interior, lit lamps). Any color/intensity difference at p ≤ 0.92 is a blend-math bug — stop and fix.

- [ ] **Step 6: Commit**

```bash
git add lib/store.ts components/three/Scene.tsx components/three/Interior.tsx components/three/Effects.tsx scripts/story-check.mjs
git commit -m "feat: single lighting authority blending scroll story with time engine"
```

---

### Task 3: TimeSlider overlay

**Files:**
- Create: `components/TimeSlider.tsx`
- Modify: `app/page.tsx` (mount next to `<Hud />`)
- Modify: `app/globals.css` (append `.timeslider` block after the HUD styles)

**Interfaces:**
- Consumes: `store.progress`, `store.time` (read), `store.timeTarget` (write), `STAGE_NAMES` from `@/lib/environment`, `seg` from `@/lib/store`.
- Produces: none (leaf UI component).

- [ ] **Step 1: Write the component**

Create `components/TimeSlider.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { store, seg } from "@/lib/store";
import { STAGE_NAMES } from "@/lib/environment";

// Thumb tints per stage (morning cool-gold → evening indigo)
const THUMB_COLORS = ["#f4d9a6", "#f7ecd2", "#f9f3e2", "#f2b268", "#4a5474"];

export function TimeSlider() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const lastStage = useRef(-1);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const root = rootRef.current;
      const thumb = thumbRef.current;
      const label = labelRef.current;
      if (!root || !thumb || !label) return;

      const vis = seg(store.progress, 0.93, 0.985);
      root.style.opacity = String(vis);
      root.style.pointerEvents = vis > 0.6 ? "auto" : "none";
      root.style.visibility = vis <= 0.01 ? "hidden" : "visible";

      const t = store.time;
      thumb.style.left = `${t * 100}%`;
      const stage = Math.round(t * (STAGE_NAMES.length - 1));
      if (stage !== lastStage.current) {
        lastStage.current = stage;
        label.textContent = STAGE_NAMES[stage];
        thumb.style.background = THUMB_COLORS[stage];
        root.setAttribute("aria-valuetext", STAGE_NAMES[stage]);
      }
      root.setAttribute("aria-valuenow", String(Math.round(t * 100)));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    store.timeTarget = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  return (
    <div
      ref={rootRef}
      className="timeslider"
      role="slider"
      tabIndex={0}
      aria-label="Time of day"
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const keys = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"];
        if (!keys.includes(e.key)) return;
        e.preventDefault(); // keep arrows from scrolling the page mid-adjust
        if (e.key === "ArrowRight" || e.key === "ArrowUp")
          store.timeTarget = Math.min(1, store.timeTarget + 0.05);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown")
          store.timeTarget = Math.max(0, store.timeTarget - 0.05);
        if (e.key === "Home") store.timeTarget = 0;
        if (e.key === "End") store.timeTarget = 1;
      }}
    >
      <span className="timeslider__label" ref={labelRef}>
        Golden Hour
      </span>
      <div className="timeslider__track" ref={trackRef}>
        {STAGE_NAMES.map((name, i) => (
          <span
            key={name}
            className="timeslider__dot"
            style={{ left: `${(i / (STAGE_NAMES.length - 1)) * 100}%` }}
          />
        ))}
        <div className="timeslider__thumb" ref={thumbRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it**

In `app/page.tsx`, add `import { TimeSlider } from "@/components/TimeSlider";` and render `<TimeSlider />` directly after `<Hud />`.

- [ ] **Step 3: Styles**

Append to `app/globals.css` (after the `.hud__meter-fill` rule):

```css
/* ---- time-of-day slider (appears when the story ends) ---- */
.timeslider {
  position: fixed;
  bottom: max(28px, env(safe-area-inset-bottom, 0px) + 16px);
  left: 50%;
  transform: translateX(-50%);
  width: min(86vw, 420px);
  padding: 14px 10px;
  z-index: 30;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}

.timeslider__label {
  display: block;
  text-align: center;
  margin-bottom: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.timeslider__track {
  position: relative;
  height: 2px;
  background: var(--ink-faint);
  border-radius: 1px;
  /* generous one-thumb hit area */
  padding: 22px 0;
  background-clip: content-box;
}

.timeslider__dot {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ink-soft);
  transform: translate(-50%, -50%);
}

.timeslider__thumb {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f2b268;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 10px rgba(40, 30, 18, 0.35);
  transform: translate(-50%, -50%);
  transition: background 0.5s ease;
}

.timeslider:focus-visible .timeslider__thumb {
  box-shadow: 0 0 0 3px rgba(178, 130, 60, 0.45);
}
```

Note: verify `--ink-soft` / `--ink-faint` exist in `:root` of globals.css (they are used by `.hud__hint`); if named differently, use the HUD's actual variable names.

- [ ] **Step 4: Verify behavior end-to-end**

`npx tsc --noEmit` — clean. Then with the dev server running, drive it headlessly:

```js
// scripts/slider-check.mjs
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
```

Run: `node scripts/slider-check.mjs`, then LOOK at both images. Expected: `slider-visible.png` shows the slider (label "Golden Hour", thumb at 3/4) over the golden interior; `slider-morning.png` shows the thumb at far left, label "Morning", and the room re-lit cool and bright with practicals off. If the light doesn't change, the store wiring is broken — debug before proceeding.

- [ ] **Step 5: Commit**

```bash
git add components/TimeSlider.tsx app/page.tsx app/globals.css scripts/slider-check.mjs
git commit -m "feat: mobile-first time-of-day slider with seamless story handoff"
```

---

### Task 4: Validation suite + art-direction tuning

**Files:**
- Create: `scripts/validate-light.mjs`
- Modify: `lib/environment.ts` (keyframe values only — tuning)

**Interfaces:**
- Consumes: the complete feature from Tasks 1–3.
- Produces: `scripts/out/` screenshot set used as the Design Bible QC record.

- [ ] **Step 1: Write the validation script**

Create `scripts/validate-light.mjs`:

```js
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
```

- [ ] **Step 2: Run it and inspect every frame**

Run: `mkdir -p scripts/out && node scripts/validate-light.mjs` (dev server running).
Expected output: 14 PNGs. LOOK at every one against this checklist (Design Bible QC):

- Handoff: `*-handoff-p92.png` vs `*-handoff-p99.png` visually identical.
- Morning: cool bright light from the opposite side (shadows flipped vs golden), practicals off, no murky/flat frame.
- Late Morning / Afternoon: bright, crisp, believable progression; sky/paper background never clips to white.
- Golden: identical to the story ending.
- Evening: indigo dusk, interior glowing warm, trees silhouetted, room still readable (not crushed black).
- All frames: no clipping, no floating geometry, no dead-black or blown-white regions; slider legible in both light and dark stages (mobile especially).

- [ ] **Step 3: Tune keyframes**

Adjust ONLY the non-golden keyframe values in `lib/environment.ts` (colors, intensities, azimuth/elevation) until every checklist item passes. Typical fixes: Evening hemi too dark → raise `hemiIntensity` toward 0.6; Morning shadows too weak → raise `sunIntensity`; slider label unreadable at Evening → that's a CSS fix (`.timeslider__label` needs a dusk-visible color — consider `color: #d9d5c9` gated by nothing; pick one value readable on both).

After each adjustment: `node --test scripts/environment.test.ts` (golden must stay fixed) and re-run `node scripts/validate-light.mjs`. Iterate until clean.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && node --test scripts/environment.test.ts
```
Expected: clean + 5 passing tests. Re-confirm the replay feel by dragging back and forth in a real browser once (`open http://localhost:3000`, scroll to end, drag): no flicker, no hitching.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-light.mjs lib/environment.ts app/globals.css
git commit -m "feat: validated five-stage art direction for the time engine"
```

---

## Self-review notes

- Spec coverage: engine (Task 1), store/authority/handoff (Task 2), slider UI + a11y + mobile (Task 3), five looks + validation + QC (Task 4). Reduced-motion note from the spec needs no code (slider is user-driven; smoothing prevents flicker). Out-of-scope items untouched.
- The `w`-blend formulas in Task 2 reduce exactly to today's code at `w = 0`; the Golden keyframe locks equality at the handoff — both stated inline for the implementer.
- Type/name consistency: `store.lightLevel` / `sheerLevel` / `bloomLevel` / `time` / `timeTarget`, `envAt` / `createEnvState` / `SUN_RADIUS` / `STAGE_NAMES` used identically across tasks.
