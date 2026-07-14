"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import { store } from "@/lib/store";

export function Effects() {
  const bloom = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloom.current) {
      bloom.current.intensity = store.bloomLevel;
    }
  });

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        ref={bloom}
        intensity={0}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.72}
      />
      <Vignette darkness={0.26} offset={0.28} />
    </EffectComposer>
  );
}
