// Pure time-of-day environment model. No three.js imports — this module is
// unit-tested under plain `node --test` and consumed by Scene/TimeSlider.

export type Rgb = [number, number, number];

export interface EnvState {
  sunAzimuth: number;   // degrees; 0 = +Z, positive toward +X
  sunElevation: number; // degrees above horizon
  sunColor: Rgb;
  sunIntensity: number;
  hemiSky: Rgb;
  hemiGround: Rgb;
  hemiIntensity: number;
  bg: Rgb;              // scene background + fog color
  practicals: number;   // 0..n master level for interior lights/emissives
  sheerOpacity: number;
  bloom: number;
}

/** distance of the sun light from origin — matches |[7, 5.5, 15]| */
export const SUN_RADIUS = 17.44;

export const STAGE_NAMES = [
  "Morning",
  "Late Morning",
  "Afternoon",
  "Golden Hour",
  "Evening",
] as const;

const hex = (h: number): Rgb => [
  ((h >> 16) & 255) / 255,
  ((h >> 8) & 255) / 255,
  (h & 255) / 255,
];

// Keyframes at t = 0, 0.25, 0.5, 0.75, 1. Golden Hour (index 3) is FIXED —
// it must equal the scroll story's final lighting so the handoff is invisible.
// (#ffd3a0 sun at the bearing of [7, 5.5, 15]: azimuth 25°, elevation 18.4°.)
const KEYS: EnvState[] = [
  { // Morning — low eastern sun, cool pale gold, long shadows
    sunAzimuth: 85, sunElevation: 13,
    sunColor: hex(0xffe9c4), sunIntensity: 1.7,
    hemiSky: hex(0xf2f6f0), hemiGround: hex(0xcfc4ae), hemiIntensity: 1.0,
    bg: hex(0xedefe6), practicals: 0, sheerOpacity: 0.3, bloom: 0.06,
  },
  { // Late Morning — climbing whiter sun, crisper shadows
    sunAzimuth: 60, sunElevation: 38,
    sunColor: hex(0xfff4dd), sunIntensity: 2.1,
    hemiSky: hex(0xf4f7f3), hemiGround: hex(0xd6cab2), hemiIntensity: 1.1,
    bg: hex(0xf2f1e8), practicals: 0, sheerOpacity: 0.3, bloom: 0.04,
  },
  { // Afternoon — high neutral-warm sun, shortest shadows
    sunAzimuth: 40, sunElevation: 55,
    sunColor: hex(0xfff9ea), sunIntensity: 2.3,
    hemiSky: hex(0xf7f5ec), hemiGround: hex(0xdccfb6), hemiIntensity: 1.15,
    bg: hex(0xf4efe2), practicals: 0, sheerOpacity: 0.32, bloom: 0.05,
  },
  { // Golden Hour — FIXED: equals the story-end state
    sunAzimuth: 25, sunElevation: 18.4,
    sunColor: hex(0xffd3a0), sunIntensity: 2.5,
    hemiSky: hex(0xfff6e6), hemiGround: hex(0xd8c9b2), hemiIntensity: 0.75,
    bg: hex(0xf1ece1), practicals: 1, sheerOpacity: 0.36, bloom: 0.38,
  },
  { // Evening — blue hour: sun gone, slate fill keeps shadow shape
    sunAzimuth: 10, sunElevation: 6,
    sunColor: hex(0x7d8bb0), sunIntensity: 0.22,
    hemiSky: hex(0x46506b), hemiGround: hex(0x3a3630), hemiIntensity: 0.5,
    bg: hex(0x2e3547), practicals: 1.3, sheerOpacity: 0.5, bloom: 0.55,
  },
];

export function createEnvState(): EnvState {
  return {
    sunAzimuth: 0, sunElevation: 0,
    sunColor: [0, 0, 0], sunIntensity: 0,
    hemiSky: [0, 0, 0], hemiGround: [0, 0, 0], hemiIntensity: 0,
    bg: [0, 0, 0], practicals: 0, sheerOpacity: 0, bloom: 0,
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function lerp3(a: Rgb, b: Rgb, k: number, out: Rgb): void {
  out[0] = lerp(a[0], b[0], k);
  out[1] = lerp(a[1], b[1], k);
  out[2] = lerp(a[2], b[2], k);
}

/** Interpolated environment at time t (0..1, clamped). Writes into `out`. */
export function envAt(t: number, out: EnvState): EnvState {
  const x = Math.min(1, Math.max(0, t)) * (KEYS.length - 1);
  const i = Math.min(KEYS.length - 2, Math.floor(x));
  const k = x - i;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  out.sunAzimuth = lerp(a.sunAzimuth, b.sunAzimuth, k);
  out.sunElevation = lerp(a.sunElevation, b.sunElevation, k);
  lerp3(a.sunColor, b.sunColor, k, out.sunColor);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, k);
  lerp3(a.hemiSky, b.hemiSky, k, out.hemiSky);
  lerp3(a.hemiGround, b.hemiGround, k, out.hemiGround);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, k);
  lerp3(a.bg, b.bg, k, out.bg);
  out.practicals = lerp(a.practicals, b.practicals, k);
  out.sheerOpacity = lerp(a.sheerOpacity, b.sheerOpacity, k);
  out.bloom = lerp(a.bloom, b.bloom, k);
  return out;
}
