import { test } from "node:test";
import assert from "node:assert/strict";
import { envAt, createEnvState, STAGE_NAMES, SUN_RADIUS } from "../lib/environment.ts";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test("golden hour keyframe reproduces the story-end lighting exactly", () => {
  const s = envAt(0.75, createEnvState());
  close(s.sunIntensity, 2.5);
  // #ffd3a0 → 255/211/160
  close(s.sunColor[0], 1, 1e-3);
  close(s.sunColor[1], 211 / 255, 1e-3);
  close(s.sunColor[2], 160 / 255, 1e-3);
  close(s.hemiIntensity, 0.75);
  close(s.practicals, 1);
  close(s.sheerOpacity, 0.36);
  close(s.bloom, 0.38);
  // azimuth/elevation must resolve to the current sun position [7, 5.5, 15]
  const az = (s.sunAzimuth * Math.PI) / 180;
  const el = (s.sunElevation * Math.PI) / 180;
  close(SUN_RADIUS * Math.cos(el) * Math.sin(az), 7, 0.05);
  close(SUN_RADIUS * Math.sin(el), 5.5, 0.05);
  close(SUN_RADIUS * Math.cos(el) * Math.cos(az), 15, 0.05);
});

test("clamps t outside [0,1]", () => {
  const a = envAt(-5, createEnvState());
  const b = envAt(0, createEnvState());
  assert.deepEqual(a, b);
  const c = envAt(7, createEnvState());
  const d = envAt(1, createEnvState());
  assert.deepEqual(c, d);
});

test("midpoint between stops is the average of the two keyframes", () => {
  const a = envAt(0.75, createEnvState());
  const b = envAt(1.0, createEnvState());
  const mid = envAt(0.875, createEnvState());
  close(mid.sunIntensity, (a.sunIntensity + b.sunIntensity) / 2);
  close(mid.practicals, (a.practicals + b.practicals) / 2);
  close(mid.bg[0], (a.bg[0] + b.bg[0]) / 2);
});

test("envAt reuses the out object (no per-call allocation)", () => {
  const out = createEnvState();
  const ret = envAt(0.3, out);
  assert.equal(ret, out);
  const sunColorRef = out.sunColor;
  envAt(0.9, out);
  assert.equal(out.sunColor, sunColorRef, "inner arrays must be reused");
});

test("stage names cover the five stops", () => {
  assert.equal(STAGE_NAMES.length, 5);
});
