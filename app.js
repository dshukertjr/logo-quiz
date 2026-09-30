// ---- Tunables -------------------------------------------------------------
// Every effect has 4 levels. Each tap moves one level closer to the real image;
// the last level is the plain image.
//   zoom:   how far zoomed in (1 = not zoomed)
//   blocks: pixel blocks across the image (0 = sharp, not pixelated)
const LEVELS = {
  zoom:      { zoom: [18, 7, 3, 1],    blocks: [0, 0, 0, 0] },
  pixelate:  { zoom: [1, 1, 1, 1],     blocks: [5, 10, 20, 0] },
  zoompixel: { zoom: [7, 3.5, 1.8, 1], blocks: [16, 28, 56, 0] },
};
const TRANSITION_MS = 400;  // ease between levels; set to 0 for an instant jump
const IMAGE_FILL = 0.8;     // fraction of the screen the fully revealed image fills
const EFFECTS = Object.keys(LEVELS);
const LAST_LEVEL = 3;

// ---- Settings -------------------------------------------------------------
const defaults = { categories: ['companies', 'people', 'frameworks'], effect: 'zoom', showAnswer: false };
const settings = { ...defaults, ...JSON.parse(localStorage.getItem('image-quiz-settings') || '{}') };
const saveSettings = () => localStorage.setItem('image-quiz-settings', JSON.stringify(settings));

// Images that have already been shown, so the next video never repeats a question.
const used = new Set(JSON.parse(localStorage.getItem('image-quiz-used') || '[]'));
const saveUsed = () => localStorage.setItem('image-quiz-used', JSON.stringify([...used]));

const menu = document.getElementById('menu');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const off = document.createElement('canvas');
const offCtx = off.getContext('2d');

const categoryInputs = [...document.querySelectorAll('input[name="category"]')];
const effectInput = document.getElementById('effect');
const showAnswerInput = document.getElementById('showAnswer');
const startButton = document.getElementById('start');
const countLabel = document.getElementById('count');
const resetButton = document.getElementById('resetUsed');

const selectedImages = () => IMAGES.filter((i) => settings.categories.includes(i.category));
const unusedImages = () => selectedImages().filter((i) => !used.has(i.src));

function syncMenu() {
  categoryInputs.forEach((i) => (i.checked = settings.categories.includes(i.value)));
  effectInput.value = settings.effect;
  showAnswerInput.checked = settings.showAnswer;
  const total = selectedImages().length;
  const left = unusedImages().length;
  countLabel.textContent = `${left} of ${total} questions not used yet`;
  startButton.disabled = left === 0;
  resetButton.disabled = used.size === 0;
}

categoryInputs.forEach((i) => i.addEventListener('change', () => {
  settings.categories = categoryInputs.filter((c) => c.checked).map((c) => c.value);
  saveSettings(); syncMenu();
}));
effectInput.addEventListener('change', () => { settings.effect = effectInput.value; saveSettings(); });
showAnswerInput.addEventListener('change', () => { settings.showAnswer = showAnswerInput.checked; saveSettings(); });
startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', () => {
  if (!confirm('Mark every question as unused? Questions from earlier videos will show up again.')) return;
  used.clear(); saveUsed(); syncMenu();
});
syncMenu();

// ---- Game state -----------------------------------------------------------
// phase: 'loading' | 'playing' | 'answer'
// level: 0 (hardest) .. LAST_LEVEL (plain image). anim: in-flight transition between levels.
const state = { deck: [], index: 0, item: null, img: null, focus: { x: 0.5, y: 0.5 }, effect: 'zoom', phase: 'loading', level: 0, anim: null, dirty: true };
const imageCache = new Map();

// Stable per-image number, so an image always gets the same zoom spot / random effect.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function loadImage(src) {
  if (!imageCache.has(src)) {
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return imageCache.get(src);
}

async function startGame() {
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  requestWakeLock();
  state.deck = unusedImages(); // in images.js order
  state.index = 0;
  menu.hidden = true;
  canvas.hidden = false;
  resize();
  await showItem(0);
  if (!looping) { looping = true; requestAnimationFrame(loop); }
}

