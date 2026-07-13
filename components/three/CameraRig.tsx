"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { store, seg } from "@/lib/store";

// One continuous dolly: blank canvas → over the plan → around the structure →
// through the glazed opening → resting inside the living room.
const KEYS: Array<{ t: number; pos: [number, number, number]; tgt: [number, number, number] }> = [
  { t: 0.0, pos: [0, 3.4, 21], tgt: [0, 2.6, 0] },
  { t: 0.13, pos: [1.5, 13.5, 14.5], tgt: [0, 0, 0.4] },
  { t: 0.3, pos: [11.5, 11.5, 12], tgt: [0, 0.9, 0] },
  { t: 0.46, pos: [13, 4.8, 13], tgt: [0, 1.5, 0] },
  { t: 0.62, pos: [7.2, 2.7, 11.5], tgt: [0, 1.5, 0] },
  // x ≈ 0.8 keeps the dolly centered in a glass bay, clear of the mullions
  { t: 0.74, pos: [0.85, 1.95, 8.6], tgt: [-0.6, 1.45, 0] },
  { t: 0.86, pos: [0.85, 1.66, 2.9], tgt: [-2.0, 1.12, -0.8] },
  { t: 1.0, pos: [0.35, 1.5, 1.45], tgt: [-3.1, 0.95, -1.35] },
];

export function CameraRig() {
  const { posCurve, tgtCurve, times } = useMemo(() => {
    const posCurve = new THREE.CatmullRomCurve3(
      KEYS.map((k) => new THREE.Vector3(...k.pos)),
      false,
      "centripetal",
      0.35
    );
    const tgtCurve = new THREE.CatmullRomCurve3(
      KEYS.map((k) => new THREE.Vector3(...k.tgt)),
      false,
      "centripetal",
      0.35
    );
    return { posCurve, tgtCurve, times: KEYS.map((k) => k.t) };
  }, []);

  const v = useRef({
    pos: new THREE.Vector3(),
    tgt: new THREE.Vector3(),
    right: new THREE.Vector3(),
  }).current;

  useFrame((state) => {
    const p = store.progress;

    // map global progress onto uniform curve parameter through the key times
    let i = 0;
    while (i < times.length - 2 && p > times[i + 1]) i++;
    const local = seg(p, times[i], times[i + 1]);
    const u = (i + local) / (times.length - 1);

    posCurve.getPoint(u, v.pos);
    tgtCurve.getPoint(u, v.tgt);

    // portrait screens: preserve the authored horizontal framing by widening
    // the lens (capped) and dollying back while we're outside the building
    const cam = state.camera as THREE.PerspectiveCamera;
    const AUTHORED_ASPECT = 1.25;
    const BASE_FOV = 42;
    let fov = BASE_FOV;
    let dolly = 1;
    if (cam.aspect < AUTHORED_ASPECT) {
      const halfW = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * AUTHORED_ASPECT;
      const ideal = 2 * Math.atan(halfW / cam.aspect);
      fov = Math.min(70, THREE.MathUtils.radToDeg(ideal));
      dolly = (halfW / cam.aspect) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    }
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (dolly > 1) {
      const outside = 1 - seg(p, 0.72, 0.84);
      const s = 1 + (dolly - 1) * outside;
      v.pos.sub(v.tgt).multiplyScalar(s).add(v.tgt);
    }

    // gentle breathing + pointer parallax, both retire as we move indoors
    const calm = 1 - seg(p, 0.6, 0.8);
    const t = state.clock.elapsedTime;
    v.pos.y += Math.sin(t * 0.5) * 0.05 * calm;
    if (store.hasPointer) {
      v.right.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
      v.pos.addScaledVector(v.right, store.ndc.x * 0.45 * calm);
      v.pos.y += store.ndc.y * 0.22 * calm;
      v.tgt.x += store.ndc.x * 0.3 * calm;
    }

    state.camera.position.copy(v.pos);
    state.camera.lookAt(v.tgt);
  }, -1);

  return null;
}
