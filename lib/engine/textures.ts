import * as THREE from "three";
import { THEME, type ChipStyle } from "@/lib/theme";

// Все текстуры рисуются кодом на canvas при загрузке. Файлов изображений нет.
// Для каждой детали делаем пару: цвет и карта «шероховатость (G) / металл (B)».
// Цвета и надписи берутся из lib/theme.ts.

const GOLD = THEME.gold;
const SERIF = THEME.serif;

type Mode = "color" | "orm";

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Цвет для карты ORM: G = шероховатость, B = металличность. */
function orm(rough: number, metal: number) {
  return `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
}

/** Возвращает цвет в зависимости от того, какую карту сейчас рисуем. */
function ink(mode: Mode, color: string, rough: number, metal = 0) {
  return mode === "color" ? color : orm(rough, metal);
}

export type TexturePair = { map: THREE.CanvasTexture; orm: THREE.CanvasTexture };

function pair(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, mode: Mode) => void): TexturePair {
  const a = makeCanvas(w, h);
  const b = makeCanvas(w, h);
  draw(a.getContext("2d")!, "color");
  draw(b.getContext("2d")!, "orm");
  return { map: toTexture(a, true), orm: toTexture(b, false) };
}

/* ───────────────────────────── Фишки ───────────────────────────── */

export type { ChipStyle };

export const CHIP_STYLES: ChipStyle[] = THEME.chips;

/** Шрифт для знака: системный из темы или тот, что подключён на сайте для названия. */
function markFont(kind: "serif" | "brand") {
  if (kind === "serif") return `400 {size}px ${SERIF}`;
  const css = getComputedStyle(document.documentElement);
  const family = (css.getPropertyValue("--font-brand") || css.getPropertyValue("--font-display")).trim();
  return `900 {size}px ${family || "Arial Black"}, "Arial Black", Arial, sans-serif`;
}

/** Текст по центру точки: размер size, но не шире maxW. font — шаблон с {size}. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number, font: string) {
  ctx.font = font.replace("{size}", String(size));
  const w = ctx.measureText(text).width;
  const s = w > maxW ? (size * maxW) / w : size;
  ctx.font = font.replace("{size}", String(s));
  ctx.fillText(text, x, y);
  return s;
}

/** Надпись по кругу: название повторяется, пока не заполнит окружность. */
function ringText() {
  const unit = `${THEME.brand} · `;
  let text = unit;
  while (text.length + unit.length <= 34) text += unit;
  return text;
}

export function chipTextures(style: ChipStyle): TexturePair {
  const S = 512;
  return pair(S, S, (ctx, mode) => {
    const c = S / 2;
    const R = S * 0.49; // край фишки (совпадает с планарной развёрткой)
    const foilIsMetal = !style.foil;
    const foil = style.foil ?? GOLD;
    const insertIsMetal = style.insert === GOLD;

    ctx.fillStyle = ink(mode, style.base, 0.62);
    ctx.fillRect(0, 0, S, S);

    // Шесть вставок по краю. Тянутся за пределы круга, поэтому ребро фишки
    // получает такие же полосы автоматически.
    ctx.fillStyle = ink(mode, style.insert, insertIsMetal ? 0.3 : 0.6, insertIsMetal ? 1 : 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const w = 0.2;
      ctx.beginPath();
      ctx.arc(c, c, R * 1.5, a - w, a + w);
      ctx.arc(c, c, R * 0.76, a + w, a - w, true);
      ctx.closePath();
      ctx.fill();
    }

    // Мелкие метки между вставками
    ctx.fillStyle = ink(mode, style.insert, 0.48, insertIsMetal ? 1 : 0);
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * R * 0.87, c + Math.sin(a) * R * 0.87, R * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    // Кольцо фольги
    ctx.strokeStyle = ink(mode, foil, 0.22, foilIsMetal ? 1 : 0);
    ctx.lineWidth = R * 0.022;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // Центральная вклейка
    ctx.fillStyle = ink(mode, style.inlay, 0.42);
    ctx.beginPath();
    ctx.arc(c, c, R * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = R * 0.016;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Знак клуба в центре, номинал под ним
    ctx.fillStyle = ink(mode, foil, 0.22, foilIsMetal ? 1 : 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, THEME.chipMark.text, c, c - R * 0.06, R * 0.3, R * 0.56, markFont(THEME.chipMark.font));
    ctx.font = `700 ${R * 0.13}px ${SERIF}`;
    ctx.fillText(style.value, c, c + R * 0.25);

    // Название клуба по кругу
    const text = ringText();
    ctx.font = `700 ${R * 0.085}px Arial, Helvetica, sans-serif`;
    const rr = R * 0.435;
    for (let i = 0; i < text.length; i++) {
      const a = (i / text.length) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
  });
}

/* ───────────────────────────── Масти ───────────────────────────── */

function heartPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, 0.6);
  ctx.bezierCurveTo(-0.25, 0.35, -0.6, 0.12, -0.6, -0.18);
  ctx.bezierCurveTo(-0.6, -0.58, -0.1, -0.6, 0, -0.25);
  ctx.bezierCurveTo(0.1, -0.6, 0.6, -0.58, 0.6, -0.18);
  ctx.bezierCurveTo(0.6, 0.12, 0.25, 0.35, 0, 0.6);
  ctx.closePath();
}

function spadePath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -0.62);
  ctx.bezierCurveTo(0.25, -0.35, 0.6, -0.1, 0.6, 0.18);
  ctx.bezierCurveTo(0.6, 0.52, 0.2, 0.56, 0.06, 0.3);
  ctx.lineTo(0.2, 0.62);
  ctx.lineTo(-0.2, 0.62);
  ctx.lineTo(-0.06, 0.3);
  ctx.bezierCurveTo(-0.2, 0.56, -0.6, 0.52, -0.6, 0.18);
  ctx.bezierCurveTo(-0.6, -0.1, -0.25, -0.35, 0, -0.62);
  ctx.closePath();
}

function suit(ctx: CanvasRenderingContext2D, kind: "spade" | "heart", x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (kind === "spade") spadePath(ctx);
  else heartPath(ctx);
  ctx.fill();
  ctx.restore();
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(-0.5, 0.26);
  ctx.lineTo(-0.56, -0.2);
  ctx.lineTo(-0.27, 0.02);
  ctx.lineTo(0, -0.38);
  ctx.lineTo(0.27, 0.02);
  ctx.lineTo(0.56, -0.2);
  ctx.lineTo(0.5, 0.26);
  ctx.closePath();
  ctx.fill();
  for (const [px, py] of [
    [-0.56, -0.26],
    [0, -0.44],
    [0.56, -0.26],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(-0.5, 0.32, 1, 0.09);
  ctx.restore();
}

/* ───────────────────────────── Карты ───────────────────────────── */

export const CARD_PX = 10; // пикселей на миллиметр

export function kingTextures(kind: "spade" | "heart"): TexturePair {
  const W = 63 * CARD_PX;
  const H = 88 * CARD_PX;
  const suitColor = kind === "spade" ? THEME.card.spade : THEME.card.heart;
  const foil = GOLD;

  return pair(W, H, (ctx, mode) => {
    ctx.fillStyle = ink(mode, THEME.card.face, 0.4);
    ctx.fillRect(0, 0, W, H);

    // Рамка двойной линией
    ctx.strokeStyle = ink(mode, foil, 0.2, 1);
    ctx.lineWidth = 3;
    const fx = 118;
    const fy = 92;
    ctx.strokeRect(fx, fy, W - fx * 2, H - fy * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx + 9, fy + 9, W - (fx + 9) * 2, H - (fy + 9) * 2);

    const half = () => {
      // Индекс в углу
      ctx.fillStyle = ink(mode, suitColor, 0.36);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 104px ${SERIF}`;
      ctx.fillText("K", 62, 128);
      suit(ctx, kind, 62, 180, 44);

      // Название клуба на поле над рамкой
      ctx.fillStyle = ink(mode, foil, 0.2, 1);
      ctx.textBaseline = "middle";
      spacedText(ctx, THEME.brand, W / 2, fy / 2 + 4, THEME.brand.length <= 6 ? 44 : 30, 0.22, 360);
      ctx.textBaseline = "alphabetic";

      // Корона и большая «K» внутри рамки
      ctx.fillStyle = ink(mode, foil, 0.2, 1);
      crown(ctx, W / 2, 178, 118);
      ctx.fillStyle = ink(mode, suitColor, 0.36);
      ctx.font = `700 196px ${SERIF}`;
      ctx.fillText("K", W / 2, 388);
    };

    half();
    ctx.save();
    ctx.translate(W, H);
    ctx.rotate(Math.PI);
    half();
    ctx.restore();

    // Центральная масть с тонкими линиями по бокам
    ctx.fillStyle = ink(mode, suitColor, 0.36);
    suit(ctx, kind, W / 2, H / 2, 46);
    ctx.fillStyle = ink(mode, foil, 0.2, 1);
    ctx.fillRect(fx + 30, H / 2 - 1.5, 120, 3);
    ctx.fillRect(W - fx - 150, H / 2 - 1.5, 120, 3);
  });
}

