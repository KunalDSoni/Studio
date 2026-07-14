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
    bollard?: THREE.MeshStandardMaterial;
    ember?: THREE.MeshStandardMaterial;
    spill?: THREE.MeshStandardMaterial;
    emberLight?: THREE.PointLight;
    poolLight?: THREE.PointLight;
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
    const travertine = new THREE.MeshStandardMaterial({ color: "#d8cdb6", roughness: 0.9 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#6b543a", metalness: 0.8, roughness: 0.45 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#7d8160", roughness: 1 });
    const mapleFoliage = new THREE.MeshStandardMaterial({ color: "#a4553a", roughness: 1 });
    const charStone = new THREE.MeshStandardMaterial({ color: "#8f8878", roughness: 0.98 });
    const water = new THREE.MeshStandardMaterial({
      color: "#cfd8dd", roughness: 0.08, metalness: 0.35,
    });
    const bollardGlow = new THREE.MeshStandardMaterial({
      color: "#efe3c8", emissive: "#ffb066", emissiveIntensity: 0,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: "#2c221a", emissive: "#ff8a3d", emissiveIntensity: 0, roughness: 1,
    });
    const spillMat = new THREE.MeshStandardMaterial({
      color: "#d8cdb6", emissive: "#ffd9a4", emissiveIntensity: 0, roughness: 0.9,
    });
    fx.current = { water, bollard: bollardGlow, ember: emberMat, spill: spillMat };

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
      g.add(M(RB(3.2, 0.55, 0.6, 0.2), foliageB, -2.9, 0.27, 4.5));
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
      // water surface, brimming proud of the rim so it reads from every angle
      const surf = M(new THREE.PlaneGeometry(1.5, 5.9), water, 3.0, 0.095, 8.6, false);
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
      // (-3.1, 5.7): clears the hedge at (-2.9, 4.5) and the tree at (-3.6, 6.8)
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
        let x = side * (1.7 + ((i * 37) % 23) / 10);
        const z = 4.6 + t * 7.4 + ((i * 13) % 7) / 10;
        // deterministic reject-and-nudge: keep tufts out of hardscape footprints
        const inPool = x > 2.05 && x < 3.95 && z > 5.45 && z < 11.75;
        const inFirePit = (x + 3.1) * (x + 3.1) + (z - 5.7) * (z - 5.7) < 0.75 * 0.75;
        const inTerrace = x > -1.3 && x < 3.4 && z > 3.5 && z < 5.2;
        if (inPool || inFirePit || inTerrace) {
          x = side > 0 ? 4.1 + (i % 5) / 10 : -(4.0 + (i % 5) / 10);
        }
        pos.set(x, 0.21, z);
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

    const L = store.gardenLevel;
    if (f.bollard) f.bollard.emissiveIntensity = 1.5 * L;
    if (f.ember) f.ember.emissiveIntensity = 3.0 * L;
    if (f.spill) f.spill.emissiveIntensity = 0.5 * L;
    if (f.emberLight) f.emberLight.intensity = 2.6 * L;
    if (f.poolLight) f.poolLight.intensity = 1.4 * L;
  });

  return <primitive object={groupRef.current} />;
}
