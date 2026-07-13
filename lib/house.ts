import * as THREE from "three";

// ---------------------------------------------------------------------------
// The house is authored in code: a 10m x 7m flat-roof pavilion with a fully
// glazed south face. Every element carries a `rise` order so walls can grow
// from the slab in a staggered, physically believable sequence.
// ---------------------------------------------------------------------------

export type MaterialKind =
  | "plaster"
  | "concrete"
  | "wood"
  | "glass"
  | "steel"
  | "fabric";

export interface Block {
  /** center x/z, size, base y and height — boxes that scale up from y=base */
  x: number;
  z: number;
  w: number; // x size
  d: number; // z size
  y: number; // base height (bottom face)
  h: number; // full height
  mat: MaterialKind;
  /** 0..1 stagger order for the rise animation */
  rise: number;
  /** furniture appears with materials, not with the structure */
  furniture?: boolean;
}

const T = 0.16; // wall thickness
export const W = 10; // footprint x
export const D = 7; // footprint z
export const H = 3; // wall height

export const blocks: Block[] = [
  // --- structure -----------------------------------------------------------
  // back wall (north, z = -D/2)
  { x: 0, z: -D / 2, w: W, d: T, y: 0, h: H, mat: "plaster", rise: 0.0 },
  // west wall
  { x: -W / 2, z: 0, w: T, d: D, y: 0, h: H, mat: "plaster", rise: 0.12 },
  // east wall
  { x: W / 2, z: 0, w: T, d: D, y: 0, h: H, mat: "plaster", rise: 0.2 },
  // south face piers (big glazed opening between)
  { x: -4.1, z: D / 2, w: 1.8, d: T, y: 0, h: H, mat: "concrete", rise: 0.3 },
  { x: 4.1, z: D / 2, w: 1.8, d: T, y: 0, h: H, mat: "concrete", rise: 0.34 },
  // header above the opening
  { x: 0, z: D / 2, w: 6.4, d: T, y: 2.35, h: 0.65, mat: "concrete", rise: 0.42 },
  // interior partition
  { x: 1.9, z: -1.75, w: T, d: 3.5, y: 0, h: H, mat: "plaster", rise: 0.5 },
  // glazing
  { x: 0, z: D / 2, w: 6.4, d: 0.05, y: 0.06, h: 2.29, mat: "glass", rise: 0.62 },
  // steel mullions
  { x: -1.6, z: D / 2, w: 0.07, d: 0.1, y: 0, h: 2.35, mat: "steel", rise: 0.66 },
  { x: 0, z: D / 2, w: 0.07, d: 0.1, y: 0, h: 2.35, mat: "steel", rise: 0.7 },
  { x: 1.6, z: D / 2, w: 0.07, d: 0.1, y: 0, h: 2.35, mat: "steel", rise: 0.74 },

  // dropped ceiling border — a floating frame with a cove above its inner lip
  { x: 0, z: -3.07, w: 9.84, d: 0.7, y: 2.86, h: 0.14, mat: "plaster", rise: 0.84 },
  { x: 0, z: 3.07, w: 9.84, d: 0.7, y: 2.86, h: 0.14, mat: "plaster", rise: 0.88 },
  { x: -4.57, z: 0, w: 0.7, d: 5.44, y: 2.86, h: 0.14, mat: "plaster", rise: 0.92 },
  { x: 4.57, z: 0, w: 0.7, d: 5.44, y: 2.86, h: 0.14, mat: "plaster", rise: 0.96 },
];

// note: furniture is no longer block-based — the designed pieces live in
// components/three/Interior.tsx and grow in during the material phase.

export const slab = { w: W + 0.6, d: D + 0.6, h: 0.14 };
export const roof = { w: W + 0.8, d: D + 0.8, h: 0.16, y: H };

// ---------------------------------------------------------------------------
// Blueprint: the 2D floor plan as line segments on the ground (y ≈ 0.02).
// ---------------------------------------------------------------------------

type Seg = [number, number, number, number]; // x1,z1,x2,z2

function rect(x: number, z: number, w: number, d: number): Seg[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    [x - hw, z - hd, x + hw, z - hd],
    [x + hw, z - hd, x + hw, z + hd],
    [x + hw, z + hd, x - hw, z + hd],
    [x - hw, z + hd, x - hw, z - hd],
  ];
}

