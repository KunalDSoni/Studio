"use client";

import { useRef } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// The estate garden along the south camera corridor. Currently cleared —
// all planting and hardscape have been removed.
// ---------------------------------------------------------------------------

export function Landscape() {
  const groupRef = useRef<THREE.Group | null>(null);
  if (groupRef.current === null) {
    groupRef.current = new THREE.Group();
  }
  return <primitive object={groupRef.current} />;
}
