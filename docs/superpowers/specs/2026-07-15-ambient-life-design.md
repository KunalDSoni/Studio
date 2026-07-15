# Experience Through Light — Part 3: Ambient Life

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan
**Depends on:** Part 1 (time engine, `store.lightLevel`), Part 2 (Landscape, `store.gardenLevel`), merged at `0d74728`.

## Vision

Nothing in the scene should ever appear frozen (brief: "Everything should
feel alive"). Constant sub-perceptual motion — swaying foliage, breathing
sheers, flickering fire, glinting water, lingering dust — plus occasional
delight events: birds crossing in daylight, a leaf spiraling from the maple,
coffee steam on the ottoman tray. All of it time-aware and inside the mobile
performance budget.

## Decisions made with the user

1. **Full living set** (continuous motion + timed events), not a reduced
   subset.
2. **Approach A:** shared pure-motion library + component-owned animation.
   Rejected: a central cross-component animation registry (breaks component
   isolation); GPU vertex-shader wind (high-risk shader surgery for meshes
   whose CPU transforms are nearly free).

## Non-negotiables

- Zero per-frame allocations; no `Math.random` at runtime (deterministic
  functions of the clock).
- Draw-call budget: +3 (birds instanced mesh, leaf, steam). No new lights.
- Motion is subtle: foliage sway ≤ 2°, sheer breathing barely visible,
  nothing that competes with the architecture. The scene must read as calm.
- Scroll story and time-engine behavior unchanged: ambient motion overlays
  everything but alters no lighting values; the p 0.93–0.985 handoff and
  Golden Hour lock are untouched.
- Unit tests stay green; new pure helpers get their own tests.

## Architecture

### 1. `lib/life.ts` (new, pure — no three.js, node:test-able)

- `flicker(t: number, seed: number): number` — layered incommensurate sines
  approximating firelight; returns [0.55, 1].
- `sway(t: number, seed: number): number` — smooth wander in [−1, 1]
  (two-sine blend; caller scales by its amplitude).
- `eventPhase(t: number, period: number, duration: number, seed: number):
  number` — recurring event clock: returns 0 when idle, else 0→1 progress
  through the current occurrence; seed offsets the schedule so events never
  sync.

### 2. Component-owned animation (existing `useFrame` loops extended)

**Landscape.tsx**
- Sway: foliage blobs/trunk groups of the three moved trees, the maple, the
  shrub spheres, and grass instanced mesh (whole-mesh gentle rock) register
  in a `swayNodes: Array<{node, seed, amp}>` built once; per frame
  `node.rotation.z = baseZ + sway(t, seed) * amp` (base rotations captured
  at registration).
- Fire: `ember` material `emissiveIntensity = 3.0 * gardenLevel *
  flicker(t, 1)`; `emberLight.intensity = 2.6 * gardenLevel * flicker(t, 2)`.
- Pool glint: water material `metalness = 0.35 + sway(t, 3) * 0.08` — a slow
  live-mirror shimmer, no geometry change.

**Interior.tsx**
- Sheer breathing: the two drape meshes get `rotation.y = base + sway * 0.02`
  and `scale.x = 1 + sway * 0.012` (slow, out of phase).
- Bougainvillea: canopy group sways like the outdoor trees (amp 0.012).
- Coffee steam: a small ceramic cup (existing `ceramic` material) added to
  the ottoman tray next to the book; above it, two crossed transparent
  planes (normal blending, `depthWrite: false`, opacity ≤ 0.18) whose
  mesh position/scale/opacity animate
  upward on an `eventPhase(t, 9, 6, 4)` cycle — wisps rise for ~6s, pause,
  repeat.

**Aviary.tsx (new component, mounted by Scene)**
- Birds: one `InstancedMesh` (3 instances) of a minimal two-triangle wing
  form, dark ink color; flight path is a wide arc over the garden (z 8–20,
  y 6–9) driven by `eventPhase(t, 26, 12, 5)`; wing flap =
  `sin(t * 9 + i)` scale on y. Visibility `= daylight = 1 −
  min(1, store.gardenLevel)` (birds by day, gone at dusk) times the event
  phase envelope. Fully transparent ⇒ `visible = false`.
- Falling leaf: one small plane with the maple's foliage color near
  (−2.6, 8.6), on `eventPhase(t, 18, 5, 6)`: spirals down from the canopy
  (y 2.1 → 0.05) with rotation, fades at the ground.
- Both event meshes are world-anchored in the garden; during the blueprint
  phase (p < 0.5) Aviary hides everything (`visible = false`) so the blank
  canvas stays blank.

**Particles.tsx**
- Dust lingers: the vertex-shader `fade` line changes so the dust fraction
  (aRand.y > 0.93) never fully fades — it settles at a low constant
  (α ≈ 0.22 of its normal value) instead of reaching 0 by p 0.78. The
  existing drift already animates it; indoors it reads as sparkling motes in
  the light shafts.

### 3. Data flow

Reads only: `store.progress`, `store.gardenLevel`, clock `t`. No new store
fields, no writes from ambient code — ambient life is a pure consumer.

## Time gating

| Element | Gate |
|---|---|
| Foliage/sheer sway, pool glint, steam, leaf | always on |
| Fire flicker (material + light) | `× gardenLevel` (0 by day) |
| Birds | `× (1 − min(1, gardenLevel))` (daylight only) |
| Dust | indoors after construction (existing shader phase logic) |

## Testing & validation

- `scripts/life.test.ts` (node:test, same pattern as environment tests):
  `flicker` bounded [0.55, 1] sampled over many t; `sway` bounded [−1, 1]
  and non-constant; `eventPhase` returns 0 outside occurrences, spans 0→1
  inside, respects period/duration, seeds de-sync schedules.
- `npx tsc --noEmit` clean; environment tests stay 7/7.
- Motion proof (a sibling script, `scripts/validate-life.mjs`): capture two
  frames 1.5s apart, same scroll position, and pixel-diff them:
  (a) at p = 0.68 the frames must differ in the garden (sway exists);
  (b) at Evening (end of scroll, slider at 1) the ember/fire region must
  differ (flicker); (c) at Morning two frames 3s apart must show the bird
  displaced along its arc. The existing lighting QC (`validate-light.mjs`)
  is unchanged and must still pass — ambient motion may not alter lighting
  values, only geometry/material wiggle.
- QC eyeball: motion subtle, nothing strobing, story/blank-canvas phase
  clean (no birds over the blueprint).

## Out of scope

Butterflies, cloud shadows, water ripple geometry, wind gusts reacting to
pointer (possible Part 5 polish); interior rooms (Part 4); audio (future).
