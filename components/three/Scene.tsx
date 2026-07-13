"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { store, seg } from "@/lib/store";
import { Particles } from "./Particles";
import { Blueprint } from "./Blueprint";
import { Building } from "./Building";
import { Interior } from "./Interior";
import { CameraRig } from "./CameraRig";
import { Anchors } from "./Anchors";
import { Effects } from "./Effects";

const PAPER = new THREE.Color("#f1ece1");

/**
 * Root of the 3D experience. A high-priority frame loop advances the shared
 * store (smoothed scroll progress, pointer world position, idle state, stroke
 * trail, click anchors) before any other component reads it.
 */
export function Scene() {
  const scene = useThree((s) => s.scene);

  useMemo(() => {
    scene.background = PAPER;
    scene.fog = new THREE.Fog(PAPER, 26, 70);
  }, [scene]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const vec = useMemo(
    () => ({
      ndc: new THREE.Vector2(),
      dir: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      anchorPoint: new THREE.Vector3(0, 2.2, 5),
    }),
    []
  );
  const lastTrail = useRef(0);

  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const ceiling = useRef<THREE.PointLight>(null);
  const pendant = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);

    // -- smoothed scroll progress -------------------------------------------
    store.progress += (store.target - store.progress) * Math.min(1, dt * 4.2);
    if (Math.abs(store.target - store.progress) < 0.00005) {
      store.progress = store.target;
    }
    const p = store.progress;

    // -- pointer: idle detection + projection to the sketch plane ------------
    const now = performance.now();
    const idleTarget = now - store.lastMove > 380 ? 1 : 0;
    store.idle += (idleTarget - store.idle) * Math.min(1, dt * 2.4);
    store.speed *= Math.pow(0.0025, dt); // decay between move events

    if (store.hasPointer) {
      vec.ndc.set(store.ndc.x, store.ndc.y);
      raycaster.setFromCamera(vec.ndc, state.camera);
      state.camera.getWorldDirection(vec.dir);
      plane.setFromNormalAndCoplanarPoint(vec.dir.negate(), vec.anchorPoint);
      if (raycaster.ray.intersectPlane(plane, vec.hit)) {
        store.mouse.x = vec.hit.x;
        store.mouse.y = vec.hit.y;
        store.mouse.z = vec.hit.z;
      }
    }

    // -- architectural stroke trail ------------------------------------------
    const moving = now - store.lastMove < 130 && store.speed > 1.5;
    if (moving && now - lastTrail.current > 55) {
      lastTrail.current = now;
      const i = store.trailHead % 16;
      store.trail[i * 3] = store.mouse.x;
      store.trail[i * 3 + 1] = store.mouse.y;
      store.trail[i * 3 + 2] = store.mouse.z;
      store.trailHead++;
      store.trailCount = Math.min(16, store.trailCount + 1);
    } else if (now - store.lastMove > 900 && store.trailCount > 0) {
      store.trailCount = Math.max(0, store.trailCount - 60 * dt * 0.2);
    }

    // -- click → blueprint anchor --------------------------------------------
    if (store.pendingClick) {
      store.pendingClick = false;
      if (p < 0.45) {
        store.anchors.push({
          x: store.mouse.x,
          y: store.mouse.y,
          z: store.mouse.z,
          born: state.clock.elapsedTime,
        });
        if (store.anchors.length > 6) store.anchors.shift();
      }
    }

    // -- lighting choreography ------------------------------------------------
    const lightP = seg(p, 0.64, 0.76);
    const interiorP = seg(p, 0.74, 0.9);
    if (sun.current) {
      // golden hour: the sun warms and strengthens as the lights come on
      sun.current.intensity = 0.6 + lightP * 1.9;
    }
    if (hemi.current) {
      hemi.current.intensity = 1.05 - interiorP * 0.3;
    }
    if (lamp.current) lamp.current.intensity = lightP * 3.4;
    if (ceiling.current) ceiling.current.intensity = lightP * 4.2;
    if (pendant.current) pendant.current.intensity = lightP * 1.6;
  }, -2);

  return (
    <>
      <hemisphereLight
        ref={hemi}
        args={["#fff6e6", "#d8c9b2", 1.05]}
        position={[0, 20, 0]}
      />
      <directionalLight
        ref={sun}
        position={[7, 5.5, 15]}
        color="#ffd3a0"
        intensity={0.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-far={50}
        shadow-bias={-0.0004}
      />
      <pointLight
        ref={lamp}
        position={[-4.22, 1.5, -2.68]}
        color="#ffcf96"
        intensity={0}
        distance={8}
        decay={1.8}
      />
      <pointLight
        ref={ceiling}
        position={[-1.2, 2.35, -0.4]}
        color="#ffe3ba"
        intensity={0}
        distance={12}
        decay={1.9}
      />
      <pointLight
        ref={pendant}
        position={[3.55, 1.7, -0.9]}
        color="#ffd9a4"
        intensity={0}
        distance={5.5}
        decay={1.8}
      />

      <CameraRig />
      <Particles />
      <Blueprint />
      <Building />
      <Interior />
      <Anchors />
      <Effects />
    </>
  );
}
