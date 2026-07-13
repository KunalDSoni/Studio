"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { store } from "@/lib/store";
import { sampleTargets } from "@/lib/house";

const COUNT =
  typeof window !== "undefined" && window.innerWidth < 768 ? 9000 : 22000;
const SIZE_SCALE =
  typeof window !== "undefined" && window.innerWidth < 768 ? 0.8 : 1;

// All particle motion is stateless and lives in the vertex shader:
// one draw call, zero per-frame CPU work on positions.
const VERT = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform vec3  uMouse;
uniform float uIdle;
uniform float uPointer;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform vec3  uTrail[16];
uniform float uTrailCount;
uniform vec4  uAnchors[6];
uniform float uAnchorCount;

attribute vec3 aTarget;
attribute vec4 aRand;

varying float vAlpha;
varying float vTone;

void main() {
  // scattered resting position (the "blank canvas" cloud)
  vec3 free = position;

  float t = uTime;
  vec3 drift = vec3(
    sin(t * 0.22 + aRand.x * 37.0 + free.y * 0.35),
    sin(t * 0.17 + aRand.y * 51.0 + free.x * 0.22) * 0.6,
    sin(t * 0.26 + aRand.z * 43.0 + free.x * 0.18)
  ) * 0.9;
  vec3 p = free + drift;

  // how far this particle has condensed onto the building wireframe
  float stag = aRand.w;
  float form = smoothstep(0.10 + stag * 0.16, 0.30 + stag * 0.16, uProgress);
  float freeW = 1.0 - form;

  // cursor: gentle following, strong gathering while the pointer rests
  if (uPointer > 0.5 && freeW > 0.01) {
    vec3 toM = uMouse - p;
    float d = length(toM);
    float pull = exp(-d * d / 20.0) * (0.38 + uIdle * 1.15);
    vec3 dir = toM / max(d, 0.001);
    vec3 tang = normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.001, 0.0));
    p += (dir * pull * d + tang * pull * 1.3 * (aRand.x - 0.5)) * freeW;
  }

  // strokes: recent pointer path attracts a thin seam of particles
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uTrailCount) break;
    vec3 toT = uTrail[i] - p;
    float d2 = dot(toT, toT);
    p += toT * exp(-d2 / 2.2) * 0.5 * freeW;
  }

  // click anchors: particles fall into small blueprint nodes
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uAnchorCount) break;
    vec4 a = uAnchors[i];
    float age = uTime - a.w;
    float life = smoothstep(0.0, 0.5, age) * (1.0 - smoothstep(3.5, 5.5, age));
    vec3 v = p - a.xyz;
    float d = max(length(v), 0.001);
    vec3 ring = a.xyz + (v / d) * 0.55;
    p = mix(p, ring, exp(-d * d / 7.0) * life * 0.9 * freeW);
  }

  // condensation onto the structure
  p = mix(p, aTarget + drift * 0.025, form);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.1 + aRand.z * 2.1) * uPixelRatio * uSizeScale * (17.0 / max(-mv.z, 0.5));

  // the canvas starts truly blank — particles only exist once scrolling begins
  float appear = smoothstep(0.004, 0.05, uProgress + stag * 0.012);

  // dissolve as real materials arrive; a whisper of dust lingers
  float dust = step(0.93, aRand.y);
  float fade = 1.0 - smoothstep(0.50, 0.62, uProgress);
  fade = max(fade, dust * (1.0 - smoothstep(0.68, 0.78, uProgress)));
  vAlpha = appear * fade * (0.3 + 0.7 * aRand.w);
  vTone = aRand.x;
}
`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying float vTone;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float disc = smoothstep(0.5, 0.3, length(uv));
  float a = disc * vAlpha;
  if (a < 0.012) discard;
  vec3 ink = mix(vec3(0.22, 0.155, 0.11), vec3(0.44, 0.35, 0.27), vTone);
  gl_FragColor = vec4(ink, a);
}
`;

export function Particles() {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const rand = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = Math.random() * 9.5 + 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      rand[i * 4] = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = Math.random();
      rand[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(sampleTargets(COUNT), 3));
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 2, 0) },
      uIdle: { value: 0 },
      uPointer: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: SIZE_SCALE },
      uTrail: { value: Array.from({ length: 16 }, () => new THREE.Vector3(0, -50, 0)) },
      uTrailCount: { value: 0 },
      uAnchors: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, -100)) },
      uAnchorCount: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const u = material.current!.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uProgress.value = store.progress;
    u.uIdle.value = store.idle;
    u.uPointer.value = store.hasPointer ? 1 : 0;
    u.uPixelRatio.value = state.gl.getPixelRatio();
    u.uMouse.value.set(store.mouse.x, store.mouse.y, store.mouse.z);

    u.uTrailCount.value = store.trailCount;
    const trail = u.uTrail.value as THREE.Vector3[];
    for (let i = 0; i < 16; i++) {
      trail[i].set(store.trail[i * 3], store.trail[i * 3 + 1], store.trail[i * 3 + 2]);
    }

    u.uAnchorCount.value = store.anchors.length;
    const anchors = u.uAnchors.value as THREE.Vector4[];
    for (let i = 0; i < store.anchors.length; i++) {
      const a = store.anchors[i];
      anchors[i].set(a.x, a.y, a.z, a.born);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
