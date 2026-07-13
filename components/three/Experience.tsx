"use client";

import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";

export default function Experience() {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 140, position: [0, 3.4, 21] }}
    >
      <Scene />
    </Canvas>
  );
}
