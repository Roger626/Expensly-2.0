// Genera la figura isométrica de "Cómo funciona" del landing.
// Uso: node scripts/anatomy/build-flow.mjs  → src/app/features/landing/flow-figure/flow-figure.svg.ts
// iso-kit.mjs es copia de la skill "anatomy" (kit/iso-kit.mjs).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../src/app/features/landing/flow-figure/flow-figure.svg.ts");

const WIDTH = 760;
const HEIGHT = 400;

// ── Mundo ─────────────────────────────────────────────────────
const PLATE = { x: -168, y: -66, w: 336, d: 124, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const RAIL_Y = [-17, 12];
const RAIL_FROM = -156;
const RAIL_TO = 156;
const STATIONS = [-112, -38, 36, 110]; // cámara · lector QR · sello · archivo
const POST_Y = -40;
const HEAD_Z = 46;

const CARRIAGE = { x: -26, y: -24, w: 52, d: 48, r: 3 };
const CAR_Z = 3;
const CAR_TOP = 8;
const RECEIPT = { x: -17, y: -19, w: 34, d: 38, r: 0.6 };
const RECEIPT_TOP = CAR_TOP + 1.2;
const STAMP_DROP = 24; // recorrido del sello hasta tocar la factura

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [STATIONS[0], POST_Y, 74], [STATIONS[3], POST_Y, 74], [STATIONS[2], 0, 80]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 38 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── Base ──────────────────────────────────────────────────────
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // regla frontal con marcas cada 4, mayor cada 5
  const strip = { x: -150, y: PLATE.y + PLATE.d - 15, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // marcas de estación sobre la regla
  out.push(D(STATIONS.map((x) => at([x, strip.y + 3.5, 0.6])), { size: 1.1, tone: "hi" }));

  // placa de identificación con la única etiqueta grabada
  const plate = { x: 118, y: PLATE.y + 8, w: 38, d: 14, r: 1.4 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 4, 0.3), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 4, plate.y + 6], 0.8, P, "x"), "EXPENSLY", { size: 3.4, tone: "hi" }));
  out.push(L([9.5, 11.5].map((y) => k.lineOnTop([plate.x + 4, plate.y + y], [plate.x + 30, plate.y + y], 0.8, P)).join(""), { tone: "lo", free: "both" }));
  out.push(D([at([plate.x + 2, plate.y + 2, 0.8]), at([plate.x + plate.w - 2, plate.y + plate.d - 2, 0.8])], { size: 0.4 }));
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([-120, -60, 0, 60, 120].map((x) => at([x, y + 2.5, 3])), { size: 0.4, tone: "lo" }));
  }
  for (const x of [RAIL_FROM - 6, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: RAIL_Y[0] - 4, w: 6, d: RAIL_Y[1] - RAIL_Y[0] + 13, r: 1.2 }, 0, 8, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 3, RAIL_Y[0] + 1, 8]), at([x + 3, RAIL_Y[1] + 4, 8])], { size: 0.45 }));
  }
  return out.join("");
}

// ── Columnas de estación (detrás del carro) ───────────────────
function post(x, top) {
  const out = [];
  const foot = { x: x - 9, y: POST_Y - 9, w: 18, d: 18, r: 2 };
  out.push(S(k.slabOf(foot, 0, 4, P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 3).map(([px, py]) => at([px, py, 4])), { size: 0.45 }));
  out.push(S(k.cylinder(x, POST_Y, 3.4, 4, top - 4, P, 28), { tone: "mid", crease: "none" }));
  out.push(L([20, 30].map((z) => k.sideArc(x, POST_Y, 3.4, z, P, 16)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, POST_Y, 4, top, 2, P, 28), { tone: "mid" }));
  return out.join("");
}