export function planSegments(): Seg[] {
  const segs: Seg[] = [];
  // wall outlines (structure only)
  for (const b of blocks) {
    if (b.furniture || b.mat === "glass" || b.y > 0) continue;
    segs.push(...rect(b.x, b.z, b.w, b.d));
  }
  // furniture footprints, lighter presence in the plan
  segs.push(...rect(-1.4, -2.35, 3.2, 1.1)); // sofa
  segs.push(...rect(-1.3, -0.85, 1.1, 1.1)); // coffee table
  segs.push(...rect(3.55, -0.9, 1.24, 2.3)); // dining
  segs.push(...rect(-3.5, 1.5, 0.95, 0.95)); // lounge chair
  // glazing line
  segs.push([-3.2, D / 2, 3.2, D / 2]);
  // dimension ticks outside the plan
  const oy = D / 2 + 0.9;
  segs.push([-W / 2, oy, W / 2, oy]);
  segs.push([-W / 2, oy - 0.18, -W / 2, oy + 0.18]);
  segs.push([W / 2, oy - 0.18, W / 2, oy + 0.18]);
  const ox = -W / 2 - 0.9;
  segs.push([ox, -D / 2, ox, D / 2]);
  segs.push([ox - 0.18, -D / 2, ox + 0.18, -D / 2]);
  segs.push([ox - 0.18, D / 2, ox + 0.18, D / 2]);
  return segs;
}

// ---------------------------------------------------------------------------
// Particle targets: points sampled along every structural edge, so the cloud
// condenses into the wireframe of the building.
// ---------------------------------------------------------------------------

export function sampleTargets(count: number): Float32Array {
  const lines: Array<[THREE.Vector3, THREE.Vector3]> = [];

  const pushBox = (b: Block) => {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    const y0 = b.y, y1 = b.y + b.h;
    const z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const c = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // 12 edges of the box
    lines.push(
      [c(x0, y0, z0), c(x1, y0, z0)], [c(x0, y1, z0), c(x1, y1, z0)],
      [c(x0, y0, z1), c(x1, y0, z1)], [c(x0, y1, z1), c(x1, y1, z1)],
      [c(x0, y0, z0), c(x0, y1, z0)], [c(x1, y0, z0), c(x1, y1, z0)],
      [c(x0, y0, z1), c(x0, y1, z1)], [c(x1, y0, z1), c(x1, y1, z1)],
      [c(x0, y0, z0), c(x0, y0, z1)], [c(x1, y0, z0), c(x1, y0, z1)],
      [c(x0, y1, z0), c(x0, y1, z1)], [c(x1, y1, z0), c(x1, y1, z1)],
    );
  };

  for (const b of blocks) {
    if (b.furniture) continue;
    pushBox(b);
  }
  // roof outline
  const r = roof;
  pushBox({ x: 0, z: 0, w: r.w, d: r.d, y: r.y, h: r.h, mat: "concrete", rise: 0 });

  const lengths = lines.map(([a, b]) => a.distanceTo(b));
  const total = lengths.reduce((s, l) => s + l, 0);

  const out = new Float32Array(count * 3);
  let i = 0;
  for (let li = 0; li < lines.length && i < count; li++) {
    const n = Math.max(1, Math.round((lengths[li] / total) * count));
    const [a, b] = lines[li];
    for (let k = 0; k < n && i < count; k++, i++) {
      const t = Math.random();
      out[i * 3] = a.x + (b.x - a.x) * t;
      out[i * 3 + 1] = a.y + (b.y - a.y) * t;
      out[i * 3 + 2] = a.z + (b.z - a.z) * t;
    }
  }
  // fill any remainder on random edges
  while (i < count) {
    const li = (Math.random() * lines.length) | 0;
    const [a, b] = lines[li];
    const t = Math.random();
    out[i * 3] = a.x + (b.x - a.x) * t;
    out[i * 3 + 1] = a.y + (b.y - a.y) * t;
    out[i * 3 + 2] = a.z + (b.z - a.z) * t;
    i++;
  }
  return out;
}
