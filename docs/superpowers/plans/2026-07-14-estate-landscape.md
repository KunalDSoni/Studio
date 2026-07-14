# Estate Landscape (Experience Through Light Part 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A designed estate garden along the camera's south approach corridor — terrace, stepping-stone path, reflecting pool, fire-pit lounge, layered planting, bollard lighting — that grows in with the story and participates in the time-of-day engine.

**Architecture:** A new `components/three/Landscape.tsx` follows the `Interior.tsx` idiom (lazily-built group, `{node, order}` grow-in list, pre-allocated materials, one `useFrame`). The environment engine gains a `garden` scalar (0 by day, 1.0 at Golden Hour — handoff-locked, 1.25 at Evening); Scene publishes `store.gardenLevel` with the same story↔engine blend as `practicals`. Existing outdoor pieces move from Interior to Landscape verbatim.

**Tech Stack:** Existing three.js/@react-three/fiber; node:test unit tests; playwright-core validation.

**Spec:** `docs/superpowers/specs/2026-07-14-estate-landscape-design.md`

## Global Constraints

- Zero per-frame allocations in any `useFrame` loop (pre-allocate, mutate in place).
- Golden Hour env values are FIXED, including the new `garden: 1.0`; story-side garden level is `lightP`, so both sides equal 1.0 at handoff — the p 0.93–0.985 handoff must stay invisible.
- Light budget: exactly 2 new real point lights (fire-pit ember, pool underglow), both inside Landscape, intensities `k * store.gardenLevel`. Everything else emissive.
- Repeated elements (terrace pads, path stones, grass tufts) use `InstancedMesh`.
- No clipping: hardscape must not intersect hedges/trees; the camera dolly line (x ≈ 0.85, z 8.6 → 2.9, y ≈ 1.66–1.95) must stay clear of geometry above y = 1.2.
- Dev server ALREADY RUNNING at http://localhost:3000 (do not start another); scripts run from repo root; `await import("playwright-core")` resolves locally.
- Unit tests: `node --test scripts/environment.test.ts` must pass throughout; `npx tsc --noEmit` clean at every commit.

---

### Task 1: `garden` scalar in the environment engine

**Files:**
- Modify: `lib/environment.ts`
- Test: `scripts/environment.test.ts`

**Interfaces:**
- Consumes: existing `EnvState`, `KEYS`, `envAt`.
- Produces: `EnvState.garden: number`; keyframe values Morning/LateMorning/Afternoon `0`, GoldenHour `1`, Evening `1.25`; `createEnvState()` initializes `garden: 0`; `envAt` interpolates it. Task 2 relies on `env.garden`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/environment.test.ts`:

```ts
test("garden level: off by day, locked to 1 at golden hour, boosted at evening", () => {
  close(envAt(0, createEnvState()).garden, 0);
  close(envAt(0.5, createEnvState()).garden, 0);
  close(envAt(0.75, createEnvState()).garden, 1); // handoff lock
  close(envAt(1, createEnvState()).garden, 1.25);
});

