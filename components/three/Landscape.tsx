"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useFrame } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";

// ---------------------------------------------------------------------------
// The estate garden along the south camera corridor. Same idiom as Interior:
// pieces grow from the ground during the material phase.
// ---------------------------------------------------------------------------

interface Item {
  node: THREE.Object3D;
  order: number;
  rise: number;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const RB = (w: number, h: number, d: number, r: number, s = 3) =>
  new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));

export function Landscape() {
  const items = useRef<Item[]>([]);

  const groupRef = useRef<THREE.Group | null>(null);
  if (groupRef.current === null) {
    const root = new THREE.Group();
    items.current = [];
    const it = items.current;

    // ---- materials (garden palette) ----------------------------------------
    const stone = new THREE.MeshStandardMaterial({ color: "#d6c6ae", roughness: 0.95 });
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
      node.position.set(x, 0, z);
      node.rotation.y = ry;
      // measure the piece's height so we can sink it fully below the ground,
      // then raise it back up — it emerges from the surface instead of scaling
      node.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(node);
      const rise = Math.max(box.max.y, 0.1) + 0.1;
      node.position.y = -rise;
      node.visible = false;
      root.add(node);
      it.push({ node, order, rise });
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


    groupRef.current = root;
  }

  useFrame(() => {
    const p = store.progress;
    const furnP = easeInOut(seg(p, 0.55, 0.72));

    for (const { node, order, rise } of items.current) {
      const local = easeOutCubic(seg(furnP, order * 0.55, order * 0.55 + 0.45));
      node.visible = local > 0.004;
      // rise up out of the ground; the ground plane hides the part still below
      node.position.y = -rise * (1 - local);
    }
  });

  return <primitive object={groupRef.current} />;
}
