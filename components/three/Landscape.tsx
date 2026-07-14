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