test("garden interpolates between stops", () => {
  const mid = envAt(0.875, createEnvState());
  close(mid.garden, (1 + 1.25) / 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/environment.test.ts`
Expected: the two new tests FAIL (`garden` is `undefined`); the original 5 still pass.

- [ ] **Step 3: Implement**

In `lib/environment.ts`:
1. Add to the `EnvState` interface after `practicals: number;`:
```ts
  garden: number;      // 0..n master level for landscape lighting
```
2. Add `garden` to each keyframe in `KEYS` (after each `practicals` entry): Morning `garden: 0,`, Late Morning `garden: 0,`, Afternoon `garden: 0,`, Golden Hour `garden: 1,` (FIXED — handoff lock), Evening `garden: 1.25,`.
3. In `createEnvState()` add `garden: 0,` after `practicals: 0,`.
4. In `envAt()` add after the `out.practicals` line:
```ts
  out.garden = lerp(a.garden, b.garden, k);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/environment.test.ts`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/environment.ts scripts/environment.test.ts
git commit -m "feat: garden lighting scalar in the environment engine"
```

---

### Task 2: `store.gardenLevel` blend + Landscape scaffold (move outdoor pieces out of Interior)

**Files:**
- Modify: `lib/store.ts`
- Modify: `components/three/Scene.tsx`
- Create: `components/three/Landscape.tsx`
- Modify: `components/three/Interior.tsx` (delete the two outdoor blocks)

**Interfaces:**
- Consumes: `env.garden` (Task 1); existing `store`, `seg`, `easeInOut`; `RoundedBoxGeometry`.
- Produces: `store.gardenLevel: number` (Scene writes, Landscape reads); `Landscape` React component mounted by Scene; Task 3 adds set pieces inside `Landscape.tsx`'s builder block and its `fx` refs.

- [ ] **Step 1: Add the store field**

In `lib/store.ts`, after `bloomLevel: 0,` add:

```ts
  /** blended master level for landscape lighting (Scene writes, Landscape reads) */
  gardenLevel: 0,
```

- [ ] **Step 2: Publish the blend in Scene**

In `components/three/Scene.tsx`, after the `store.bloomLevel = ...` statement add:

```ts
    store.gardenLevel = lightP * (1 - w) + env.garden * w;
```

At `w = 0` this is `lightP` (story: garden lights rise with the interior practicals); at `w = 1, time = 0.75` it is `1.0` — equal, handoff invisible.

Also import and mount the component: add `import { Landscape } from "./Landscape";` with the other component imports and render `<Landscape />` directly after `<Interior />` in the JSX.

- [ ] **Step 3: Create the Landscape scaffold with the moved pieces**

In `components/three/Interior.tsx`, DELETE these two blocks entirely (they move to Landscape):
- the block commented `// ---- the garden beyond the glass ----` (the 6 stepping stones + 2 hedge RoundedBoxes, order 0.52)
- the block that defines `mkTree` and the three `add(mkTree(...))` calls (orders 0.6 / 0.7 / 0.76)

Create `components/three/Landscape.tsx`:

```tsx
"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useFrame, useThree } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";

// ---------------------------------------------------------------------------
// The estate garden along the south camera corridor. Same idiom as Interior:
// pieces grow from the ground during the material phase; landscape lighting
// rides store.gardenLevel (story lightP ↔ time-engine garden scalar).
// ---------------------------------------------------------------------------

interface Item {
  node: THREE.Object3D;
  order: number;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const RB = (w: number, h: number, d: number, r: number, s = 3) =>
  new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));

export function Landscape() {
  const scene = useThree((s) => s.scene);
  const items = useRef<Item[]>([]);
  const fx = useRef<{
    water?: THREE.MeshStandardMaterial;
  }>({});
  const waterTint = useRef(new THREE.Color()).current;

  const groupRef = useRef<THREE.Group | null>(null);
  if (groupRef.current === null) {
    const root = new THREE.Group();
    items.current = [];
    const it = items.current;

    // ---- materials (garden palette) ----------------------------------------
    const stone = new THREE.MeshStandardMaterial({ color: "#c6bda9", roughness: 0.95 });
    const foliageA = new THREE.MeshStandardMaterial({ color: "#8b8c6c", roughness: 1 });
    const foliageB = new THREE.MeshStandardMaterial({ color: "#767a5b", roughness: 1 });
    const bark = new THREE.MeshStandardMaterial({ color: "#6e5d4a", roughness: 1 });

    // ---- helpers ------------------------------------------------------------
    const M = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0, y = 0, z = 0,
      shadow = true
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      return m;
    };

    const add = (node: THREE.Object3D, order: number, x = 0, z = 0, ry = 0) => {
      node.position.x = x;
      node.position.z = z;
      node.rotation.y = ry;
      node.visible = false;
      node.scale.setScalar(0.0001);
      root.add(node);
      it.push({ node, order });
      return node;
    };

    // ---- stepping stones + hedges (moved verbatim from Interior) -----------
    {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const s = M(RB(0.56, 0.05, 0.42, 0.02), stone, 0.55 + (i % 2) * 0.14, 0.025, 4.15 + i * 0.68);
        s.rotation.y = (i % 2 ? -1 : 1) * 0.06;
        g.add(s);
      }
      g.add(M(RB(3.2, 0.55, 0.6, 0.2), foliageB, -2.4, 0.27, 4.5));
      g.add(M(RB(2.0, 0.45, 0.55, 0.18), foliageA, 2.7, 0.22, 4.7));
      add(g, 0.52);
    }

    // ---- blob trees (moved verbatim from Interior) --------------------------
    {
      const mkTree = (scale: number) => {
        const g = new THREE.Group();
        const trunk = M(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 1.7 * scale, 10), bark, 0, 0.85 * scale, 0);
        trunk.rotation.z = 0.05;
        g.add(trunk);
        const blobs: Array<[number, number, number, number]> = [
          [0, 2.1, 0, 0.75], [0.55, 1.8, 0.1, 0.5], [-0.5, 1.9, -0.1, 0.55], [0.1, 2.5, -0.1, 0.5],
        ];
        blobs.forEach(([bx, by, bz, r], i) => {
          const s = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 18, 12), i % 2 ? foliageA : foliageB);
          s.scale.y = 0.72;
          s.position.set(bx * scale, by * scale, bz * scale);
          s.castShadow = true;
          g.add(s);
        });
        return g;
      };
      add(mkTree(1.15), 0.6, -3.6, 6.8, 0.4);
      add(mkTree(0.85), 0.7, 3.2, 8.4, 1.2);
      add(mkTree(1.0), 0.76, -1.0, 9.6, 2.1);
    }

    groupRef.current = root;
  }

  useFrame(() => {
    const p = store.progress;
    const furnP = easeInOut(seg(p, 0.55, 0.72));

    for (const { node, order } of items.current) {
      const local = easeOutCubic(seg(furnP, order * 0.55, order * 0.55 + 0.45));
      node.visible = local > 0.004;
      node.scale.setScalar(Math.max(local, 0.0001));
    }

    // water mirrors the sky: fog color is the single source of sky tone
    const f = fx.current;
    if (f.water && scene.fog) {
      waterTint.copy((scene.fog as THREE.Fog).color).multiplyScalar(0.82);
      f.water.color.copy(waterTint);
    }
  });

  return <primitive object={groupRef.current} />;
}
```

Note: the grow-in loop reproduces Interior's exact timing (`furnP`, `order * 0.55 ... + 0.45`), so the moved pieces appear at precisely the same scroll moments as before.

- [ ] **Step 4: Verify story is unchanged**

Run: `npx tsc --noEmit` (clean), `node --test scripts/environment.test.ts` (7/7).

Capture the approach with the existing pattern (temp script or reuse `scripts/story-check.mjs` with `[0.6, 0.78]`), then LOOK at the images: the stepping stones, hedges, and three trees must appear at the same places and same scroll moments as before the move. Any missing/duplicated piece is a migration error.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts components/three/Scene.tsx components/three/Landscape.tsx components/three/Interior.tsx
git commit -m "feat: Landscape component owns the garden; gardenLevel published"
```

---

### Task 3: Estate set pieces + garden lighting

**Files:**
- Modify: `components/three/Landscape.tsx`

**Interfaces:**
- Consumes: the Task 2 scaffold (`M`, `add`, `RB`, materials, `fx`, `items`), `store.gardenLevel`.
- Produces: the complete garden; `fx` gains `bollard`, `ember`, `spill` materials and `emberLight`, `poolLight` point lights (all driven in `useFrame`).

- [ ] **Step 1: Extend materials and fx**

In `Landscape.tsx`, extend the `fx` ref type and add materials inside the builder (after the existing four):

```ts
  const fx = useRef<{
    water?: THREE.MeshStandardMaterial;
    bollard?: THREE.MeshStandardMaterial;
    ember?: THREE.MeshStandardMaterial;
    spill?: THREE.MeshStandardMaterial;
    emberLight?: THREE.PointLight;
    poolLight?: THREE.PointLight;
  }>({});
```

```ts
    const travertine = new THREE.MeshStandardMaterial({ color: "#d8cdb6", roughness: 0.9 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#6b543a", metalness: 0.8, roughness: 0.45 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#7d8160", roughness: 1 });
    const mapleFoliage = new THREE.MeshStandardMaterial({ color: "#a4553a", roughness: 1 });
    const charStone = new THREE.MeshStandardMaterial({ color: "#8f8878", roughness: 0.98 });
    const water = new THREE.MeshStandardMaterial({
      color: "#cfd8dd", roughness: 0.08, metalness: 0.35,
    });
    const bollardGlow = new THREE.MeshStandardMaterial({
      color: "#efe3c8", emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: "#2c221a", emissive: "#ff8a3d", emissiveIntensity: 0, roughness: 1,
    });
    const spillMat = new THREE.MeshStandardMaterial({
      color: "#d8cdb6", emissive: "#ffd9a4", emissiveIntensity: 0, roughness: 0.9,
    });
    fx.current = { water, bollard: bollardGlow, ember: emberMat, spill: spillMat };
```

- [ ] **Step 2: Add the set pieces** (inside the builder, after the moved tree block)

```ts
    // ---- stone terrace off the glazing (instanced pads) ---------------------
    {
      const g = new THREE.Group();
      const pad = RB(0.92, 0.05, 0.72, 0.02);
      const inst = new THREE.InstancedMesh(pad, travertine, 8);
      inst.castShadow = false;
      inst.receiveShadow = true;
      const m4 = new THREE.Matrix4();
      let i = 0;
      for (let gx = 0; gx < 4; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          m4.setPosition(-0.7 + gx * 1.0, 0.025, 3.95 + gz * 0.8);
          inst.setMatrixAt(i++, m4);
        }
      }
      g.add(inst);
      // warm window-spill pad tight to the glazing
      const spill = M(new THREE.PlaneGeometry(5.6, 1.1), spillMat, 0.35, 0.055, 3.85, false);
      spill.rotation.x = -Math.PI / 2;
      g.add(spill);
      add(g, 0.5);
    }

    // ---- stepping-stone path extension (continues the existing 6 pads) ------
    {
      const g = new THREE.Group();
      const pad = RB(0.56, 0.05, 0.42, 0.02);
      const inst = new THREE.InstancedMesh(pad, stone, 7);
      inst.receiveShadow = true;
      const m4 = new THREE.Matrix4();
      const rot = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 7; i++) {
        pos.set(0.62 + (i % 2) * 0.14, 0.025, 8.25 + i * 0.68);
        rot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2 ? -1 : 1) * 0.06);
        m4.compose(pos, rot, one);
        inst.setMatrixAt(i, m4);
      }
      g.add(inst);
      add(g, 0.56);
    }

    // ---- reflecting pool east of the path -----------------------------------
    {
      const g = new THREE.Group();
      // basin rim
      g.add(M(RB(1.7, 0.09, 6.1, 0.03), charStone, 3.0, 0.045, 8.6));
      // water surface, recessed 5mm inside the rim
      const surf = M(new THREE.PlaneGeometry(1.5, 5.9), water, 3.0, 0.085, 8.6, false);
      surf.rotation.x = -Math.PI / 2;
      g.add(surf);
      add(g, 0.58);
    }

    // ---- fire-pit lounge west of the terrace --------------------------------
    {
      const g = new THREE.Group();
      const ring = M(new THREE.CylinderGeometry(0.5, 0.56, 0.28, 24), charStone, 0, 0.14, 0);
      g.add(ring);
      g.add(M(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), emberMat, 0, 0.29, 0, false));
      const chair = (x: number, ry: number) => {
        const c = new THREE.Group();
        c.add(M(RB(0.72, 0.16, 0.66, 0.05), foliageA, 0, 0.14, 0));
        const back = M(RB(0.72, 0.42, 0.12, 0.05), foliageA, 0, 0.42, -0.3);
        back.rotation.x = -0.22;
        c.add(back);
        c.position.set(x, 0, 0.95);
        c.rotation.y = ry;
        return c;
      };
      g.add(chair(-0.75, 0.5), chair(0.75, -0.5));
      // (-3.1, 5.7): clears the hedge at (-2.4, 4.5) and the tree at (-3.6, 6.8)
      add(g, 0.62, -3.1, 5.7, 0.2);
    }

    // ---- feature maple --------------------------------------------------------
    {
      const g = new THREE.Group();
      const trunk = M(new THREE.CylinderGeometry(0.05, 0.08, 1.5, 10), bark, 0, 0.75, 0);
      trunk.rotation.z = -0.07;
      g.add(trunk);
      const blobs: Array<[number, number, number, number]> = [
        [0, 1.85, 0, 0.62], [0.45, 1.6, 0.08, 0.4], [-0.42, 1.66, -0.06, 0.44], [0.05, 2.2, -0.1, 0.4],
      ];
      for (const [bx, by, bz, r] of blobs) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mapleFoliage);
        s.scale.y = 0.72;
        s.position.set(bx, by, bz);
        s.castShadow = true;
        g.add(s);
      }
      add(g, 0.66, -2.6, 8.6, 0.7);
    }

    // ---- layered beds: instanced grass tufts + sculptural shrubs ------------
    {
      const g = new THREE.Group();
      const tuft = new THREE.ConeGeometry(0.09, 0.42, 6);
      const inst = new THREE.InstancedMesh(tuft, grassMat, 46);
      inst.castShadow = false;
      const m4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const rot = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      // deterministic scatter (no Math.random — stable composition, no reflow)
      for (let i = 0; i < 46; i++) {
        const t = i / 46;
        const side = i % 2 ? 1 : -1;
        pos.set(
          side * (1.7 + ((i * 37) % 23) / 10),
          0.21,
          4.6 + t * 7.4 + ((i * 13) % 7) / 10
        );
        rot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.4) % Math.PI);
        const s = 0.7 + ((i * 29) % 11) / 18;
        scl.set(s, s, s);
        m4.compose(pos, rot, scl);
        inst.setMatrixAt(i, m4);
      }
      g.add(inst);
      g.add(M(new THREE.SphereGeometry(0.5, 18, 12), foliageB, -2.1, 0.32, 11.2));
      g.add(M(new THREE.SphereGeometry(0.38, 18, 12), foliageA, 2.3, 0.26, 12.1));
      g.add(M(new THREE.SphereGeometry(0.3, 18, 12), foliageB, -1.4, 0.2, 5.6));
      add(g, 0.72);
    }

    // ---- bollard lights along the path ---------------------------------------
    {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const x = 1.55;
        const z = 6 + i * 2.0;
        const post = M(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), bronze, x, 0.25, z);
        g.add(post);
        g.add(M(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), bollardGlow, x, 0.52, z, false));
      }
      add(g, 0.8);
    }

    // ---- the two real garden lights ------------------------------------------
    {
      const ember = new THREE.PointLight("#ff9a4d", 0, 6, 2);
      ember.position.set(-3.1, 0.5, 5.7);
      const pool = new THREE.PointLight("#ffd9a4", 0, 5, 2);
      pool.position.set(3.0, 0.35, 8.6);
      root.add(ember, pool);
      fx.current.emberLight = ember;
      fx.current.poolLight = pool;
    }
