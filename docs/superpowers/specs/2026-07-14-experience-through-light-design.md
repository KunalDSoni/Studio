# Experience Through Light — Part 1: Time Engine + Slider

**Date:** 2026-07-14
**Status:** Approved design, pending implementation plan

## Vision

Add a time-of-day dimension to the Studio scroll experience. After the scroll
story completes (blank canvas → blueprint → construction → golden-hour
interior), an elegant slider fades in and lets the visitor drag time from
Morning to blue-hour Evening. The house never changes — only sun, sky,
shadows, and light. The transformation must interpolate perfectly smoothly:
no jumps, no flickering, no scene reload.

This is Part 1 of the "Experience Through Light" brief (Design Bible ch. 04).
Later parts, each with their own spec: Part 2 estate landscape, Part 3 ambient
life, Part 4 interior expansion.

## Decisions made with the user

1. **Slider after the story** — the scroll narrative stays exactly as-is;
   the slider takes over the environment only at the end (and hands back on
   scroll-up). Chosen over replacing scroll lighting or a separate mode.
2. **Seamless Golden Hour start** — the slider appears already set to Golden
   Hour, which is defined to equal the story's final lighting. "Begins in
   Morning" from the brief is traded for zero-jump continuity.
3. **Evening = blue-hour twilight**, not full night. No stars/moon; deep
   indigo dusk with the interior carrying the scene. Page frame stays light.
4. **Approach A: art-directed keyframe states** interpolated by a pure
   function — chosen over a physical sky shader (hard to art-direct, GPU
   cost) and baked lightmaps (pipeline overhaul).

## Non-negotiables (Design Bible)

- Mobile-first: one thumb, one slider, ≥44px targets; 90% of visitors are
  on phones.
- Performance before effects: zero per-frame allocations (existing codebase
  idiom), no added postprocessing passes.
- No clipping/intersections; every rendered stage validated by screenshot.
- Replay value: dragging back and forth must stay smooth and delightful.

## Architecture

### 1. Environment engine — `lib/environment.ts` (new)

Five keyframes at `t = 0, 0.25, 0.5, 0.75, 1` (Morning, Late Morning,
Afternoon, Golden Hour, Evening). Each keyframe is plain data:

| Field | Meaning |
|---|---|
| `sunAzimuth`, `sunElevation` | degrees; sun position on a fixed-radius arc |
| `sunColor`, `sunIntensity` | directional light |
| `hemiSky`, `hemiGround`, `hemiIntensity` | hemisphere light |
| `bg` | scene background + fog color (single value, matches fog trick) |
| `practicals` | 0–1 master level for all interior lights and emissives |
| `sheerOpacity` | curtain material opacity |
| `bloom` | bloom effect intensity |

`envAt(t, out)` — pure, allocation-free interpolation between adjacent
keyframes (colors via `Color.lerpColors`, scalars via lerp; `out` is a
pre-allocated working state). Sun world position derives from
azimuth/elevation, so shadows rotate physically via the existing shadow map.

**Golden Hour keyframe constraint:** its values must reproduce exactly the
current story-end lighting (sun `#ffd3a0` at the current bearing of
`[7, 5.5, 15]`, lamp 3.4 / ceiling 4.2 / pendant 1.6 at `practicals = 1`,
bloom 0.38, hemi 0.75). This is what makes the handoff invisible.

### 2. Store + single lighting authority — `lib/store.ts`, `Scene.tsx`

- Store gains `time` (smoothed, initial 0.75) and `timeTarget` (raw slider
  value). Scene's existing priority −2 loop smooths `time` toward
  `timeTarget`, so even a tap-to-jump glides.
- Handoff weight `w = seg(progress, 0.93, 0.985)` (mirrors the scroll
  meter's fade-out). Scene blends story-authored lighting (current formulas,
  unchanged) with `envAt(time)` by `w`, and writes the results to sun, hemi,
  background, fog, and point lights.
