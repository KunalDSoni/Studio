"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useFrame } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";
import { oakFloor, walnut, travertine, boucle, artwork } from "@/lib/textures";

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
    cove?: THREE.MeshStandardMaterial;
    sheer?: THREE.MeshStandardMaterial;
    fan?: THREE.Group;
    acVent?: THREE.Object3D;
    chand?: THREE.MeshStandardMaterial;
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
    const boucleMat = new THREE.MeshStandardMaterial({ map: boucle(), roughness: 1 });
    const rugMat = new THREE.MeshStandardMaterial({
      map: boucle(), color: "#8a7d63", roughness: 1,
    });
    const limedOak = new THREE.MeshStandardMaterial({ color: "#c9b692", roughness: 0.8 });
    const linenCream = new THREE.MeshStandardMaterial({ color: "#e7dcc4", roughness: 1 });
    const linenRust = new THREE.MeshStandardMaterial({ color: "#a06a48", roughness: 1 });
    const linenOlive = new THREE.MeshStandardMaterial({ color: "#8f8a6d", roughness: 1 });
    const linenMustard = new THREE.MeshStandardMaterial({ color: "#c2913d", roughness: 1 });
    const linenTeal = new THREE.MeshStandardMaterial({ color: "#4f6f68", roughness: 1 });
    const leather = new THREE.MeshStandardMaterial({ color: "#8d6742", roughness: 0.55 });
    const brass = new THREE.MeshStandardMaterial({ color: "#b3915c", metalness: 0.85, roughness: 0.35 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#6b543a", metalness: 0.8, roughness: 0.45 });
    const ceramic = new THREE.MeshStandardMaterial({ color: "#eae2d0", roughness: 0.9 });
    const terracotta = new THREE.MeshStandardMaterial({ color: "#a3714f", roughness: 0.95 });
    const charcoal = new THREE.MeshStandardMaterial({ color: "#35302a", roughness: 0.9 });
    const smoked = new THREE.MeshStandardMaterial({ color: "#151210", metalness: 0.4, roughness: 0.14 });
    const shadeMat = new THREE.MeshStandardMaterial({
      color: "#ead9b8", roughness: 1, side: THREE.DoubleSide,
      emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const coveMat = new THREE.MeshStandardMaterial({
      color: "#efe3c8", emissive: "#ffd9a4", emissiveIntensity: 0,
    });
    const sheer = new THREE.MeshStandardMaterial({
      color: "#f6efe2", roughness: 1, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    fx.current = { lampShade: shadeMat, cove: coveMat, sheer };

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
      // throw pillows — eight distinct colours, no repeats, no white/grey
      const cushion = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
      const lean = -0.16;
      const pRect1 = M(RB(0.52, 0.36, 0.15, 0.08), cushion("#a35c3a"), 1.05, 0.74, -0.24); // rust
      pRect1.rotation.x = lean;
      const pSq1 = M(RB(0.4, 0.4, 0.15, 0.08), cushion("#c2913d"), 0.55, 0.76, -0.26); // ochre
      pSq1.rotation.x = lean;
      const pRound = M(new THREE.CylinderGeometry(0.21, 0.21, 0.13, 28), cushion("#3f6f68"), 0, 0.77, -0.26); // teal
      pRound.rotation.x = Math.PI / 2 + lean;
      const pSq2 = M(RB(0.4, 0.4, 0.15, 0.08), cushion("#7a4048"), -0.55, 0.76, -0.26); // wine
      pSq2.rotation.x = lean;
      const pRect2 = M(RB(0.52, 0.36, 0.15, 0.08), cushion("#7f8a5c"), -1.05, 0.74, -0.24); // sage
      pRect2.rotation.x = lean;
      g.add(pRect1, pSq1, pRound, pSq2, pRect2);
      // a front layer of cushions overlapping the back row for a lived-in look
      const pOv1 = M(RB(0.42, 0.42, 0.16, 0.09), cushion("#5a6a7c"), 0.8, 0.72, -0.05); // slate blue
      pOv1.rotation.set(-0.3, 0.18, 0.13);
      const pOv3 = M(RB(0.42, 0.42, 0.16, 0.09), cushion("#866172"), -0.82, 0.72, -0.05); // mauve
      pOv3.rotation.set(-0.3, 0.22, 0.1);
      g.add(pOv1, pOv3);
      add(g, 0.08, -1.4, -2.32);
    }

    // ---- brass ring chandelier over the living room --------------------------
    {
      const g = new THREE.Group();
      g.add(M(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 24), brass, 0, 2.88, 0, false));
      g.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 10), charcoal, 0, 2.64, 0, false));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 12, 48), brass);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.38;
      ring.castShadow = true;
      g.add(ring);
      const chandGlass = new THREE.MeshStandardMaterial({
        color: "#f2e6cf", roughness: 0.15,
        emissive: "#ffd9a4", emissiveIntensity: 0,
      });
      fx.current.chand = chandGlass;
      // glass globes staggered around the ring
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const gx = Math.cos(a) * 0.36;
        const gz = Math.sin(a) * 0.36;
        const drop = 0.1 + (i % 2) * 0.09;
        g.add(M(new THREE.CylinderGeometry(0.003, 0.003, drop, 6), charcoal, gx, 2.38 - drop / 2, gz, false));
        g.add(M(new THREE.SphereGeometry(0.055, 20, 14), chandGlass, gx, 2.38 - drop - 0.045, gz, false));
      }
      add(g, 0.6, -0.85, -0.15);
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
      // oversized architecture & design books — big, heavy, casually stacked
      const g = new THREE.Group();
      const cover = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
      const b1 = M(RB(0.48, 0.06, 0.37, 0.006, 2), cover("#3f4a4a"), 0, 0.39, 0);        // deep slate
      const b2 = M(RB(0.45, 0.055, 0.35, 0.006, 2), cover("#a3714f"), 0.02, 0.4475, 0.015); // terracotta
      b2.rotation.y = 0.13;
      const b3 = M(RB(0.42, 0.05, 0.32, 0.006, 2), cover("#c9b692"), -0.015, 0.5, -0.01); // linen tan
      b3.rotation.y = -0.1;
      g.add(b1, b2, b3);
      // slightly left of the table center, fully on the top
      add(g, 0.66, -0.98, -0.15);
    }
    {
      // AC + TV remotes resting on the table beside the books
      const g = new THREE.Group();
      const y = 0.368;
      const mkRemote = (bodyC: string, padC: string, len: number) => {
        const r = new THREE.Group();
        r.add(M(RB(0.048, 0.016, len, 0.008, 2), new THREE.MeshStandardMaterial({ color: bodyC, roughness: 0.5 }), 0, 0, 0, false));
        r.add(M(RB(0.03, 0.005, len - 0.05, 0.004, 2), new THREE.MeshStandardMaterial({ color: padC, roughness: 0.7 }), 0, 0.0105, 0, false));
        return r;
      };
      const ac = mkRemote("#f2efe8", "#cfc8b8", 0.15);   // white AC remote
      ac.position.set(0, y, 0);
      ac.rotation.y = 0.35;
      const tv = mkRemote("#1c1a18", "#3a3632", 0.17);   // black TV remote
      tv.position.set(0.09, y, 0.02);
      tv.rotation.y = -0.12;
      g.add(ac, tv);
      add(g, 0.67, -0.62, -0.08);
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
      // styling: stack of books
      const bk = M(RB(0.26, 0.05, 0.2, 0.008), linenOlive, 0.02, 0.82, 0.55);
      bk.rotation.y = 0.2;
      g.add(bk);
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

    // ---- split AC high on the partition, front facing the TV wall -----------
    {
      const g = new THREE.Group();
      g.add(M(RB(0.24, 0.3, 0.9, 0.06), ceramic, 0, 2.52, 0));
      // dark outlet slot recessed into the lower front
      g.add(M(RB(0.07, 0.12, 0.8, 0.01), charcoal, -0.08, 2.41, 0, false));
      // white deflector louver INSIDE the slot: its front edge sweeps up and down
      // between the top and bottom black lines, always contained within the slot
      const louverMat = new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.7 });
      const ventPivot = new THREE.Group();
      ventPivot.position.set(-0.05, 2.41, 0);
      const blade = M(RB(0.065, 0.014, 0.76, 0.005, 2), louverMat, -0.03, 0, 0, false);
      ventPivot.add(blade);
      g.add(ventPivot);
      fx.current.acVent = ventPivot;
      // power LED — the unit is running
      const acLed = new THREE.MeshStandardMaterial({
        color: "#3a4a3f", emissive: "#54ff9a", emissiveIntensity: 2,
      });
      g.add(M(RB(0.012, 0.03, 0.03, 0.005, 2), acLed, -0.122, 2.58, 0.38, false));
      add(g, 0.42, 1.645, -1.9);
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

    // ---- designer library unit: dark frame, glass side cabinets, oak bay ----
    {
      const g = new THREE.Group();
      // spines skew blue/teal like the reference, with warm accents
      const bookCols = [
        "#3a5f7d", "#6d8ba0", "#2f4858", "#b5c4c9", "#c98a5a",
        "#8a4a3a", "#d8cdb6", "#4f6f68", "#9d6a4a", "#3f3931",
      ];
      const caseDark = new THREE.MeshStandardMaterial({ color: "#262a30", roughness: 0.6, metalness: 0.1 });
      const bayOak = new THREE.MeshStandardMaterial({ color: "#c19a68", roughness: 0.7 });
      const glass = new THREE.MeshStandardMaterial({
        color: "#aebab6", roughness: 0.06, metalness: 0.1,
        transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
      });

      const Wt = 1.45, Ht = 1.85, Dp = 0.3;
      const hw = Wt / 2;      // outer half-width
      const cx = 0.36;        // center-bay half-width (bay spans -cx..cx)
      const pt = 0.04;        // panel thickness
      const backZ = -Dp / 2 + 0.01;
      const frontZ = Dp / 2;

      // outer case + two dividers
      g.add(M(RB(pt, Ht, Dp, 0.008), caseDark, -hw + pt / 2, Ht / 2, 0));
      g.add(M(RB(pt, Ht, Dp, 0.008), caseDark, hw - pt / 2, Ht / 2, 0));
      g.add(M(RB(pt, Ht, Dp, 0.008), caseDark, -cx, Ht / 2, 0));
      g.add(M(RB(pt, Ht, Dp, 0.008), caseDark, cx, Ht / 2, 0));
      g.add(M(RB(Wt, pt, Dp, 0.008), caseDark, 0, Ht - pt / 2, 0));  // top
      g.add(M(RB(Wt, 0.06, Dp, 0.008), caseDark, 0, 0.03, 0));       // base
      // back panels: dark across, warm oak lining the center bay
      g.add(M(new THREE.BoxGeometry(Wt, Ht - 0.1, 0.014), caseDark, 0, Ht / 2, backZ - 0.006, false));
      g.add(M(new THREE.BoxGeometry(2 * cx - pt, Ht - 0.12, 0.016), bayOak, 0, Ht / 2, backZ + 0.006, false));

      const shelfY = [0.06, 0.52, 0.98, 1.44];
      for (let s = 1; s < shelfY.length; s++) {
        g.add(M(RB(Wt - 2 * pt, 0.028, Dp - 0.02, 0.006), caseDark, 0, shelfY[s], 0));
        g.add(M(RB(2 * cx - pt, 0.03, Dp - 0.02, 0.006), bayOak, 0, shelfY[s] + 0.001, 0.002));
      }

      const fill = (x0: number, x1: number, y: number, maxH: number) => {
        let x = x0;
        while (x < x1) {
          const bw = 0.02 + Math.random() * 0.016;
          const bh = maxH - 0.06 + Math.random() * 0.06;
          g.add(M(
            RB(bw, bh, 0.15 + Math.random() * 0.04, 0.004, 2),
            new THREE.MeshStandardMaterial({ color: bookCols[(Math.random() * bookCols.length) | 0], roughness: 0.9 }),
            x + bw / 2, y + bh / 2, 0
          ));
          x += bw + 0.006;
          if (Math.random() < 0.1) x += 0.025 + Math.random() * 0.03;
        }
      };
      const stack = (x: number, y: number, w: number, n: number) => {
        for (let i = 0; i < n; i++) {
          g.add(M(
            RB(w - i * 0.012, 0.026, 0.2 - i * 0.01, 0.005, 2),
            new THREE.MeshStandardMaterial({ color: bookCols[(i * 3) % bookCols.length], roughness: 0.9 }),
            x, y + 0.026 * i + 0.013, 0
          ));
        }
      };

      // side glass cabinets: books on every shelf
      for (let s = 0; s < shelfY.length; s++) {
        fill(-hw + pt + 0.03, -cx - 0.04, shelfY[s] + 0.03, 0.26 + (s % 2) * 0.04);
        fill(cx + 0.04, hw - pt - 0.03, shelfY[s] + 0.03, 0.26 + (s % 2) * 0.04);
      }
      // glass doors + mullions + brass knobs on the side bays
      const bayW = hw - cx - pt;
      for (const side of [-1, 1]) {
        const bcx = side * (hw + cx) / 2;
        g.add(M(new THREE.PlaneGeometry(bayW, Ht - 0.12), glass, bcx, Ht / 2, frontZ, false));
        g.add(M(RB(0.02, Ht - 0.14, 0.012, 0.004), caseDark, bcx, Ht / 2, frontZ - 0.006, false));
        g.add(M(new THREE.SphereGeometry(0.016, 12, 8), brass, bcx - 0.05, 1.1, frontZ - 0.01, false));
        g.add(M(new THREE.SphereGeometry(0.016, 12, 8), brass, bcx + 0.05, 1.1, frontZ - 0.01, false));
      }

      // center bay styling --------------------------------------------------
      // top shelf: books flanking an open brass lantern
      fill(-cx + 0.06, -0.12, shelfY[3] + 0.03, 0.3);
      fill(0.16, cx - 0.06, shelfY[3] + 0.03, 0.3);
      g.add(M(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 6, 1, true), brass, 0, shelfY[3] + 0.13, 0.02));

      // third shelf: books, with a dark box as the only accent
      fill(-cx + 0.06, 0.06, shelfY[2] + 0.03, 0.3);
      const box2 = M(RB(0.24, 0.085, 0.2, 0.01), charcoal, 0.18, shelfY[2] + 0.073, 0);
      box2.rotation.y = -0.05;
      g.add(box2);

      // second shelf: books + a dark box
      fill(-cx + 0.06, 0.02, shelfY[1] + 0.03, 0.3);
      const box = M(RB(0.26, 0.09, 0.22, 0.01), charcoal, 0.2, shelfY[1] + 0.075, 0);
      box.rotation.y = 0.06;
      g.add(box);

      // bottom shelf: stacked coffee-table books + books
      stack(-cx + 0.24, shelfY[0] + 0.03, 0.36, 3);
      fill(0.1, cx - 0.06, shelfY[0] + 0.03, 0.34);

      // living-room nook: right of the sofa, just off the wall and partition
      add(g, 0.5, 0.98, -3.3);
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

    // ---- dining: oval walnut table on fluted pedestals, six chairs ----------
    {
      const g = new THREE.Group();
      const top = M(new THREE.CylinderGeometry(1, 1, 0.055, 64), walnutMat, 0, 0.735, 0);
      top.scale.set(0.6, 1, 1.4);
      const apron = M(new THREE.CylinderGeometry(0.92, 0.88, 0.06, 56), walnutMat, 0, 0.69, 0);
      apron.scale.set(0.52, 1, 1.24);
      g.add(top, apron);
      // two fluted (reeded) walnut drum pedestals
      const mkPed = (dz: number) => {
        g.add(M(new THREE.CylinderGeometry(0.2, 0.22, 0.64, 28), walnutMat, 0, 0.34, dz));
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          g.add(M(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 6), walnutMat, Math.cos(a) * 0.215, 0.34, dz + Math.sin(a) * 0.215, false));
        }
        g.add(M(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 32), walnutMat, 0, 0.015, dz));
      };
      mkPed(-0.72);
      mkPed(0.72);
      add(g, 0.2, 3.55, -0.9);
    }
    {
      // fruit basket centrepiece on the dining table
      const g = new THREE.Group();
      const wicker = new THREE.MeshStandardMaterial({ color: "#b9915c", roughness: 0.9 });
      const y0 = 0.7625; // table-top surface
      g.add(M(new THREE.CylinderGeometry(0.23, 0.17, 0.12, 22), wicker, 0, y0 + 0.06, 0));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.014, 8, 24), wicker);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, y0 + 0.12, 0);
      g.add(rim);
      const fruitCols = ["#b83c2e", "#e08a3c", "#7fa03c", "#d9be3f", "#8a4a6a", "#c94f38"];
      const fruit = (fx: number, fz: number, fy: number, r: number, c: string) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
        s.position.set(fx, y0 + 0.1 + fy, fz);
        s.castShadow = true;
        g.add(s);
      };
      const ring: Array<[number, number, number, number]> = [
        [0.09, 0, 0, 0.058], [-0.05, 0.08, 0, 0.055], [-0.08, -0.06, 0, 0.056],
        [0.02, -0.09, 0, 0.054], [0.07, 0.07, 0, 0.05], [0, 0.02, 0, 0.058],
      ];
      ring.forEach(([fx, fz, fy, r], i) => fruit(fx, fz, fy, r, fruitCols[i % fruitCols.length]));
      // a couple mounded on top
      fruit(-0.02, 0.0, 0.09, 0.05, fruitCols[3]);
      fruit(0.05, -0.03, 0.08, 0.048, fruitCols[2]);
      add(g, 0.24, 3.55, -0.9);
    }
    {
      // six upholstered barrel-back chairs on splayed wood legs
      const seatFabric = new THREE.MeshStandardMaterial({ color: "#d8cdb6", roughness: 1 });
      const chairWood = new THREE.MeshStandardMaterial({ color: "#5a4632", roughness: 0.6 });
      const mkChair = () => {
        const c = new THREE.Group();
        // seat cushion
        c.add(M(RB(0.46, 0.11, 0.44, 0.055), seatFabric, 0, 0.45, 0));
        // upholstered back with a soft, curved (rounded) top — a flattened capsule
        const back = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.21, 0.2, 6, 20),
          new THREE.MeshStandardMaterial({ color: "#d8cdb6", roughness: 1 })
        );
        back.scale.set(1.0, 1, 0.34);
        back.position.set(0, 0.72, 0.16);
        back.rotation.x = -0.12;
        back.castShadow = true;
        c.add(back);
        // four tapered wood legs, splayed
        const legGeo = new THREE.CylinderGeometry(0.02, 0.014, 0.48, 10);
        const mkLeg = (lx: number, lz: number, ax: number, az: number) => {
          const l = M(legGeo, chairWood, lx, 0.23, lz);
          l.rotation.set(ax, 0, az);
          return l;
        };
        c.add(mkLeg(-0.19, -0.17, 0.14, 0.09));
        c.add(mkLeg(0.19, -0.17, 0.14, -0.09));
        c.add(mkLeg(-0.19, 0.17, -0.12, 0.09));
        c.add(mkLeg(0.19, 0.17, -0.12, -0.09));
        return c;
      };
      let ord = 0.26;
      for (const z of [-1.72, -0.9, -0.08]) {
        add(mkChair(), ord, 2.75, z, -Math.PI / 2); ord += 0.02;
        add(mkChair(), ord, 4.35, z, Math.PI / 2); ord += 0.02;
      }
    }
    {
      // ceiling fan over the dining table
      const g = new THREE.Group();
      g.add(M(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 24), brass, 0, 2.85, 0, false));
      g.add(M(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 10), charcoal, 0, 2.72, 0, false));
      g.add(M(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 24), brass, 0, 2.54, 0));
      const blades = new THREE.Group();
      blades.position.y = 2.57;
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.y = (i * Math.PI) / 2;
        const blade = M(RB(0.6, 0.014, 0.13, 0.007), walnutMat, 0.42, 0, 0);
        blade.rotation.x = 0.14;
        arm.add(blade);
        blades.add(arm);
      }
      g.add(blades);
      fx.current.fan = blades;
      add(g, 0.62, 3.55, -0.9);
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

    groupRef.current = root;
  }

  useFrame((state, delta) => {
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
    if (f.cove) f.cove.emissiveIntensity = 2.6 * L;
    if (f.chand) f.chand.emissiveIntensity = 1.9 * L;
    if (f.sheer) f.sheer.opacity = store.sheerLevel;
    if (f.fan) f.fan.rotation.y += delta * 6.5;
    // AC swing: flap sweeps slowly between nearly-closed and wide open
    // deflector sweeps up and down within the slot, between the black lines
    if (f.acVent) f.acVent.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.7;
  });

  return <primitive object={groupRef.current} />;
}
