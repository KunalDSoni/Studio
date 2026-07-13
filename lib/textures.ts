import * as THREE from "three";

// Procedural material maps, painted once on canvases at runtime.
// Subtle imperfection is the point: grain, banding, veining, mottle.

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function finish(c: HTMLCanvasElement, rx = 1, ry = rx): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** wide-plank oak, planks running along v */
export function oakFloor(): THREE.CanvasTexture {
  const [c, g] = canvas(1024);
  const planks = 7;
  const pw = c.width / planks;
  for (let i = 0; i < planks; i++) {
    const tone = rnd(-14, 14);
    g.fillStyle = `rgb(${196 + tone}, ${164 + tone * 0.9}, ${124 + tone * 0.8})`;
    g.fillRect(i * pw, 0, pw, c.height);
    // grain streaks
    for (let s = 0; s < 42; s++) {
      const x = i * pw + rnd(4, pw - 4);
      g.strokeStyle = `rgba(${120 + rnd(0, 40)}, ${92 + rnd(0, 30)}, ${60 + rnd(0, 22)}, ${rnd(0.04, 0.12)})`;
      g.lineWidth = rnd(0.6, 2.2);
      g.beginPath();
      g.moveTo(x, -10);
      g.bezierCurveTo(x + rnd(-7, 7), c.height * 0.33, x + rnd(-7, 7), c.height * 0.66, x + rnd(-9, 9), c.height + 10);
      g.stroke();
    }
    // occasional knot
    if (Math.random() < 0.5) {
      const kx = i * pw + rnd(10, pw - 10);
      const ky = rnd(60, c.height - 60);
      const grad = g.createRadialGradient(kx, ky, 1, kx, ky, rnd(5, 10));
      grad.addColorStop(0, "rgba(96,70,46,0.55)");
      grad.addColorStop(1, "rgba(96,70,46,0)");
      g.fillStyle = grad;
      g.fillRect(kx - 12, ky - 12, 24, 24);
    }
    // plank seam
    g.fillStyle = "rgba(70,52,36,0.55)";
    g.fillRect(i * pw, 0, 1.6, c.height);
    // butt joints
    const joints = 2 + ((Math.random() * 2) | 0);
    for (let j = 0; j < joints; j++) {
      g.fillRect(i * pw, rnd(0, c.height), pw, 1.4);
    }
  }
  return finish(c, 2.2, 2.2);
}

/** dark european walnut */
export function walnut(): THREE.CanvasTexture {
  const [c, g] = canvas(512);
  g.fillStyle = "#5e4630";
  g.fillRect(0, 0, c.width, c.height);
  for (let s = 0; s < 70; s++) {
    const y = rnd(0, c.height);
    g.strokeStyle = `rgba(${30 + rnd(0, 30)}, ${20 + rnd(0, 22)}, ${12 + rnd(0, 14)}, ${rnd(0.05, 0.16)})`;
    g.lineWidth = rnd(0.8, 3.2);
    g.beginPath();
    g.moveTo(-10, y);
    g.bezierCurveTo(c.width * 0.33, y + rnd(-14, 14), c.width * 0.66, y + rnd(-14, 14), c.width + 10, y + rnd(-10, 10));
    g.stroke();
  }
  for (let s = 0; s < 24; s++) {
    const y = rnd(0, c.height);
    g.strokeStyle = `rgba(160,124,86,${rnd(0.04, 0.1)})`;
    g.lineWidth = rnd(0.5, 1.4);
    g.beginPath();
    g.moveTo(-10, y);
    g.bezierCurveTo(c.width * 0.4, y + rnd(-10, 10), c.width * 0.6, y + rnd(-10, 10), c.width + 10, y);
    g.stroke();
  }
  return finish(c, 1, 1);
}

