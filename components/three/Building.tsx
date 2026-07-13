"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";
import { blocks, slab, roof, type Block, type MaterialKind } from "@/lib/house";
import { plaster } from "@/lib/textures";

interface Rec {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
  block: Block;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The architecture: walls rise as CAD wireframes, then faces fade from
 * nothing to textured plaster, concrete, glass and bronze-framed glazing.
 * Furniture and styling live in Interior.tsx.
 */
export function Building() {
  const recs = useRef<Rec[]>([]);
  const slabRec = useRef<Rec | null>(null);
  const roofRec = useRef<Rec | null>(null);
  const shadowMat = useRef<THREE.ShadowMaterial>(null!);

  const groupRef = useRef<THREE.Group | null>(null);
  if (groupRef.current === null) {
    const g = new THREE.Group();
    recs.current = [];
    const plasterMap = plaster();

    const params = (kind: MaterialKind): THREE.MeshStandardMaterialParameters => {
      switch (kind) {
        case "plaster":
          return { color: "#f0e9da", map: plasterMap, roughness: 0.95 };
        case "concrete":
          return { color: "#cfc7b8", map: plasterMap, roughness: 0.97 };
        case "wood":
          return { color: "#a5794f", roughness: 0.55 };
        case "steel":
          return { color: "#3a322a", roughness: 0.45, metalness: 0.6 };
        case "fabric":
          return { color: "#d6c9af", roughness: 1 };
        case "glass":
          return { color: "#d8e4e4", roughness: 0.08, metalness: 0 };
      }
    };

    const makeBox = (b: Block): Rec => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      geo.translate(0, b.h / 2, 0);
      const mat = new THREE.MeshStandardMaterial({
        ...params(b.mat),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        visible: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, b.y, b.z);
      mesh.scale.y = 0.0001;
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;

      const edgeMat = new THREE.LineBasicMaterial({
        color: "#3c2a1e",
        transparent: true,
        opacity: 0,
      });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      mesh.add(edges);
      g.add(mesh);
      return { mesh, mat, edgeMat, block: b };
    };

    for (const b of blocks) recs.current.push(makeBox(b));

    slabRec.current = makeBox({
      x: 0, z: 0, w: slab.w, d: slab.d, y: -slab.h, h: slab.h,
      mat: "concrete", rise: 0,
    });
    roofRec.current = makeBox({
      x: 0, z: 0, w: roof.w, d: roof.d, y: roof.y, h: roof.h,
      mat: "concrete", rise: 0,
    });
    groupRef.current = g;
  }
  const group = groupRef.current;

  useFrame(() => {
    const p = store.progress;
    const riseP = easeInOut(seg(p, 0.31, 0.53));
    const matP = easeInOut(seg(p, 0.5, 0.65));
    const edgeFade = 1 - seg(p, 0.7, 0.82);

    const apply = (r: Rec, local: number, opacity: number, edge: number) => {
      const visible = local > 0.002;
      r.mesh.visible = visible;
      r.mesh.scale.y = Math.max(local, 0.0001);
      r.mat.opacity = opacity;
      r.mat.visible = opacity > 0.01;
      r.mat.depthWrite = opacity > 0.2 && r.block.mat !== "glass";
      r.mesh.castShadow = opacity > 0.25 && r.block.mat !== "glass";
      r.edgeMat.opacity = edge * (visible ? 1 : 0);
    };

    for (const r of recs.current) {
      const b = r.block;
      const local = easeOutCubic(seg(riseP, b.rise * 0.55, b.rise * 0.55 + 0.45));
      const opacity = b.mat === "glass" ? matP * 0.18 : matP;
      const edge = (0.5 * (1 - matP) + 0.14 * matP) * edgeFade;
      apply(r, local, opacity, edge);
    }

    if (slabRec.current) {
      const local = easeOutCubic(seg(p, 0.27, 0.34));
      apply(slabRec.current, local, matP, 0.5 * (1 - matP) * edgeFade + 0.1 * matP * edgeFade);
    }
    if (roofRec.current) {
      const local = easeOutCubic(seg(p, 0.47, 0.545));
      apply(roofRec.current, local, matP, 0.5 * (1 - matP) * edgeFade + 0.1 * matP * edgeFade);
    }

    shadowMat.current.opacity = 0.15 * matP;
  });

  return (
    <>
      <primitive object={group} />

      {/* the paper ground only ever receives shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <shadowMaterial ref={shadowMat} opacity={0} />
      </mesh>
    </>
  );
}
