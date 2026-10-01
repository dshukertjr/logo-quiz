import type { QuizImage } from "./images";

// ---- Tunables -------------------------------------------------------------
// Every effect has 4 levels. Each tap moves one level closer to the real image;
// the last level is the plain image.
//   zoom:   how far zoomed in (1 = not zoomed)
//   blocks: pixel blocks across the image (0 = sharp, not pixelated)
export const LEVELS = {
  zoom:      { zoom: [18, 7, 3, 1],    blocks: [0, 0, 0, 0] },
  pixelate:  { zoom: [1, 1, 1, 1],     blocks: [5, 10, 20, 0] },
  zoompixel: { zoom: [7, 3.5, 1.8, 1], blocks: [16, 28, 56, 0] },
  none:      { zoom: [1, 1, 1, 1],     blocks: [0, 0, 0, 0] }, // plain image right away
};
const TRANSITION_MS = 400; // ease between levels; set to 0 for an instant jump
const IMAGE_FILL = 0.8;    // fraction of the screen the fully revealed image fills
const LAST_LEVEL = 3;

export type Effect = keyof typeof LEVELS;
export type EffectSetting = Effect | "random";
// Effects "Random each round" picks from (not "none").
const RANDOM_EFFECTS: Effect[] = ["zoom", "pixelate", "zoompixel"];

type Point = { x: number; y: number };

export interface EngineOptions {
  /** Every question in the category, in order. Play loops around it. */
  deck: QuizImage[];
  /** Index in `deck` to start at. */
  startIndex: number;
  effect: EffectSetting;
  /** Called when a new question starts loading (the answer is no longer on screen). */
  onQuestion: () => void;
  /** Called when an image's answer is shown, so it can be marked as used. */
  onAnswered: (src: string) => void;
  /** Called when play wraps from the last question back to the first. */
  onLoop: () => void;
  /** Called if none of the images could be loaded. */
  onFinished: () => void;
}

// Stable per-image number, so an image always gets the same zoom spot / random effect.
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

// Pick an "interesting" point to zoom into: a spot with a lot of edge detail
// (logo edges, eyes/glasses on faces) instead of plain background.
function findFocus(img: HTMLImageElement, isPhoto: boolean, seed: number): Point {
  const N = 64;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.fillStyle = "#fff";
  cx.fillRect(0, 0, N, N);
  cx.drawImage(img, 0, 0, N, N);
  let data: Uint8ClampedArray;
  try { data = cx.getImageData(0, 0, N, N).data; } catch { return { x: 0.5, y: 0.4 }; }

  const lum = (x: number, y: number) => { const i = (y * N + x) * 4; return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11; };
  // Photos: stay around where the face usually is. Logos: anywhere but the very edge.
  const [x0, x1, y0, y1] = isPhoto ? [0.3, 0.7, 0.2, 0.6] : [0.08, 0.92, 0.08, 0.92];
  const candidates: { x: number; y: number; g: number }[] = [];
  for (let y = Math.floor(y0 * N); y < Math.floor(y1 * N); y++) {
    for (let x = Math.floor(x0 * N); x < Math.floor(x1 * N); x++) {
      const g = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
      candidates.push({ x, y, g });
    }
  }
  candidates.sort((a, b) => b.g - a.g || a.y - b.y || a.x - b.x);
  const top = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.15)));
  const pick = top[seed % top.length];
  return { x: (pick.x + 0.5) / N, y: (pick.y + 0.5) / N };
}

// Interpolate between level values in log space so zoom/pixel steps feel even.
function valueAt(values: number[], pos: number) {
  const i = Math.min(values.length - 2, Math.floor(pos));
  const f = pos - i;
  return Math.exp(Math.log(values[i]) * (1 - f) + Math.log(values[i + 1]) * f);
}

/** Draws the quiz onto a canvas. Plain class so the render loop never touches React. */
export class QuizEngine {
  private ctx: CanvasRenderingContext2D;
  private off = document.createElement("canvas");
  private offCtx = this.off.getContext("2d")!;
  private deck: QuizImage[];
  private index = 0;
  private item: QuizImage | null = null;
  private img: HTMLImageElement | null = null;
  private focus: Point = { x: 0.5, y: 0.5 };
  private effect: Effect = "zoom";
  private phase: "loading" | "playing" | "answer" = "loading";
  private level = 0;
  private anim: { from: number; start: number } | null = null;
  private dirty = true;
  private raf = 0;
  private destroyed = false;

