"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { store, seg, easeInOut } from "@/lib/store";
import { planSegments, W, D } from "@/lib/house";

// CAD linework at ground level: a drafting grid, then the floor plan and
// dimension marks, each stroke drawing on from its start point.
const VERT = /* glsl */ `
attribute float aEnd;
attribute float aOrder;
attribute float aTone;
varying float vEnd;
varying float vOrder;
varying float vTone;
void main() {
  vEnd = aEnd;
  vOrder = aOrder;
  vTone = aTone;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uDraw;
uniform float uAlpha;
varying float vEnd;
varying float vOrder;
varying float vTone;
void main() {
  float f = clamp((uDraw * 1.35 - vOrder) * 3.2, 0.0, 1.0);
  float a = smoothstep(vEnd + 0.015, vEnd - 0.015, f) * vTone * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.24, 0.17, 0.12, a);
}
`;

export function Blueprint() {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const pos: number[] = [];
    const end: number[] = [];
    const order: number[] = [];
    const tone: number[] = [];
    const Y = 0.02;

    const push = (
      x1: number, z1: number, x2: number, z2: number,
      o: number, t: number
    ) => {
      pos.push(x1, Y, z1, x2, Y, z2);
      end.push(0, 1);
      order.push(o, o);
      tone.push(t, t);
    };

    // drafting grid, first to appear, very faint
    for (let x = -13; x <= 13; x++) {
      push(x, -9, x, 9, Math.random() * 0.2, 0.16);
    }
    for (let z = -9; z <= 9; z++) {
      push(-13, z, 13, z, Math.random() * 0.2, 0.16);
    }
    // footprint boundary, slightly stronger
    push(-W / 2, -D / 2, W / 2, -D / 2, 0.22, 0.5);
    push(W / 2, -D / 2, W / 2, D / 2, 0.26, 0.5);
    push(W / 2, D / 2, -W / 2, D / 2, 0.3, 0.5);
    push(-W / 2, D / 2, -W / 2, -D / 2, 0.34, 0.5);
    // the plan itself
    const segs = planSegments();
    segs.forEach(([x1, z1, x2, z2], i) => {
      push(x1, z1, x2, z2, 0.36 + (i / segs.length) * 0.5, 1.0);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aEnd", new THREE.Float32BufferAttribute(end, 1));
    geo.setAttribute("aOrder", new THREE.Float32BufferAttribute(order, 1));
    geo.setAttribute("aTone", new THREE.Float32BufferAttribute(tone, 1));
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({ uDraw: { value: 0 }, uAlpha: { value: 0 } }),
    []
  );

  useFrame(() => {
    const p = store.progress;
    const u = material.current!.uniforms;
    u.uDraw.value = easeInOut(seg(p, 0.09, 0.34));
    u.uAlpha.value = seg(p, 0.08, 0.12) * (1 - seg(p, 0.58, 0.72));
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}
