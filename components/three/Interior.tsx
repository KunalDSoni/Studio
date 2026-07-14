"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useFrame } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";
import { oakFloor, walnut, travertine, marble, boucle, artwork } from "@/lib/textures";

// ---------------------------------------------------------------------------
// The designed interior: every piece is composed from rounded, proportioned
// forms with real material maps — no naked cubes. Pieces grow from the floor
// during the material phase in a staggered, curated order.
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

export function Interior() {
  const items = useRef<Item[]>([]);
  const fx = useRef<{
    lampShade?: THREE.MeshStandardMaterial;
    pendantGlass?: THREE.MeshStandardMaterial;
    cove?: THREE.MeshStandardMaterial;
    sheer?: THREE.MeshStandardMaterial;
  }>({});

  const groupRef = useRef<THREE.Group | null>(null);
  if (groupRef.current === null) {
    const root = new THREE.Group();
    items.current = [];
    const it = items.current;

    // ---- materials ---------------------------------------------------------
    const oakMat = new THREE.MeshStandardMaterial({ map: oakFloor(), roughness: 0.62 });
    const walnutMat = new THREE.MeshStandardMaterial({ map: walnut(), roughness: 0.5 });
    const travMat = new THREE.MeshStandardMaterial({ map: travertine(), roughness: 0.88 });
    const marbleMat = new THREE.MeshStandardMaterial({ map: marble(), roughness: 0.22 });
    const boucleMat = new THREE.MeshStandardMaterial({ map: boucle(), roughness: 1 });
    const rugMat = new THREE.MeshStandardMaterial({
      map: boucle(), color: "#c8bda6", roughness: 1,
    });
    const limedOak = new THREE.MeshStandardMaterial({ color: "#c9b692", roughness: 0.8 });
    const linenCream = new THREE.MeshStandardMaterial({ color: "#e7dcc4", roughness: 1 });
    const linenRust = new THREE.MeshStandardMaterial({ color: "#a06a48", roughness: 1 });
    const linenOlive = new THREE.MeshStandardMaterial({ color: "#8f8a6d", roughness: 1 });
    const leather = new THREE.MeshStandardMaterial({ color: "#8d6742", roughness: 0.55 });
    const brass = new THREE.MeshStandardMaterial({ color: "#b3915c", metalness: 0.85, roughness: 0.35 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#6b543a", metalness: 0.8, roughness: 0.45 });
    const ceramic = new THREE.MeshStandardMaterial({ color: "#eae2d0", roughness: 0.9 });
    const terracotta = new THREE.MeshStandardMaterial({ color: "#a3714f", roughness: 0.95 });
    const charcoal = new THREE.MeshStandardMaterial({ color: "#35302a", roughness: 0.9 });
    const smoked = new THREE.MeshStandardMaterial({ color: "#151210", metalness: 0.4, roughness: 0.14 });
    const soil = new THREE.MeshStandardMaterial({ color: "#3d3128", roughness: 1 });
    const foliageA = new THREE.MeshStandardMaterial({ color: "#8b8c6c", roughness: 1 });
    const foliageB = new THREE.MeshStandardMaterial({ color: "#767a5b", roughness: 1 });
    const leafGreen = new THREE.MeshStandardMaterial({ color: "#3e6b3c", roughness: 1 });
    const blossomMagenta = new THREE.MeshStandardMaterial({ color: "#c9407e", roughness: 0.85 });
    const blossomPink = new THREE.MeshStandardMaterial({ color: "#e0699b", roughness: 0.85 });
    const blossomCoral = new THREE.MeshStandardMaterial({ color: "#e08157", roughness: 0.85 });
    const glazedPot = new THREE.MeshStandardMaterial({ color: "#4e6b60", roughness: 0.3 });
    const bark = new THREE.MeshStandardMaterial({ color: "#6e5d4a", roughness: 1 });
    const stone = new THREE.MeshStandardMaterial({ color: "#c6bda9", roughness: 0.95 });
    const shadeMat = new THREE.MeshStandardMaterial({
      color: "#ead9b8", roughness: 1, side: THREE.DoubleSide,
      emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const pendantGlass = new THREE.MeshStandardMaterial({
      color: "#f2e6cf", roughness: 0.15,
      emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const coveMat = new THREE.MeshStandardMaterial({
      color: "#efe3c8", emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const sheer = new THREE.MeshStandardMaterial({
      color: "#f6efe2", roughness: 1, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    fx.current = { lampShade: shadeMat, pendantGlass, cove: coveMat, sheer };

    // ---- helpers -----------------------------------------------------------
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

    /** register a piece whose group origin sits on the floor at (x, z) */
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

    const lathe = (pts: Array<[number, number]>, mat: THREE.Material, segs = 40) =>
      new THREE.Mesh(
        new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs),
        mat
      );

    // ---- floor & rug -------------------------------------------------------
    {
      const g = new THREE.Group();
      const floor = M(new THREE.PlaneGeometry(9.82, 6.82), oakMat, 0, 0.033, 0);
      floor.rotation.x = -Math.PI / 2;
      floor.castShadow = false;
      g.add(floor);
      add(g, 0.0);
    }
    {
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      const w = 4.0, d = 3.0, r = 0.12;
      shape.moveTo(-w / 2 + r, -d / 2);
      shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
      shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      shape.lineTo(-w / 2 + r, d / 2); shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
      shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
      const rug = M(new THREE.ShapeGeometry(shape, 12), rugMat, 0, 0.048, 0, false);
      rug.rotation.x = -Math.PI / 2;
      g.add(rug);
      add(g, 0.04, -1.35, -0.6);
    }

    // ---- sectional sofa (low, rounded, chaise at the west end) -------------
    {
      const g = new THREE.Group();
      // walnut plinth with shadow gap
      g.add(M(RB(3.1, 0.1, 1.02, 0.03), walnutMat, 0, 0.07, 0));
      g.add(M(RB(1.0, 0.1, 2.0, 0.03), walnutMat, -1.08, 0.07, 0.5));
      // upholstered base
      g.add(M(RB(3.2, 0.3, 1.12, 0.09), boucleMat, 0, 0.28, 0));
      g.add(M(RB(1.06, 0.3, 2.1, 0.09), boucleMat, -1.08, 0.28, 0.52));
      // low back
      g.add(M(RB(3.2, 0.52, 0.26, 0.11), boucleMat, 0, 0.66, -0.42));
      // arms
      g.add(M(RB(0.28, 0.34, 1.1, 0.12), boucleMat, 1.47, 0.58, 0));
      g.add(M(RB(0.28, 0.34, 0.9, 0.12), boucleMat, -1.47, 0.58, -0.1));
      // seat cushions
      for (let i = 0; i < 3; i++) {
        g.add(M(RB(0.92, 0.15, 0.84, 0.065), boucleMat, -0.95 + i * 0.96, 0.5, 0.06));
      }
      g.add(M(RB(0.94, 0.15, 1.85, 0.065), boucleMat, -1.08, 0.5, 0.55));
      // back cushions, softly tilted
      for (let i = 0; i < 3; i++) {
        const c = M(RB(0.9, 0.42, 0.19, 0.09), boucleMat, -0.95 + i * 0.96, 0.78, -0.33);
        c.rotation.x = -0.14;
        g.add(c);
      }
      // throw pillows
      const p1 = M(RB(0.46, 0.42, 0.16, 0.09), linenRust, 1.18, 0.78, -0.28);
      p1.rotation.set(-0.18, 0.25, 0.06);
      const p2 = M(RB(0.4, 0.38, 0.15, 0.09), linenCream, 0.82, 0.74, -0.3);
      p2.rotation.set(-0.2, -0.15, -0.05);
      const p3 = M(RB(0.44, 0.4, 0.16, 0.09), linenOlive, -1.08, 0.74, -0.15);
      p3.rotation.set(-0.16, 0.5, 0);
      g.add(p1, p2, p3);
      // folded throw over the chaise corner
      const throwB = M(RB(0.56, 0.05, 0.42, 0.02), linenCream, -1.35, 0.6, 1.1);
      throwB.rotation.y = 0.18;
      g.add(throwB);
      add(g, 0.08, -1.4, -2.32);
    }

    // ---- travertine coffee table + styling ---------------------------------
    {
      const g = new THREE.Group();
      const drum = lathe(
        [[0.001, 0], [0.5, 0], [0.56, 0.05], [0.56, 0.3], [0.5, 0.36], [0.001, 0.36]],
        travMat, 48
      );
      drum.castShadow = true;
      drum.receiveShadow = true;
      g.add(drum);
      add(g, 0.16, -0.85, -0.15);
    }
    {
      const g = new THREE.Group();
      const b1 = M(RB(0.34, 0.028, 0.26, 0.008), linenRust, 0, 0.375, 0);
      const b2 = M(RB(0.3, 0.024, 0.23, 0.008), charcoal, 0.02, 0.402, 0.01);
      b2.rotation.y = 0.35;
      const bowl = lathe([[0.001, 0], [0.07, 0.005], [0.105, 0.04], [0.11, 0.075]], ceramic, 32);
      bowl.position.set(0.28, 0.36, -0.14);
      bowl.castShadow = true;
      g.add(b1, b2, bowl);
      add(g, 0.66, -1.05, -0.05);
    }

    // ---- sculptural swivel lounge chair + marble side table -----------------
    {
      const g = new THREE.Group();
      g.add(M(new THREE.CylinderGeometry(0.3, 0.34, 0.025, 40), brass, 0, 0.012, 0));
      g.add(M(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 16), brass, 0, 0.18, 0));
      // leather bowl shell
      const bowl = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: "#8d6742", roughness: 0.55, side: THREE.DoubleSide })
      );
      bowl.scale.set(1, 0.72, 1);
      bowl.position.y = 0.68;
      bowl.castShadow = true;
      g.add(bowl);
      // wrapping back shell
      const back = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.52, 40, 1, true, Math.PI * 0.6, Math.PI * 1.3),
        new THREE.MeshStandardMaterial({ color: "#8d6742", roughness: 0.55, side: THREE.DoubleSide })
      );
      back.position.y = 0.92;
      back.rotation.x = -0.06;
      back.castShadow = true;
      g.add(back);
      // seat + back cushions
      const seat = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 16), boucleMat);
      seat.scale.set(1, 0.32, 1);
      seat.position.y = 0.72;
      seat.castShadow = true;
      const lumbar = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 14), boucleMat);
      lumbar.scale.set(1.25, 0.72, 0.5);
      lumbar.position.set(0, 0.95, -0.26);
      g.add(seat, lumbar);
      add(g, 0.22, -3.55, 1.35, 2.4);
    }
    {
      const g = new THREE.Group();
      const t = M(new THREE.CylinderGeometry(0.24, 0.26, 0.46, 40), marbleMat, 0, 0.23, 0);
      g.add(t);
      const vase = lathe([[0.001, 0], [0.045, 0], [0.06, 0.08], [0.04, 0.16], [0.045, 0.2]], terracotta, 28);
      vase.position.y = 0.46;
      vase.castShadow = true;
      g.add(vase);
      add(g, 0.28, -4.32, 0.55);
    }

    // ---- fluted feature wall + floating console + TV (west wall) -----------
    {
      const g = new THREE.Group();
      const slat = new THREE.CylinderGeometry(0.024, 0.024, 2.82, 10);
      const n = 25;
      const inst = new THREE.InstancedMesh(slat, limedOak, n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.setPosition(0, 1.43, -1.32 + i * 0.115);
        inst.setMatrixAt(i, m4);
      }
      inst.castShadow = true;
      inst.receiveShadow = true;
      g.add(inst);
      add(g, 0.1, -4.885, 0);
    }
    {
      const g = new THREE.Group();
      const body = M(RB(0.38, 0.34, 1.9, 0.05), walnutMat, 0, 0.62, 0);
      g.add(body);
      // fine fluting on the front face
      const flute = new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8);
      const n = 26;
      const inst = new THREE.InstancedMesh(flute, walnutMat, n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.setPosition(0.19, 0.62, -0.9 + i * 0.072);
        inst.setMatrixAt(i, m4);
      }
      g.add(inst);
      // styling: stack of books + ceramic
      const bk = M(RB(0.26, 0.05, 0.2, 0.008), linenOlive, 0.02, 0.82, 0.55);
      bk.rotation.y = 0.2;
      const sph = lathe([[0.001, 0], [0.05, 0.004], [0.085, 0.05], [0.07, 0.12], [0.03, 0.15]], ceramic, 28);
      sph.position.set(0, 0.81, -0.5);
      sph.castShadow = true;
      g.add(bk, sph);
      add(g, 0.3, -4.66, 0.1);
    }
    {
      const g = new THREE.Group();
      g.add(M(RB(0.045, 0.82, 1.46, 0.012), smoked, 0, 1.62, 0));
      add(g, 0.36, -4.82, 0.1);
    }

    // ---- walnut slat screen on the partition (living face) ------------------
    {
      const g = new THREE.Group();
      const slat = RB(0.05, 2.9, 0.11, 0.02, 2);
      const n = 21;
      const inst = new THREE.InstancedMesh(slat, walnutMat, n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.setPosition(0, 1.45, -3.36 + i * 0.138);
        inst.setMatrixAt(i, m4);
      }
      inst.castShadow = true;
      inst.receiveShadow = true;
      g.add(inst);
      add(g, 0.12, 1.79, 0);
    }

    // ---- artwork ------------------------------------------------------------
    const makeArt = (w: number, h: number, seed: number) => {
      const g = new THREE.Group();
      g.add(M(RB(w + 0.09, h + 0.09, 0.04, 0.01), brass, 0, 0, 0, false));
      const cv = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: artwork(seed), roughness: 0.92 })
      );
      cv.position.z = 0.025;
      g.add(cv);
      return g;
    };
    {
      const g = new THREE.Group();
      const art = makeArt(1.7, 1.2, 0);
      art.position.y = 1.8;
      g.add(art);
      add(g, 0.42, -1.4, -3.39);
    }
    {
      const g = new THREE.Group();
      const art = makeArt(0.95, 0.72, 1);
      art.position.y = 1.72;
      g.add(art);
      add(g, 0.46, 4.89, 0.9, -Math.PI / 2);
    }

    // ---- floating shelves + books (north wall) ------------------------------
    {
      const g = new THREE.Group();
      const cols = ["#ded2b8", "#9d6a4a", "#3f3931", "#8f8a6d", "#c2a377", "#6e5d4a"];
      for (let s = 0; s < 2; s++) {
        const y = 1.32 + s * 0.46;
        g.add(M(RB(1.15, 0.035, 0.2, 0.01), limedOak, 0, y, 0));
        let x = -0.5;
        const n = 6 + ((Math.random() * 3) | 0);
        for (let b = 0; b < n; b++) {
          const bw = 0.022 + Math.random() * 0.016;
          const bh = 0.16 + Math.random() * 0.075;
          const book = M(
            RB(bw, bh, 0.13 + Math.random() * 0.04, 0.004, 2),
            new THREE.MeshStandardMaterial({ color: cols[(Math.random() * cols.length) | 0], roughness: 0.9 }),
            x, y + 0.02 + bh / 2, 0
          );
          g.add(book);
          x += bw + 0.008;
        }
        // one horizontal stack
        g.add(M(RB(0.16, 0.024, 0.12, 0.005, 2), ceramic, 0.38, y + 0.03, 0));
        g.add(M(RB(0.14, 0.022, 0.11, 0.005, 2), linenRust, 0.39, y + 0.055, 0.01));
      }
      add(g, 0.5, 0.78, -3.3);
    }

    // ---- floor lamp (brass stem, linen drum) --------------------------------
    {
      const g = new THREE.Group();
      g.add(M(new THREE.CylinderGeometry(0.15, 0.17, 0.02, 32), brass, 0, 0.01, 0));
      g.add(M(new THREE.CylinderGeometry(0.011, 0.011, 1.44, 12), brass, 0, 0.74, 0));
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 0.3, 32, 1, true),
        shadeMat
      );
      shade.position.y = 1.56;
      shade.castShadow = true;
      g.add(shade);
      add(g, 0.56, -4.28, -2.72);
    }

    // ---- dining: oval table, chairs, pendant cluster, sideboard -------------
    {
      const g = new THREE.Group();
      const top = M(new THREE.CylinderGeometry(1, 1, 0.05, 56), walnutMat, 0, 0.73, 0);
      top.scale.set(0.58, 1, 1.18);
      const apron = M(new THREE.CylinderGeometry(0.86, 0.8, 0.05, 48), walnutMat, 0, 0.685, 0);
      apron.scale.set(0.5, 1, 1.05);
      g.add(top, apron);
      for (const dz of [-0.62, 0.62]) {
        g.add(M(new THREE.CylinderGeometry(0.085, 0.1, 0.66, 28), bronze, 0, 0.33, dz));
        g.add(M(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32), bronze, 0, 0.01, dz));
      }
      // centerpiece
      const vs = lathe([[0.001, 0], [0.06, 0], [0.1, 0.07], [0.09, 0.16], [0.045, 0.2], [0.05, 0.26]], ceramic, 32);
      vs.position.y = 0.755;
      vs.castShadow = true;
      g.add(vs);
      add(g, 0.2, 3.55, -0.9);
    }
    {
      // four upholstered chairs
      const mkChair = () => {
        const g = new THREE.Group();
        g.add(M(RB(0.44, 0.06, 0.43, 0.025), walnutMat, 0, 0.44, 0));
        g.add(M(RB(0.42, 0.06, 0.4, 0.03), linenCream, 0, 0.5, 0));
        const back = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.5, 28, 1, true, Math.PI * 0.68, Math.PI * 0.64),
          new THREE.MeshStandardMaterial({ color: "#e7dcc4", roughness: 1, side: THREE.DoubleSide })
        );
        back.position.set(0, 0.72, 0.06);
        back.rotation.x = 0.08;
        back.castShadow = true;
        g.add(back);
        for (const [lx, lz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) {
          g.add(M(new THREE.CylinderGeometry(0.013, 0.011, 0.44, 10), bronze, lx, 0.22, lz));
        }
        return g;
      };
      add(mkChair(), 0.26, 2.92, -0.42, -Math.PI / 2);
      add(mkChair(), 0.3, 2.92, -1.42, -Math.PI / 2);
      add(mkChair(), 0.34, 4.18, -0.42, Math.PI / 2);
      add(mkChair(), 0.38, 4.18, -1.42, Math.PI / 2);
    }
    {
      // blown-glass pendant cluster
      const g = new THREE.Group();
      g.add(M(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 24), brass, 0, 2.85, 0, false));
      const drops: Array<[number, number, number, number]> = [
        [0, 1.92, -0.12, 0.095],
        [0.15, 2.08, 0.07, 0.07],
        [-0.15, 2.0, 0.1, 0.082],
      ];
      for (const [dx, dy, dz, r] of drops) {
        const cord = M(new THREE.CylinderGeometry(0.0035, 0.0035, 2.86 - dy, 6), charcoal, dx, dy + (2.86 - dy) / 2, dz, false);
        const globe = M(new THREE.SphereGeometry(r, 28, 20), pendantGlass, dx, dy, dz, false);
        g.add(cord, globe);
      }
      add(g, 0.62, 3.55, -0.9);
    }
    {
      // floating fluted sideboard on the east wall
      const g = new THREE.Group();
      g.add(M(RB(0.4, 0.42, 1.7, 0.05), walnutMat, 0, 0.6, 0));
      const flute = new THREE.CylinderGeometry(0.015, 0.015, 0.38, 8);
      const inst = new THREE.InstancedMesh(flute, walnutMat, 23);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 23; i++) {
        m4.setPosition(-0.2, 0.6, -0.8 + i * 0.072);
        inst.setMatrixAt(i, m4);
      }
      g.add(inst);
      const v1 = lathe([[0.001, 0], [0.055, 0], [0.1, 0.06], [0.11, 0.15], [0.07, 0.23], [0.04, 0.27], [0.045, 0.31]], terracotta, 32);
      v1.position.set(0, 0.81, -0.45);
      v1.castShadow = true;
      const v2 = lathe([[0.001, 0], [0.05, 0], [0.068, 0.1], [0.06, 0.22], [0.032, 0.3], [0.028, 0.38]], ceramic, 32);
      v2.position.set(0.02, 0.81, -0.18);
      v2.castShadow = true;
      g.add(v1, v2);
      // dry branches in the tall vase
      for (let b = 0; b < 3; b++) {
        const br = M(new THREE.CylinderGeometry(0.003, 0.005, 0.5, 5), bark, 0.02 + (b - 1) * 0.015, 1.4, -0.18, false);
        br.rotation.z = (b - 1) * 0.22;
        br.rotation.x = (b - 1) * 0.12;
        g.add(br);
      }
      add(g, 0.44, 4.68, 0.9);
    }

    // ---- blooming bougainvillea in the SW corner -----------------------------
    {
      const g = new THREE.Group();
      const pot = lathe([[0.001, 0], [0.15, 0], [0.2, 0.1], [0.215, 0.32]], glazedPot, 36);
      pot.castShadow = true;
      pot.receiveShadow = true;
      g.add(pot);
      g.add(M(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 24), soil, 0, 0.315, 0, false));
      const t1 = M(new THREE.CylinderGeometry(0.026, 0.038, 0.75, 10), bark, 0, 0.68, 0);
      t1.rotation.z = 0.08;
      const t2 = M(new THREE.CylinderGeometry(0.016, 0.024, 0.55, 8), bark, 0.1, 1.22, 0.02);
      t2.rotation.z = 0.28;
      g.add(t1, t2);
      const leaves: Array<[number, number, number, number]> = [
        [0.1, 1.62, 0, 0.32],
        [-0.18, 1.48, 0.1, 0.25],
        [0.32, 1.44, -0.08, 0.23],
        [0.05, 1.8, -0.12, 0.21],
        [-0.05, 1.38, -0.2, 0.19],
      ];
      for (const [bx, by, bz, r] of leaves) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), leafGreen);
        s.scale.y = 0.78;
        s.position.set(bx, by, bz);
        s.castShadow = true;
        g.add(s);
      }
      // blossom clusters draped over the canopy
      const blossoms: Array<[number, number, number, number, THREE.Material]> = [
        [0.16, 1.84, 0.1, 0.14, blossomMagenta],
        [-0.08, 1.92, -0.06, 0.12, blossomPink],
        [0.3, 1.66, 0.14, 0.12, blossomPink],
        [-0.3, 1.56, 0.16, 0.11, blossomMagenta],
        [0.44, 1.5, -0.02, 0.11, blossomCoral],
        [0.02, 1.68, 0.24, 0.12, blossomMagenta],
        [-0.2, 1.7, -0.14, 0.1, blossomCoral],
        [0.2, 1.46, 0.2, 0.1, blossomPink],
        [-0.14, 1.32, 0.14, 0.09, blossomMagenta],
        [0.4, 1.32, -0.16, 0.09, blossomPink],
        [0.08, 1.98, 0.02, 0.1, blossomCoral],
        [-0.02, 1.5, -0.28, 0.09, blossomPink],
      ];
      for (const [bx, by, bz, r, mt] of blossoms) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mt);
        s.scale.y = 0.82;
        s.position.set(bx, by, bz);
        s.castShadow = true;
        g.add(s);
      }
      add(g, 0.72, -4.25, 2.5);
    }

    // ---- ceiling cove strips -------------------------------------------------
    {
      const g = new THREE.Group();
      const mk = (w: number, d: number, x: number, z: number) =>
        M(new THREE.BoxGeometry(w, 0.02, d), coveMat, x, 2.915, z, false);
      g.add(mk(8.3, 0.05, 0, -2.75));
      g.add(mk(8.3, 0.05, 0, 2.75));
      g.add(mk(0.05, 5.4, -4.24, 0));
      g.add(mk(0.05, 5.4, 4.24, 0));
      add(g, 0.55);
    }

    // ---- sheer drapes flanking the glazing ----------------------------------
    {
      const mkDrape = (x: number) => {
        const geo = new THREE.PlaneGeometry(1.45, 2.8, 48, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          pos.setZ(i, Math.sin(vx * 12.5) * 0.06);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, sheer);
        m.position.set(x, 1.46, 3.28);
        return m;
      };
      const g = new THREE.Group();
      g.add(mkDrape(-2.75), mkDrape(2.75));
      add(g, 0.8);
    }

    // ---- the garden beyond the glass ----------------------------------------
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

    const f = fx.current;
    const L = store.lightLevel;
    if (f.lampShade) f.lampShade.emissiveIntensity = 1.5 * L;
    if (f.pendantGlass) f.pendantGlass.emissiveIntensity = 1.9 * L;
    if (f.cove) f.cove.emissiveIntensity = 2.6 * L;
    if (f.sheer) f.sheer.opacity = store.sheerLevel;
  });

  return <primitive object={groupRef.current} />;
}
