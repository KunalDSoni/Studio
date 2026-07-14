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
// Note: the daytime sun azimuths deliberately hug the 10–30° corridor (the only glazed face is south/+Z) — stages differentiate via elevation, intensity and color temperature, not a full east-west arc. Don't "fix" the arc back; the sun must stay in front of the glazing to reach the interior camera frame.
const KEYS: EnvState[] = [
  { // Morning — low sun in the proven south-glazing corridor (long raking
    // shaft), COOL blue daylight in and cool hemisphere fill so the whole
    // frame reads distinctly cooler than the warm afternoon; practicals off.
    sunAzimuth: 16, sunElevation: 10,
    sunColor: hex(0xc4d8f2), sunIntensity: 2.6,
    hemiSky: hex(0xc6daf6), hemiGround: hex(0x9fa9bb), hemiIntensity: 1.4,
    bg: hex(0xd2ddee), practicals: 0, sheerOpacity: 0.28, bloom: 0.05,
  },
  { // Late Morning — sun climbing, whiter/brighter, neutral-cool fill,
    // shorter shaft than morning; a clear step brighter than morning.
    sunAzimuth: 20, sunElevation: 26,
    sunColor: hex(0xf2f4f4), sunIntensity: 3.1,
    hemiSky: hex(0xeaf0f2), hemiGround: hex(0xcbccc6), hemiIntensity: 1.55,
    bg: hex(0xebecea), practicals: 0, sheerOpacity: 0.3, bloom: 0.06,
  },
  { // Afternoon — high warm-neutral sun, BRIGHTEST frame of the day (beats
    // golden), shortest/steepest shaft; warm but not as saturated as golden.
    sunAzimuth: 28, sunElevation: 40,
    sunColor: hex(0xfff3dc), sunIntensity: 3.6,
    hemiSky: hex(0xf8f3ea), hemiGround: hex(0xe0d8c6), hemiIntensity: 1.85,
    bg: hex(0xf7f3ea), practicals: 0, sheerOpacity: 0.33, bloom: 0.09,
  },
  { // Golden Hour — FIXED: equals the story-end state
    sunAzimuth: 25, sunElevation: 18.4,
    sunColor: hex(0xffd3a0), sunIntensity: 2.5,
    hemiSky: hex(0xfff6e6), hemiGround: hex(0xd8c9b2), hemiIntensity: 0.75,
    bg: hex(0xf1ece1), practicals: 1, sheerOpacity: 0.36, bloom: 0.38,
  },
  { // Evening — blue hour: sun gone, cool indigo fill so unlit surfaces read
    // blue while the warm practicals make the interior glow against it.
    sunAzimuth: 12, sunElevation: 5,
    sunColor: hex(0x8290b8), sunIntensity: 0.25,
    hemiSky: hex(0x45579c), hemiGround: hex(0x2c3858), hemiIntensity: 1.05,
    bg: hex(0x232d4a), practicals: 0.95, sheerOpacity: 0.5, bloom: 0.5,
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