function cabinet(x) {
  // archivo: gabinete de dos gavetas al final del recorrido
  const out = [];
  const box = { x: x - 20, y: POST_Y - 18, w: 40, d: 26, r: 1.5 };
  out.push(S(k.slabOf(box, 0, 42, P, 4, 0.8), { tone: "mid" }));
  const fy = box.y + box.d;
  for (const [z0, z1] of [[4, 20], [23, 39]]) {
    out.push(S(k.slabOf({ x: box.x + 3, y: fy, w: box.w - 6, d: 1.2, r: 0.3 }, z0, z1 - z0, P, 2, 0.2), { tone: "hi", crease: "lo" }));
    const hz = (z0 + z1) / 2 + 3;
    out.push(S(k.slabOf({ x: x - 6, y: fy + 1.2, w: 12, d: 2.2, r: 0.8 }, hz - 1, 2, P, 3), { tone: "mid" }));
    // portaetiqueta
    out.push(L(k.pathOf([[x - 5, fy + 1.2, z0 + 4], [x + 5, fy + 1.2, z0 + 4], [x + 5, fy + 1.2, z0 + 7], [x - 5, fy + 1.2, z0 + 7]].map(at), true), { tone: "lo" }));
  }
  out.push(L(k.planOutline(k.insetPlan(box, 3), 42, P, 4), { tone: "faint" }));
  out.push(D(k.corners(box, 2.5).map(([px, py]) => at([px, py, 42])), { size: 0.45 }));
  // bandeja superior donde aterriza la factura exportada
  const tray = { x: x - 14, y: box.y + 4, w: 28, d: 18, r: 1 };
  out.push(S(k.slabOf(tray, 42, 1.4, P, 3, 0.3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: tray.x + 4, y: tray.y + 3, w: 20, d: 13, r: 0.4 }, 43.4, 0.8, P, 2), { tone: "hi", crease: "faint" }));
  out.push(S(k.slabOf({ x: tray.x + 5, y: tray.y + 2, w: 20, d: 13, r: 0.4 }, 44.2, 0.8, P, 2), { tone: "hi", crease: "faint" }));
  out.push(`<g data-led="3">${D([at([box.x + box.w - 4, fy, 39])], { size: 1.3, tone: "hi" })}</g>`);
  return out.join("");
}

