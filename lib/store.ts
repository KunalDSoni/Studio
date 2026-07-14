// Shared mutable state between the DOM (scroll / pointer) and the WebGL scene.
// A plain module singleton keeps the render loop allocation-free — no React
// re-renders are ever triggered by scroll or pointer movement.

export interface Anchor {
  x: number;
  y: number;
  z: number;
  born: number; // seconds (three clock time)
}

export const store = {
  /** raw scroll progress from ScrollTrigger, 0..1 */
  target: 0,
  /** smoothed progress consumed by the scene, 0..1 */
  progress: 0,

  /** pointer in normalized device coords */
  ndc: { x: 0, y: 0 },
  /** pointer projected onto the sketch plane, world space */
  mouse: { x: 0, y: 2, z: 0 },
  /** 1 while the cursor rests — particles gather */
  idle: 0,
  /** last time (ms) the pointer moved */
  lastMove: 0,
  /** approximate pointer speed, px/frame, smoothed */
  speed: 0,
  hasPointer: false,

  /** ring buffer of recent pointer positions (world) — architectural strokes */
  trail: new Float32Array(16 * 3),
  trailCount: 0,
  trailHead: 0,

  /** blueprint anchors created on click */
  anchors: [] as Anchor[],
  /** set by pointerdown, consumed inside the canvas frame loop */
  pendingClick: false,

  /** time of day, 0 Morning .. 1 Evening; smoothed by the Scene loop */
  time: 0.75,
  /** raw slider value the Scene loop eases `time` toward */
  timeTarget: 0.75,
  /** blended master level for interior practicals (Scene writes, others read) */
  lightLevel: 0,
  /** blended sheer-curtain opacity (Scene writes, Interior reads) */
  sheerLevel: 0,
  /** blended bloom intensity (Scene writes, Effects reads) */
  bloomLevel: 0,
};

/** 0..1 ramp of the global progress between two marks */
export function seg(p: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
