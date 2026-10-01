import type { EffectSetting } from "./engine";
import { IMAGES, type Category } from "./images";

export interface Settings {
  category: Category;
  effect: EffectSetting;
}

const SETTINGS_KEY = "image-quiz-settings";
const USED_KEY = "image-quiz-used";

const defaults: Settings = { category: "companies", effect: "zoom" };
const CATEGORIES = new Set(IMAGES.map((i) => i.category));

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings(): Settings {
  // Older versions stored a list of categories (keep the first one) and a showAnswer toggle (now always on).
  const { categories, showAnswer: _, ...saved } = read<Partial<Settings> & { categories?: Category[]; showAnswer?: boolean }>(SETTINGS_KEY, {});
  const settings = { ...defaults, ...saved };
  if (!saved.category && categories?.length) settings.category = categories[0];
  if (!CATEGORIES.has(settings.category)) settings.category = defaults.category;
  return settings;
}
export const saveSettings = (s: Settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

// Images whose answer has already been shown, so the next video never repeats a question.
export function loadUsed() {
  const known = new Set(IMAGES.map((i) => i.src));
  const byFile = new Map(IMAGES.map((i) => [i.src.split("/").pop(), i.src]));
  // If an image moved to another folder, carry its "used" mark over by file name.
  return new Set(read<string[]>(USED_KEY, []).map((src) => (known.has(src) ? src : byFile.get(src.split("/").pop()) ?? src)));
}
export const saveUsed = (used: Set<string>) => localStorage.setItem(USED_KEY, JSON.stringify([...used]));