// ── Carro con la factura (lo que se mueve) ─────────────────────
function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 3), CAR_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const y of RAIL_Y) {
    for (const x of [-18, 18]) out.push(S(k.slabOf({ x: x - 5, y: y - 1, w: 10, d: 7, r: 1 }, 2.4, 1.4, P, 2), { tone: "lo" }));
  }
  out.push(S(k.slabOf(CARRIAGE, CAR_Z, CAR_TOP - CAR_Z, P, 5, 0.6), { tone: "mid" }));
  out.push(D(k.corners(CARRIAGE, 3).map(([x, y]) => at([x, y, CAR_TOP])), { size: 0.4, tone: "lo" }));
  // la factura: el sujeto
  out.push(S(k.slabOf(RECEIPT, CAR_TOP, 1.2, P, 2, 0.2), { tone: "hi", lit: true }));
  const R = RECEIPT;
  const rule = (y, from, to) => k.lineOnTop([R.x + from, R.y + y], [R.x + to, R.y + y], RECEIPT_TOP, P);
  out.push(L([rule(4, 6, 28), rule(6.5, 10, 24)].join(""), { tone: "mid", free: "both" }));
  out.push(L([10, 13, 16, 19].map((y) => rule(y, 3, 31)).join(""), { tone: "lo", free: "both" }));
  out.push(L(rule(23.5, 3, 31), { tone: "faint" }));
  out.push(L(rule(26, 18, 31), { tone: "mid", free: "both" }));
  // QR en la esquina inferior
  out.push(L(k.planOutline({ x: R.x + 3, y: R.y + 27, w: 9, d: 9, r: 0 }, RECEIPT_TOP, P, 1), { tone: "mid" }));
  out.push(D(k.dotGrid(R.x + 4.5, R.y + 28.5, 4, 4, 2, RECEIPT_TOP, P), { size: 0.55, tone: "hi" }));
  // tirador frontal
  const hx = CARRIAGE.x + CARRIAGE.w - 9;
  out.push(S(k.slabOf({ x: hx - 2, y: CARRIAGE.y + CARRIAGE.d - 1, w: 4, d: 4, r: 1 }, CAR_Z + 1, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(hx, CARRIAGE.y + CARRIAGE.d + 4, 3, CAR_Z, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(hx, CARRIAGE.y + CARRIAGE.d + 4, 3, CAR_Z, CAR_Z + 5, 18, P), { tone: "lo" }));
  // marca verde de "aprobada" (se enciende tras el sello)
  out.push(`<g data-approved style="opacity:0">${L(k.planOutline({ x: R.x + 17, y: R.y + 28, w: 12, d: 7, r: 1 }, RECEIPT_TOP + 0.05, P, 3), { tone: "ok" })}</g>`);
  return out.join("");
}

// ── Brazos y cabezales (sobre el carro) ───────────────────────
function arm(x, z, toY) {
  const out = [];
  const plan = { x: x - 4, y: POST_Y + 2, w: 8, d: toY - POST_Y - 2, r: 1.6 };
  out.push(S(k.slabOf({ x: x - 7, y: POST_Y - 7, w: 14, d: 14, r: 2.5 }, z - 3, 10, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(plan, z, 4, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([x, plan.y + 5, z + 4]), at([x, plan.y + plan.d - 4, z + 4])], { size: 0.45 }));
  // perilla de ajuste
  out.push(S(k.slabOf({ x: x + 7, y: POST_Y - 1.4, w: 3, d: 2.8, r: 0.8 }, z, 4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x + 12, POST_Y, 2.8, z - 1, 6, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(x + 12, POST_Y, 2.8, z - 1, z + 5, 18, P), { tone: "lo" }));
  return out.join("");
}

function beam(x, index, half = 9) {
  // haz de lectura: aristas de una pirámide del cabezal a la factura
  const top = HEAD_Z - 0.5;
  const d = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([sx, sy]) => k.segment([x + sx * 4, sy * 4, top], [x + sx * half, sy * (half + 4), RECEIPT_TOP + 0.4], P))
    .join("");
  const footprint = k.planOutline({ x: x - half, y: -half - 4, w: half * 2, d: half * 2 + 8, r: 0 }, RECEIPT_TOP + 0.3, P, 1);
  return `<g data-beam="${index}" style="opacity:0">${L(d, { tone: "lit", dotted: true })}${L(footprint, { tone: "lit" })}</g>`;
}

function camera(x) {
  const out = [arm(x, HEAD_Z + 14, -6)];
  const body = { x: x - 10, y: -12, w: 20, d: 14, r: 2 };
  out.push(S(k.slabOf(body, HEAD_Z, 12, P, 5, 0.8), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x + 3, -5, 4.2, HEAD_Z + 12, 3, P, 32), { tone: "mid" }));
  out.push(L(k.ring(x + 3, -5, 2.6, HEAD_Z + 15, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf({ x: x - 8, y: -10, w: 5, d: 3, r: 0.5 }, HEAD_Z + 12, 1.2, P, 2), { tone: "mid" }));
  out.push(L(k.lineOnTop([body.x, body.y + 4], [body.x + body.w, body.y + 4], HEAD_Z + 12, P), { tone: "faint" }));
  out.push(`<g data-led="0">${D([at([x - 6, body.y + body.d, HEAD_Z + 8])], { size: 1.2, tone: "hi" })}</g>`);
  return out.join("");
}

function reader(x) {
  const out = [arm(x, HEAD_Z + 14, -6)];
  const body = { x: x - 11, y: -12, w: 22, d: 16, r: 2.5 };
  out.push(S(k.slabOf(body, HEAD_Z, 10, P, 5, 0.8), { tone: "hi", crease: "lo" }));
  // ventana con marco y rejilla de ventilación
  out.push(L(k.planOutline(k.insetPlan(body, 3), HEAD_Z + 10, P, 4), { tone: "lo" }));
  out.push(L([-6, -3, 0, 3, 6].map((dx) => k.lineOnTop([x + dx, body.y + 5], [x + dx, body.y + 11], HEAD_Z + 10, P)).join(""), { tone: "faint" }));
  out.push(D(k.corners(body, 2).map(([px, py]) => at([px, py, HEAD_Z + 10])), { size: 0.4 }));
  // antena hacia la DGI
  out.push(S(k.cylinder(x + 7, body.y + 4, 0.9, HEAD_Z + 10, 14, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x + 7, body.y + 4, 1.8, HEAD_Z + 24, 1.6, P, 16), { tone: "mid" }));
  out.push(`<g data-led="1">${D([at([x + 7, body.y + 4, HEAD_Z + 25.6])], { size: 1.3, tone: "hi" })}</g>`);
  return out.join("");
}

function stampHead(x) {
  // sello: guía fija y cabezal que baja (grupo móvil)
  const out = [arm(x, HEAD_Z + 26, 8)];
  out.push(S(k.cylinder(x, 4, 4.6, HEAD_Z + 18, 8, P, 28), { tone: "mid" }));
  out.push(L(k.sideArc(x, 4, 4.6, HEAD_Z + 22, P, 18), { tone: "faint" }));
  return out.join("");
}

function stampMoving(x) {
  const z0 = RECEIPT_TOP + STAMP_DROP; // posición de reposo de la cara del sello
  const out = [];
  out.push(S(k.slabOf({ x: x - 9, y: -5, w: 18, d: 18, r: 2 }, z0, 1.6, P, 4, 0.3), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: x - 8, y: -4, w: 16, d: 16, r: 2 }, z0 + 1.6, 8, P, 4, 0.6), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, 4, 2, z0 + 9.6, HEAD_Z + 18 - z0 - 9.6, P, 16), { tone: "mid", crease: "none" }));
  out.push(D(k.corners({ x: x - 8, y: -4, w: 16, d: 16 }, 2.4).map(([px, py]) => at([px, py, z0 + 9.6])), { size: 0.4 }));
  return out.join("");
}