  constructor(private canvas: HTMLCanvasElement, private opts: EngineOptions) {
    this.ctx = canvas.getContext("2d")!;
    this.deck = [...opts.deck];
    this.resize();
    this.show(Math.min(Math.max(0, opts.startIndex), this.deck.length - 1));
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  resize = () => {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.dirty = true;
  };

  // ---- Controls -----------------------------------------------------------
  tap() {
    if (this.phase === "playing") {
      if (this.level < LAST_LEVEL) this.setLevel(this.level + 1);
      else {
        this.phase = "answer";
        this.dirty = true;
        if (this.item) this.opts.onAnswered(this.item.src);
      }
    }
    // On the answer, taps do nothing: only the Next button moves on.
  }

  reveal() {
    if (this.phase === "playing" && this.level < LAST_LEVEL) this.setLevel(LAST_LEVEL);
  }

  next() {
    if (this.index + 1 < this.deck.length) {
      this.show(this.index + 1);
    } else {
      this.opts.onLoop(); // past the last question: start the category over
      this.show(0);
    }
  }

  prev() {
    this.show((this.index - 1 + this.deck.length) % this.deck.length);
  }

  // ---- Internals ----------------------------------------------------------
  private async show(index: number) {
    if (index < 0 || index >= this.deck.length) return;
    this.index = index;
    this.phase = "loading";
    this.opts.onQuestion();
    const item = this.deck[index];
    try {
      const img = await loadImage(item.src);
      if (this.destroyed || this.deck[this.index] !== item) return; // skipped ahead while loading
      this.item = item;
      this.img = img;
      this.effect = this.opts.effect === "random" ? RANDOM_EFFECTS[hash(item.src) % RANDOM_EFFECTS.length] : this.opts.effect;
      this.focus = item.focus ?? findFocus(img, !item.src.endsWith(".svg"), hash(item.src));
      this.level = this.effect === "none" ? LAST_LEVEL : 0;
      this.anim = null;
      this.phase = "playing";
      this.dirty = true;
    } catch {
      if (this.destroyed) return;
      console.warn("Failed to load", item.src);
      this.deck.splice(index, 1);
      if (this.deck.length) this.show(index % this.deck.length);
      else this.opts.onFinished();
      return;
    }
    // Preload the next one.
    const next = this.deck[(index + 1) % this.deck.length];
    if (next) loadImage(next.src).catch(() => {});
  }

  // Fractional level, e.g. 1.4 while easing from level 1 to 2.
  private levelPos(now: number) {
    if (!this.anim) return this.level;
    const t = Math.min(1, (now - this.anim.start) / TRANSITION_MS);
    if (t >= 1) { this.anim = null; return this.level; }
    const e = 1 - Math.pow(1 - t, 3);
    return this.anim.from + (this.level - this.anim.from) * e;
  }

  private setLevel(level: number) {
    const now = performance.now();
    const from = this.levelPos(now);
    this.level = level;
    this.anim = TRANSITION_MS > 0 ? { from, start: now } : null;
    this.dirty = true;
  }

  private loop = (ts: number) => {
    if (this.destroyed) return;
    if (this.anim) this.dirty = true;
    if (this.dirty) { this.dirty = false; this.render(ts); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(now: number) {
    const { ctx, canvas, off, offCtx, img } = this;
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    if (!img) return;

    const showingAnswer = this.phase === "answer";
    const areaH = showingAnswer ? H * 0.85 : H;
    const fit = Math.min((W * IMAGE_FILL) / img.width, (areaH * IMAGE_FILL) / img.height);
    const iw = img.width * fit, ih = img.height * fit;

    const levels = LEVELS[this.effect];
    const pos = this.levelPos(now);
    const s = valueAt(levels.zoom, pos);
    const block = valueAt(levels.blocks.map((b) => (b ? iw / b : 1)), pos);

    // The camera drifts from the focus point back to the image center as it zooms out.
    const maxZoom = levels.zoom[0];
    const t = maxZoom > 1 ? (s - 1) / (maxZoom - 1) : 0;
    const cx = 0.5 + (this.focus.x - 0.5) * t;
    const cy = 0.5 + (this.focus.y - 0.5) * t;
    const dw = iw * s, dh = ih * s;
    const dx = W / 2 - cx * dw;
    const dy = areaH / 2 - cy * dh;

    if (block > 1.01) {
      const ow = Math.max(1, Math.round(W / block));
      const oh = Math.max(1, Math.round(H / block));
      if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
      const k = ow / W;
      offCtx.imageSmoothingEnabled = true;
      offCtx.fillStyle = "#fff";
      offCtx.fillRect(0, 0, ow, oh);
      offCtx.drawImage(img, dx * k, dy * k, dw * k, dh * k);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, ow, oh, 0, 0, W, H);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    // Question counter, top right, on a white pill so it reads over zoomed-in images.
    const counter = `${this.index + 1}/${this.deck.length}`;
    const counterSize = Math.round(Math.min(W, H) * 0.03);
    ctx.font = `600 ${counterSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const pillW = ctx.measureText(counter).width + counterSize * 1.2;
    const pillH = counterSize * 1.7;
    const margin = counterSize;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#dfdfdf"; // Supabase light border
    ctx.lineWidth = Math.max(1, counterSize / 14);
    ctx.beginPath();
    ctx.roundRect(W - margin - pillW, margin, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#707070";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(counter, W - margin - pillW / 2, margin + pillH / 2);

    if (showingAnswer && this.item) {
      const size = Math.round(Math.min(W, H) * 0.06);
      ctx.fillStyle = "#171717";
      ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.item.answer, W / 2, areaH + (H - areaH) / 2 - size * 0.3);
    }
  }
}