function exitGame() {
  state.phase = 'loading';
  canvas.hidden = true;
  menu.hidden = false;
  syncMenu();
  (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}

async function showItem(index) {
  if (index < 0 || index >= state.deck.length) return;
  state.index = index;
  state.phase = 'loading';
  const item = state.deck[index];
  try {
    const img = await loadImage(item.src);
    if (state.deck[state.index] !== item) return; // user skipped ahead while loading
    state.item = item;
    state.img = img;
    state.effect = settings.effect === 'random' ? EFFECTS[hash(item.src) % EFFECTS.length] : settings.effect;
    state.focus = item.focus || findFocus(img, !item.src.endsWith('.svg'), hash(item.src));
    state.level = 0;
    state.anim = null;
    state.phase = 'playing';
    state.dirty = true;
    used.add(item.src);
    saveUsed();
  } catch {
    console.warn('Failed to load', item.src);
    state.deck.splice(index, 1);
    if (index < state.deck.length) showItem(index);
    else exitGame();
    return;
  }
  // Preload the next one.
  const next = state.deck[index + 1];
  if (next) loadImage(next.src).catch(() => {});
}

function nextItem() {
  if (state.index + 1 < state.deck.length) showItem(state.index + 1);
  else exitGame(); // out of questions
}

// Pick an "interesting" point to zoom into: a spot with a lot of edge detail
// (logo edges, eyes/glasses on faces) instead of plain background.
function findFocus(img, isPhoto, seed) {
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, N, N);
  cx.drawImage(img, 0, 0, N, N);
  let data;
  try { data = cx.getImageData(0, 0, N, N).data; } catch { return { x: 0.5, y: 0.4 }; }

  const lum = (x, y) => { const i = (y * N + x) * 4; return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11; };
  // Photos: stay around where the face usually is. Logos: anywhere but the very edge.
  const [x0, x1, y0, y1] = isPhoto ? [0.3, 0.7, 0.2, 0.6] : [0.08, 0.92, 0.08, 0.92];
  const candidates = [];
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

// ---- Levels ---------------------------------------------------------------
// Fractional level, e.g. 1.4 while easing from level 1 to 2.
function levelPos(now) {
  if (!state.anim) return state.level;
  const t = Math.min(1, (now - state.anim.start) / TRANSITION_MS);
  if (t >= 1) { state.anim = null; return state.level; }
  const e = 1 - Math.pow(1 - t, 3);
  return state.anim.from + (state.level - state.anim.from) * e;
}

function setLevel(level) {
  const now = performance.now();
  const from = levelPos(now);
  state.level = level;
  state.anim = TRANSITION_MS > 0 ? { from, start: now } : null;
  state.dirty = true;
}

// Interpolate between level values in log space so zoom/pixel steps feel even.
function valueAt(values, pos) {
  const i = Math.min(values.length - 2, Math.floor(pos));
  const f = pos - i;
  return Math.exp(Math.log(values[i]) * (1 - f) + Math.log(values[i + 1]) * f);
}

// ---- Rendering ------------------------------------------------------------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  state.dirty = true;
}
window.addEventListener('resize', resize);

function render(now) {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const img = state.img;
  if (!img) return;

  const showingAnswer = state.phase === 'answer';
  const areaH = showingAnswer ? H * 0.85 : H;
  const fit = Math.min((W * IMAGE_FILL) / img.width, (areaH * IMAGE_FILL) / img.height);
  const iw = img.width * fit, ih = img.height * fit;

  const levels = LEVELS[state.effect];
  const pos = levelPos(now);
  const s = valueAt(levels.zoom, pos);
  const block = valueAt(levels.blocks.map((b) => (b ? iw / b : 1)), pos);

  // The camera drifts from the focus point back to the image center as it zooms out.
  const maxZoom = levels.zoom[0];
  const t = maxZoom > 1 ? (s - 1) / (maxZoom - 1) : 0;
  const cx = 0.5 + (state.focus.x - 0.5) * t;
  const cy = 0.5 + (state.focus.y - 0.5) * t;
  const dw = iw * s, dh = ih * s;
  const dx = W / 2 - cx * dw;
  const dy = areaH / 2 - cy * dh;

  if (block > 1.01) {
    const ow = Math.max(1, Math.round(W / block));
    const oh = Math.max(1, Math.round(H / block));
    if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
    const k = ow / W;
    offCtx.imageSmoothingEnabled = true;
    offCtx.fillStyle = '#fff';
    offCtx.fillRect(0, 0, ow, oh);
    offCtx.drawImage(img, dx * k, dy * k, dw * k, dh * k);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, ow, oh, 0, 0, W, H);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  if (showingAnswer) {
    const size = Math.round(Math.min(W, H) * 0.06);
    ctx.fillStyle = '#111';
    ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.item.answer, W / 2, areaH + (H - areaH) / 2 - size * 0.3);
  }
}

let looping = false;
function loop(ts) {
  if (canvas.hidden) { looping = false; return; }
  if (state.anim) state.dirty = true;
  if (state.dirty) { state.dirty = false; render(ts); }
  requestAnimationFrame(loop);
}

// ---- Controls -------------------------------------------------------------
function tap() {
  if (state.phase === 'playing') {
    if (state.level < LAST_LEVEL) setLevel(state.level + 1);
    else if (settings.showAnswer) { state.phase = 'answer'; state.dirty = true; }
    else nextItem();
  } else if (state.phase === 'answer') {
    nextItem();
  }
}

function reveal() {
  if (state.phase === 'playing' && state.level < LAST_LEVEL) setLevel(LAST_LEVEL);
}

let pointerStart = null;
canvas.addEventListener('pointerdown', (e) => { pointerStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x, dy = e.clientY - pointerStart.y;
  pointerStart = null;
  const SWIPE = 60;
  if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) nextItem(); else showItem(state.index - 1);
  } else if (Math.abs(dy) > SWIPE) {
    if (dy < 0) reveal(); else exitGame();
  } else {
    tap();
  }
});
canvas.addEventListener('pointercancel', () => { pointerStart = null; });
document.addEventListener('touchmove', (e) => { if (!canvas.hidden) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (canvas.hidden) return;
  if (e.key === ' ') { e.preventDefault(); tap(); }
  else if (e.key === 'ArrowRight') nextItem();
  else if (e.key === 'ArrowLeft') showItem(state.index - 1);
  else if (e.key === 'Enter') reveal();
  else if (e.key === 'Escape') exitGame();
});

// Keep the iPad screen from dimming mid-game.
let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !canvas.hidden) requestWakeLock();
});