// ── Composición ───────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  className: "flow-svg",
  label:
    "Una banda de inspección: la factura viaja en un carro sobre rieles por cuatro estaciones. Una cámara la fotografía, un lector toma el código QR y consulta la DGI, un sello la aprueba y al final queda archivada para exportar.",
  body: [
    base(),
    rails(),
    STATIONS.slice(0, 3).map((x) => post(x, x === STATIONS[2] ? HEAD_Z + 26 : HEAD_Z + 14)).join(""),
    cabinet(STATIONS[3]),
    `<g data-part="carriage" transform="${k.translateAlong(P, [STATIONS[0], 0, 0])}">${carriage()}</g>`,
    beam(STATIONS[0], 0),
    beam(STATIONS[1], 1, 10),
    camera(STATIONS[0]),
    reader(STATIONS[1]),
    stampHead(STATIONS[2]),
    `<g data-part="stamp">${stampMoving(STATIONS[2])}</g>`,
  ],
});

const geo = {
  stations: STATIONS,
  unitX: k.axisVector(P, [1, 0, 0]),
  unitZ: k.axisVector(P, [0, 0, 1]),
  stampDrop: STAMP_DROP,
};

writeFileSync(
  OUT,
  `// Generado por scripts/anatomy/build-flow.mjs. No editar a mano.\n` +
    `export const FLOW_GEO = ${JSON.stringify(geo)} as const;\n` +
    `export const FLOW_SVG = ${JSON.stringify(svg)};\n`,
);
console.log("wrote", OUT, (svg.length / 1024).toFixed(1) + " KB");
