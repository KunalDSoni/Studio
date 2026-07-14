# Experience Through Light — Part 2: Estate Landscape

**Date:** 2026-07-14
**Status:** Approved design, pending implementation plan
**Depends on:** Part 1 (time engine + slider), merged at `4665bfa`.

## Vision

Turn the pavilion's south lawn into a designed estate garden — "the garden is
as important as the house" (Design Bible ch. 08 / the Experience Through
Light brief). Everything is composed along the camera corridor the approach
dolly actually flies (from z≈21 south of the house, through the glazing), so
every piece earns its cost on screen. The garden participates in the
time-of-day engine: by day it is planting and stone; at Golden Hour the
landscape lights ignite with the interior; at Evening the pool turns
indigo-mirror and the fire pit glows.

## Decisions made with the user

1. **Camera-corridor estate** scope — terrace, stepping-stone path,
   reflecting pool, fire-pit lounge, layered planting, landscape lighting.
   Explicitly excluded (out of camera or out of scope): driveway, outdoor
   kitchen/dining, meditation deck, Japanese garden zones, infinity pool.
2. **Approach A: procedural set pieces + faked water.** No `THREE.Reflector`
   (second render pass violates "performance before effects" on mobile); no
   billboard/baked planting (breaks the crafted-geometry aesthetic).
3. Fire pit **ignites and glows** with time in this part; flame *flicker*
   animation is Part 3 (ambient life).

## Non-negotiables (carried from Part 1 + Design Bible)

- Zero per-frame allocations in any `useFrame` loop.
- Scroll story below p = 0.93 stays pixel-identical **to its Part 2 form**:
  the garden grows in during the story like furniture does, but the
  story↔engine handoff at p 0.93–0.985 must stay invisible (blended
  expressions equal at both ends, same mechanism as Part 1).
- Golden Hour `EnvState` values from Part 1 are FIXED; the new `garden`
  field's Golden Hour value must equal the story-side garden light level at
  handoff (both 1.0 — see below).
- Unit tests must stay green; the Golden Hour lock test extends to `garden`.
- Mobile-first: total added draw calls kept modest (instancing for repeated
  stones/grasses); light budget: at most 2 new real point lights (fire pit,
  pool underglow) — everything else is emissive material driven by
  `store.gardenLevel`.
- No clipping/floating geometry in any validated frame.

## Architecture

### 1. `components/three/Landscape.tsx` (new)

Follows the `Interior.tsx` idiom exactly: a lazily-built `THREE.Group`, an
`items` list of `{ node, order }`, shared pre-allocated materials, a
`useFrame` that scales pieces in during the material phase and drives
emissive intensities from published store scalars. The existing outdoor
pieces currently living at the bottom of `Interior.tsx` (two hedges, three
blob trees, orders 0.55–0.76) MOVE into `Landscape.tsx` unchanged — Interior
goes back to owning interiors only.

Set pieces (all south of the house unless noted, sizes indicative):

| Piece | Where | Form |
|---|---|---|
| Stone terrace | z 3.6–5.2, x −1.2–3.3 | travertine pads (RoundedBox, instanced), 2–3cm reveal |
| Stepping-stone path | x ≈ 0.85 (the dolly line), z 5.2 → 13 | instanced oval pads with grass gaps |
| Reflecting pool | east of path: x 2.2–3.8, z 5.6–11.6 | 5mm-recessed basin + glossy water plane |
| Fire-pit lounge | west of terrace: x −3.2, z 5.8 | stone ring, ember bowl, two low lounge chairs |
| Feature maple | x −2.6, z 8.6 | trunk + rust-red foliage blobs (`#a4553a` family) |
| Layered beds | flanking corridor, z 4.5–12 | instanced grass tufts + sculptural shrub blobs, absorbs existing hedges |
| Bollard lights | 4×, along path z 6–12 | small bronze cylinders, warm emissive cap |
| Existing trees/hedges | may shift ≤0.8m to clear hardscape | moved from Interior.tsx; the west hedge (x −2.4, z 4.5) must not intersect terrace/fire-lounge pads — composition pass verifies no overlaps |

Grow-in orders 0.5–0.8 (terrace first, planting mid, bollards last), so the
garden assembles just before the camera sweeps through it at p ≈ 0.6–0.75.

### 2. Time integration — `garden` in the environment engine

- `EnvState` gains `garden: number` (0–n master level for landscape
  lighting). Keyframes: Morning 0, Late Morning 0, Afternoon 0, Golden Hour
  **1.0 (FIXED by handoff)**, Evening 1.25.
- Story authority: `storyGarden = lightP` (same ramp as practicals — the
  landscape lights come on with the interior lights during the story's
  golden-hour ending). Both sides equal 1.0 at handoff → invisible, same
  proof shape as Part 1.
- `Scene.tsx` publishes `store.gardenLevel = lightP*(1−w) + env.garden*w`.
  Landscape reads it for: bollard emissives, fire-pit ember emissive +
  point light, pool underglow point light, and a subtle warm "window spill"
  emissive pad on the terrace.
- Pool water: material color lerps between two pre-allocated colors driven
  by the already-published environment (`scene`-level sky tone). Scene
  publishes one more scalar pair — `store.poolColor` is NOT added; instead
  Landscape keeps a pre-allocated `THREE.Color` and each frame copies the
  scene fog color (single source of truth for sky tone) and darkens it
  slightly. No new env fields beyond `garden`.

### 3. Store

One new field: `gardenLevel` (Scene writes, Landscape reads). Nothing else.

### 4. Mounting

`Scene.tsx` renders `<Landscape />` next to `<Interior />`. The two new
point lights live inside Landscape (not Scene) because they are garden
fixtures; their intensities are `k * store.gardenLevel` — allocation-free.

## The five looks, outside

- **Morning/Late Morning/Afternoon:** stone and planting in daylight; pool
  mirrors the bright sky tone; no artificial light.
- **Golden Hour:** bollards, window spill, and embers at level 1.0 — warm
  necklace of light down the path; pool holds the amber sky.
- **Evening:** garden level 1.25 — bollard caps and fire pit carry the
  composition; pool is an indigo mirror; planting reads as silhouettes.

## Testing & validation

- Unit tests (extend `scripts/environment.test.ts`): `garden` present in
  all keyframes; Golden Hour `garden === 1.0`; midpoint interpolation
  includes `garden`.
- `npx tsc --noEmit` clean.
- Extend `scripts/validate-light.mjs` with two approach captures at
  p ≈ 0.60 and p ≈ 0.75 (garden in frame, desktop + mobile) alongside the
  existing 14 frames. QC checklist additions: path/pool/fire pit composed
  and clip-free from the approach camera; pool color tracks the sky at
  every stage; bollards dark in daytime stages.
- Handoff pair must remain indistinguishable.

## Out of scope (later parts)

Flame flicker, plant sway, birds/butterflies, water ripples (Part 3);
interior rooms (Part 4); audio (future). The `garden` scalar and the
Landscape item list are the extension points Part 3 will animate.
