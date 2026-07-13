"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { store } from "@/lib/store";

const POOL = 6;

/**
 * Click feedback: a CAD survey mark (circle + crosshair) blooms at each
 * blueprint anchor, always facing the camera, then quietly withdraws.
 */
export function Anchors() {
  const groupRefs = useRef<THREE.Group[]>([]);
  const matRefs = useRef<THREE.LineBasicMaterial[]>([]);

  const markGeo = useMemo(() => {
    const pts: number[] = [];
    const R = 0.55;
    const N = 48;
    for (let i = 0; i < N; i++) {
      const a1 = (i / N) * Math.PI * 2;
      const a2 = ((i + 1) / N) * Math.PI * 2;
      pts.push(Math.cos(a1) * R, Math.sin(a1) * R, 0, Math.cos(a2) * R, Math.sin(a2) * R, 0);
    }
    // crosshair ticks
    const c = 0.18;
    const o = 0.72;
    pts.push(-o, 0, 0, -o + c, 0, 0);
    pts.push(o - c, 0, 0, o, 0, 0);
    pts.push(0, -o, 0, 0, -o + c, 0);
    pts.push(0, o - c, 0, 0, o, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  useFrame((state) => {
    for (let i = 0; i < POOL; i++) {
      const g = groupRefs.current[i];
      const m = matRefs.current[i];
      if (!g || !m) continue;
      const a = store.anchors[i];
      if (!a) {
        g.visible = false;
        continue;
      }
      const age = state.clock.elapsedTime - a.born;
      const life =
        Math.min(1, age / 0.5) * (1 - Math.min(1, Math.max(0, (age - 3.5) / 2)));
      if (life <= 0.005) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      g.position.set(a.x, a.y, a.z);
      g.quaternion.copy(state.camera.quaternion);
      const s = 0.65 + Math.min(1, age / 0.5) * 0.35;
      g.scale.setScalar(s);
      // marks belong to the sketch phase: nothing before the first scroll,
      // and they retire as the structure forms
      const appear = Math.min(1, Math.max(0, (store.progress - 0.004) / 0.045));
      const phaseFade = 1 - Math.min(1, Math.max(0, (store.progress - 0.35) / 0.1));
      m.opacity = 0.55 * life * appear * phaseFade;
    }
  });

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            if (el) groupRefs.current[i] = el;
          }}
        >
          <lineSegments geometry={markGeo}>
            <lineBasicMaterial
              ref={(el) => {
                if (el) matRefs.current[i] = el;
              }}
              color="#3c2a1e"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </lineSegments>
        </group>
      ))}
    </>
  );
}