/** Текст с разрядкой, ужатый до maxW пикселей. */
function spacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  spacing: number,
  maxW: number,
) {
  ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  const gap = size * spacing;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + gap * (text.length - 1);
  const k = Math.min(1, maxW / total);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.textAlign = "left";
  let cx = -total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, 0);
    cx += widths[i] + gap;
  });
  ctx.restore();
  ctx.textAlign = "center";
}

/** Текст по дуге окружности радиуса r, по центру сверху (top) или снизу. */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, size: number, top: boolean) {
  ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + size * 0.28);
  const total = widths.reduce((s, w) => s + w, 0);
  let a = (top ? -Math.PI / 2 : Math.PI / 2) + ((top ? -1 : 1) * total) / r / 2;
  chars.forEach((ch, i) => {
    const step = widths[i] / r;
    a += top ? step / 2 : -step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += top ? step / 2 : -step / 2;
  });
}

export function cardBackTextures(): TexturePair {
  const W = 63 * CARD_PX;
  const H = 88 * CARD_PX;
  const back = THEME.card.back;
  return pair(W, H, (ctx, mode) => {
    ctx.fillStyle = ink(mode, THEME.card.face, 0.4);
    ctx.fillRect(0, 0, W, H);
    const m = 38;
    ctx.fillStyle = ink(mode, back, 0.38);
    ctx.fillRect(m, m, W - m * 2, H - m * 2);

    // Ромбовидная сетка
    ctx.save();
    ctx.beginPath();
    ctx.rect(m, m, W - m * 2, H - m * 2);
    ctx.clip();
    ctx.strokeStyle = ink(mode, GOLD, 0.22, 1);
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = mode === "color" ? 0.55 : 1;
    for (let i = -H; i < W + H; i += 34) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H * 0.6, H);
      ctx.moveTo(i, 0);
      ctx.lineTo(i - H * 0.6, H);
      ctx.stroke();
    }
    ctx.restore();

    // Медальон: монограмма или пика в центре, название по кругу
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = ink(mode, back, 0.38);
    ctx.beginPath();
    ctx.arc(cx, cy, 178, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink(mode, GOLD, 0.22, 1);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = ink(mode, GOLD, 0.22, 1);
    arcText(ctx, THEME.brand, cx, cy, 146, THEME.brand.length <= 6 ? 38 : 30, true);
    arcText(ctx, "♠ ♥ ♣ ♦", cx, cy, 146, 26, false);

    if (THEME.monogram) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `400 128px ${SERIF}`;
      ctx.fillText(THEME.monogram, cx, cy + 6);
    } else {
      suit(ctx, "spade", cx, cy, 82);
    }
  });
}