- **Consolidation:** today `Scene`, `Interior`, and `Effects` each derive
  light levels from scroll independently. After this change Scene computes
  two blended scalars — `store.lightLevel` (practicals) and
  `store.sheerLevel` (curtain opacity) —;
  Interior's cove/lampshade/pendant-glass/sheer emissives and Effects' bloom
  read it. One authority; Part 2's garden lights plug into the same scalar.
- Scroll-up returns control the same way; the slider value persists.

### 3. Slider UI — `components/TimeSlider.tsx` (new)

DOM overlay following the `Hud.tsx` idiom: rAF loop reads the store and
mutates styles; no React re-renders.

- Bottom-center, max-width ~420px; horizontal track, five tick dots, one
  sun-disc thumb whose color warms/cools with `t`; stage label crossfades
  above the thumb.
- Pointer-capture drag + tap-to-jump (writes `store.timeTarget`; smoothing
  happens in Scene). Touch target ≥44px.
- Fades in over `p 0.93 → 0.985`; `pointer-events` disabled until visible.
- Accessible: `role="slider"`, arrow keys step time, `aria-valuetext` =
  stage name.

### 4. The five looks (art direction)

Color values below are starting points; final values are tuned visually
against screenshots during implementation. Golden Hour is the exception —
it is fixed by the handoff constraint.

- **Morning (0):** low eastern sun, cool pale gold `~#ffe9c4`, long soft
  shadows raking west, bright cool-cream sky, practicals off, sheers bright.
- **Late Morning (0.25):** sun climbing, whiter light, crisper shorter
  shadows, sky brightest.
- **Afternoon (0.5):** high sun, neutral-warm, shortest shadows, warmest
  bright ambient, practicals off.
- **Golden Hour (0.75):** identical to today's story ending. Untouched.
- **Evening (1):** sun below horizon — directional light becomes a faint
  slate-blue fill (keeps shadow shape), deep indigo `~#2e3547` sky/fog,
  dusk-blue hemisphere, practicals ×1.3 warm, sheers glowing, bloom ~0.55,
  exterior trees reading as silhouettes.

## Data flow

```
slider drag/tap/keys → store.timeTarget
Scene loop (−2):      store.time ← smooth(timeTarget)
                      w ← seg(progress, 0.93, 0.985)
                      env ← blend(storyLighting(progress), envAt(time), w)
                      writes: sun, hemi, bg, fog, point lights, store.lightLevel
Interior loop:        cove/shade/glass/sheer emissives ← store.lightLevel
Effects loop:         bloom ← store.lightLevel-derived value
TimeSlider rAF:       visibility ← progress; thumb/label ← store.time
```

## Error handling

- `envAt` clamps `t` to [0, 1]; keyframe table is static so no runtime
  failure modes.
- Slider ignores input while `w < 1` visibility threshold not reached
  (pointer-events: none), so there is no fight between authorities.
- Reduced-motion users: slider still works (it is user-driven, not
  animation); smoothing constant stays (it prevents flicker, which is worse
  for accessibility).

## Testing & validation

- `npx tsc --noEmit` clean.
- Headless Playwright (playwright-core, already available): scroll to story
  end, drag the slider to each of the five stops, screenshot each at
  1280×800 and 390×844 (mobile). Visual QC per Design Bible: no clipping, no
  floating geometry, no flat/dead frames.
- Handoff proof: screenshots at `p = 0.92` (story authority) and `p = 0.99`
  (slider authority, untouched slider) must be visually identical.
- Replay check: drag Evening → Morning → Evening; no flicker or hitching.

## Out of scope (later parts)

Estate garden/pool/fire pit (Part 2); birds, butterflies, steam, fire
flicker, plant sway (Part 3); kitchen/bedroom/bath/study rooms (Part 4);
audio (future). The engine's `practicals` scalar and keyframe table are the
extension points these parts will plug into.