```

- [ ] **Step 3: Drive the lighting in `useFrame`** (extend the existing frame body after the water tint block)

```ts
    const L = store.gardenLevel;
    if (f.bollard) f.bollard.emissiveIntensity = 2.2 * L;
    if (f.ember) f.ember.emissiveIntensity = 3.0 * L;
    if (f.spill) f.spill.emissiveIntensity = 0.5 * L;
    if (f.emberLight) f.emberLight.intensity = 2.6 * L;
    if (f.poolLight) f.poolLight.intensity = 1.4 * L;
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit` clean; `node --test scripts/environment.test.ts` 7/7.
Screenshot the approach (p = 0.6 and 0.75, 1280×800) and LOOK: terrace/pads/pool/fire pit/maple/beds composed, nothing floating or intersecting (fire lounge at (−3.1, 5.7) must clear both the hedge at (−2.4, 4.5) and the tree at (−3.6, 6.8) — confirm visually), camera corridor clear. Then scroll to the end, drag the slider to Evening, screenshot: bollard caps glowing, pool dark indigo, embers lit. Drag to Morning: all garden lights off.

- [ ] **Step 5: Commit**

```bash
git add components/three/Landscape.tsx
git commit -m "feat: estate set pieces with time-driven garden lighting"
```

---

### Task 4: Validation extension + composition QC

**Files:**
- Modify: `scripts/validate-light.mjs`
- Modify (tuning only, if QC demands): `components/three/Landscape.tsx` positions/intensities, non-golden keyframes in `lib/environment.ts`

**Interfaces:**
- Consumes: the complete garden (Tasks 1–3).
- Produces: extended QC record in `scripts/out/` (gitignored).

- [ ] **Step 1: Add approach captures**

In `scripts/validate-light.mjs`, inside `run()`, extend the handoff-pair loop to also capture the approach frames — change `for (const p of [0.92, 0.99])` to:

```js
  for (const p of [0.6, 0.75, 0.92, 0.99]) {
```

and rename the output for clarity: `path: \`scripts/out/${tag}-scroll-p${p * 100}.png\`` (keep the handoff assertion applying to p92/p99).

- [ ] **Step 2: Run and QC every frame**

Run: `node scripts/validate-light.mjs`. Expected: 18 PNGs. LOOK at each:
- Approach p60/p75 (both viewports): garden composed and clip-free; terrace pads level; pool rim straight; no geometry piercing the camera line; bollards/embers glowing amber at p75 (story lightP ≈ 0.9–1).
- Stage frames: bollards/embers/spill DARK at Morning/Late Morning/Afternoon; lit at Golden; brightest at Evening; pool surface tracks the sky tone (bright by day, amber at golden, indigo at evening).
- Handoff p92 vs p99 indistinguishable (garden included).
- No clipping, floating geometry, dead-black or blown-white regions anywhere.

- [ ] **Step 3: Tune until clean**

Adjust Landscape positions/intensities or non-golden keyframes only. After every adjustment: `node --test scripts/environment.test.ts` (7/7 — golden lock intact) and re-run the validation script. Iterate until every checklist item passes.

- [ ] **Step 4: Final gate and commit**

```bash
npx tsc --noEmit && node --test scripts/environment.test.ts
git add scripts/validate-light.mjs components/three/Landscape.tsx lib/environment.ts
git commit -m "feat: validated estate landscape QC record"
```

---

## Self-review notes

- Spec coverage: garden scalar (T1), gardenLevel + component move (T2), all eight set-piece rows of the spec table + 2-light budget + window spill (T3), validation extension + QC + composition/clearance checks (T4). Pool color via fog copy (T2 useFrame) — no new env fields beyond `garden`, matching the spec.
- The moved-pieces code is reproduced verbatim in T2 (not referenced as "same as Interior") so the implementer needs no other file context.
- Names consistent across tasks: `store.gardenLevel`, `env.garden`, `fx.current.{water,bollard,ember,spill,emberLight,poolLight}`, materials `travertine/bronze/grassMat/mapleFoliage/charStone/water/bollardGlow/emberMat/spillMat`.
- Instancing note: the path-extension and grass instanced meshes build their matrices with locally-scoped `Vector3`/`Quaternion` at construction time (once), not per frame — allocation constraint intact.