/* ───────────────────────── Треугольник ALL-IN ───────────────────────── */

/** side — сторона треугольника в мм. UV: u = x/side + 0.5, v = (y + h/3)/side. */
export function allInTextures(side: number): TexturePair {
  const S = 1024;
  const h = (side * Math.sqrt(3)) / 2;
  const px = (x: number) => (x / side + 0.5) * S;
  const py = (y: number) => S - ((y + h / 3) / side) * S;
  const k = S / side;

  const tri = (ctx: CanvasRenderingContext2D, inset: number) => {
    // Треугольник, сжатый к центру масс на inset миллиметров
    const s = (h / 3 - inset) / (h / 3);
    ctx.beginPath();
    ctx.moveTo(px(0), py(((2 * h) / 3) * s));
    ctx.lineTo(px((side / 2) * s), py((-h / 3) * s));
    ctx.lineTo(px((-side / 2) * s), py((-h / 3) * s));
    ctx.closePath();
  };

  return pair(S, S, (ctx, mode) => {
    ctx.fillStyle = ink(mode, THEME.allIn.lacquer, 0.16);
    ctx.fillRect(0, 0, S, S);

    ctx.lineJoin = "round";
    ctx.strokeStyle = ink(mode, GOLD, 0.2, 1);
    ctx.lineWidth = 1.1 * k;
    tri(ctx, 5.2);
    ctx.stroke();
    ctx.lineWidth = 0.35 * k;
    tri(ctx, 7.4);
    ctx.stroke();

    ctx.fillStyle = ink(mode, THEME.allIn.text, 0.3);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${15.5 * k}px "Arial Black", "Arial Bold", Impact, Arial, sans-serif`;
    ctx.fillText("ALL-IN", px(0), py(-h / 3 + 19));

    ctx.fillStyle = ink(mode, GOLD, 0.2, 1);
    suit(ctx, "spade", px(0), py(h * 0.22), 7 * k);
  });
}

/* ───────────────────────────── Сукно ───────────────────────────── */

/** w, h — габарит сукна в мм; a — половина прямого участка, r — радиус. */
export function feltTextures(
  w: number,
  h: number,
  a: number,
  r: number,
  line: number,
  box: { w: number; d: number; r: number },
  boxes: { x: number; z: number; along: boolean }[],
) {
  // Лёгкое затемнение к бортам и напечатанная линия ставок по форме стола.
  const k = 2048 / w;
  const W = 2048;
  const H = Math.round(h * k);
  const g = makeCanvas(W, H);
  const ctx = g.getContext("2d")!;
  ctx.fillStyle = "#4c4c4c";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(w / h, 1);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 0.56);
  grad.addColorStop(0, "#a2a2a2");
  grad.addColorStop(0.55, "#7c7c7c");
  grad.addColorStop(1, "#4c4c4c");
  ctx.fillStyle = grad;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();

  const stadium = (inset: number) => {
    const rr = (r - inset) * k;
    const aa = a * k;
    ctx.beginPath();
    ctx.moveTo(W / 2 - aa, H / 2 - rr);
    ctx.lineTo(W / 2 + aa, H / 2 - rr);
    ctx.arc(W / 2 + aa, H / 2, rr, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(W / 2 - aa, H / 2 + rr);
    ctx.arc(W / 2 - aa, H / 2, rr, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  };
  const L = THEME.felt.line;
  ctx.strokeStyle = `rgba(${L},0.5)`;
  ctx.lineWidth = 2.2 * k;
  stadium(line);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${L},0.26)`;
  ctx.lineWidth = 0.8 * k;
  stadium(line + 6);
  ctx.stroke();

  // Боксы игроков: скруглённые рамки между линией ставок и бортом
  for (const b of boxes) {
    const bw = (b.along ? box.w : box.d) * k;
    const bh = (b.along ? box.d : box.w) * k;
    const x = W / 2 + b.x * k - bw / 2;
    const y = H / 2 + b.z * k - bh / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, box.r * k);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fill();
    ctx.strokeStyle = `rgba(${L},0.85)`;
    ctx.lineWidth = 2 * k;
    ctx.stroke();
  }

  // Мелкий шум ткани для рельефа
  const N = 256;
  const n = makeCanvas(N, N);
  const nctx = n.getContext("2d")!;
  const img = nctx.createImageData(N, N);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N * N; i++) {
    const v = 110 + rnd() * 90;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);

  const fade = toTexture(g, true);
  const bump = toTexture(n, false);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(w / 40, h / 40);
  return { fade, bump };
}

