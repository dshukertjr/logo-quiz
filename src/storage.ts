import type { EffectSetting } from "./engine";
import type { Category } from "./images";

export interface Settings {
  categories: Category[];
  effect: EffectSetting;
  showAnswer: boolean;
}

const SETTINGS_KEY = "image-quiz-settings";
const USED_KEY = "image-quiz-used";

const defaults: Settings = { categories: ["companies", "people", "frameworks"], effect: "zoom", showAnswer: false };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadSettings = (): Settings => ({ ...defaults, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (s: Settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

// Images that have already been shown, so the next video never repeats a question.
export const loadUsed = () => new Set(read<string[]>(USED_KEY, []));
export const saveUsed = (used: Set<string>) => localStorage.setItem(USED_KEY, JSON.stringify([...used]));