/** banded roman travertine */
export function travertine(): THREE.CanvasTexture {
  const [c, g] = canvas(512);
  g.fillStyle = "#d9cdb8";
  g.fillRect(0, 0, c.width, c.height);
  for (let b = 0; b < 26; b++) {
    const y = rnd(0, c.height);
    const h = rnd(4, 22);
    g.fillStyle = `rgba(${168 + rnd(0, 30)}, ${150 + rnd(0, 26)}, ${122 + rnd(0, 22)}, ${rnd(0.08, 0.2)})`;
    g.fillRect(0, y, c.width, h);
  }
  // pits
  for (let p = 0; p < 900; p++) {
    g.fillStyle = `rgba(${120 + rnd(0, 40)}, ${104 + rnd(0, 34)}, ${82 + rnd(0, 26)}, ${rnd(0.06, 0.22)})`;
    const w = rnd(0.6, 3.4);
    g.fillRect(rnd(0, c.width), rnd(0, c.height), w, w * rnd(0.3, 0.8));
  }
  return finish(c, 1.4, 1.4);
}

/** calacatta-style marble */
export function marble(): THREE.CanvasTexture {
  const [c, g] = canvas(512);
  g.fillStyle = "#eae5db";
  g.fillRect(0, 0, c.width, c.height);
  for (let v = 0; v < 7; v++) {
    let x = rnd(0, c.width);
    let y = 0;
    g.strokeStyle = `rgba(${118 + rnd(0, 30)}, ${118 + rnd(0, 28)}, ${116 + rnd(0, 26)}, ${rnd(0.14, 0.3)})`;
    g.lineWidth = rnd(0.7, 2.4);
    (g as CanvasRenderingContext2D & { filter: string }).filter = "blur(1px)";
    g.beginPath();
    g.moveTo(x, y);
    while (y < c.height) {
      x += rnd(-26, 26);
      y += rnd(18, 46);
      g.lineTo(x, y);
    }
    g.stroke();
    (g as CanvasRenderingContext2D & { filter: string }).filter = "none";
  }
  return finish(c, 1, 1);
}

/** oat bouclé — fine loops of yarn */
export function boucle(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = "#d9cfba";
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 5200; i++) {
    const t = rnd(-14, 14);
    g.fillStyle = `rgba(${205 + t}, ${194 + t}, ${170 + t}, 0.5)`;
    g.beginPath();
    g.arc(rnd(0, c.width), rnd(0, c.height), rnd(0.5, 1.6), 0, 7);
    g.fill();
  }
  return finish(c, 3, 3);
}

/** hand-troweled plaster / limewash */
export function plaster(): THREE.CanvasTexture {
  const [c, g] = canvas(512);
  g.fillStyle = "#ece5d6";
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    const t = rnd(-7, 7);
    g.fillStyle = `rgba(${230 + t}, ${222 + t}, ${206 + t}, ${rnd(0.08, 0.2)})`;
    const w = rnd(24, 120);
    g.save();
    g.translate(rnd(0, c.width), rnd(0, c.height));
    g.rotate(rnd(0, Math.PI));
    g.fillRect(-w / 2, -w * 0.12, w, w * 0.24);
    g.restore();
  }
  return finish(c, 1.6, 1.6);
}

/** abstract artwork in the house palette */
export function artwork(seed = 0): THREE.CanvasTexture {
  const [c, g] = canvas(512, 384);
  g.fillStyle = seed ? "#e4dbc9" : "#e9e0cf";
  g.fillRect(0, 0, c.width, c.height);
  // large earth-tone field
  g.fillStyle = seed ? "#a96f4c" : "#b57a52";
  g.beginPath();
  g.arc(c.width * (seed ? 0.62 : 0.4), c.height * 0.52, c.height * 0.34, 0, 7);
  g.fill();
  // overlapping quiet shape
  g.fillStyle = "rgba(122,116,94,0.75)";
  g.beginPath();
  g.ellipse(c.width * (seed ? 0.34 : 0.66), c.height * 0.6, c.height * 0.3, c.height * 0.42, seed ? 0.4 : -0.3, 0, 7);
  g.fill();
  // charcoal line
  g.strokeStyle = "rgba(44,36,28,0.8)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(c.width * 0.14, c.height * (seed ? 0.3 : 0.76));
  g.bezierCurveTo(c.width * 0.4, c.height * 0.2, c.width * 0.6, c.height * 0.9, c.width * 0.9, c.height * (seed ? 0.7 : 0.34));
  g.stroke();
  // paper grain
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(60,50,40,${rnd(0.01, 0.04)})`;
    g.fillRect(rnd(0, c.width), rnd(0, c.height), 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