/** Тёмный орех для дорожки: продольные волокна. */
export function woodTexture() {
  const W = 1024;
  const H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3b2113";
  ctx.fillRect(0, 0, W, H);
  let seed = 99;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 240; i++) {
    const y = rnd() * H;
    const dark = rnd() < 0.6;
    ctx.strokeStyle = dark ? `rgba(14,6,2,${0.12 + rnd() * 0.3})` : `rgba(140,84,44,${0.06 + rnd() * 0.16})`;
    ctx.lineWidth = 0.5 + rnd() * 2.4;
    ctx.beginPath();
    const amp = rnd() * 5;
    const ph = rnd() * 6.28;
    const waves = 1 + Math.floor(rnd() * 3); // целое число волн — без шва на стыке
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin((x / W) * Math.PI * 2 * waves + ph) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Логотип клуба для печати на сукне: золото на прозрачном фоне.
 * w, h — размер в мм; верх холста смотрит от камеры (к дальнему борту).
 */
export function tableLogoTexture(w: number, h: number) {
  const k = 2048 / w;
  const W = 2048;
  const H = Math.round(h * k);
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const L = THEME.tableLogo;
  const font = markFont(L.font);
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = GOLD;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let y = H * 0.12;
  if (L.monogram) {
    // знак в двойном круге, как на логотипе
    const r = H * 0.2;
    const cy = y + r;
    ctx.lineWidth = H * 0.008;
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = H * 0.004;
    ctx.beginPath();
    ctx.arc(W / 2, cy, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();
    fitText(ctx, L.monogram, W / 2, cy + r * 0.04, r * 1.05, r * 1.4, font);
    y = cy + r + H * 0.1;
  } else {
    y = H * 0.36;
  }

  // Название
  const titleSize = L.monogram ? H * 0.15 : H * 0.42;
  ctx.textBaseline = "middle";
  if (L.monogram) {
    // под монограммой название идёт разреженными капителями, как на логотипе
    spacedText(ctx, L.title, W / 2, y + titleSize * 0.5, titleSize, 0.22, W * 0.92);
  } else {
    fitText(ctx, L.title, W / 2, y + titleSize * 0.5, titleSize, W * 0.9, font);
  }
  y += titleSize + H * 0.07;

  // Подпись с чёрточками по бокам
  const subSize = H * 0.055;
  ctx.font = `700 ${subSize}px Arial, Helvetica, sans-serif`;
  const subW = Math.min(spacedWidth(ctx, L.sub, subSize * 0.3), W * 0.7);
  spacedText(ctx, L.sub, W / 2, y + subSize / 2, subSize, 0.3, W * 0.7);
  const dash = subSize * 3;
  const gap = subSize * 1.1;
  ctx.fillRect(W / 2 - subW / 2 - gap - dash, y + subSize / 2 - H * 0.003, dash, H * 0.006);
  ctx.fillRect(W / 2 + subW / 2 + gap, y + subSize / 2 - H * 0.003, dash, H * 0.006);

  return toTexture(c, true);
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, gap: number) {
  return [...text].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + gap * (text.length - 1);
}

/** Фон сцены: мягкий градиент из центра к краям. */
export function backgroundTexture() {
  const W = 512;
  const H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const [fx, fy] = THEME.bg.focus;
  const g = ctx.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, W * 1.05);
  g.addColorStop(0, THEME.bg.inner);
  g.addColorStop(1, THEME.bg.outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return toTexture(c, true);
}

/** Тёмная сетка для режима чертежа. */
export function gridTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#061426";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(140,190,255,0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * S;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(140,190,255,0.6)";
  ctx.strokeRect(0, 0, S, S);
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(11.4, 5.4); // клетка ~100 мм
  return t;
}
