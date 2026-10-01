import type { EffectSetting } from "./engine";
import type { Category } from "./images";
import type { Settings } from "./storage";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "companies", label: "Tech companies" },
  { value: "apps", label: "Apps" },
  { value: "people", label: "People in tech" },
  { value: "frameworks", label: "Frameworks & languages" },
];

const EFFECT_OPTIONS: { value: EffectSetting; label: string }[] = [
  { value: "zoom", label: "Zoom out" },
  { value: "pixelate", label: "Pixelated" },
  { value: "zoompixel", label: "Zoom + pixelated" },
  { value: "random", label: "Random each round" },
  { value: "none", label: "No effect (show right away)" },
];

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  total: number;
  left: number;
  hasUsed: boolean;
  onStart: () => void;
  onResetUsed: () => void;
}

export function Menu({ settings, onChange, total, left, hasUsed, onStart, onResetUsed }: Props) {
  const resetUsed = () => {
    if (confirm("Mark every question as unused? Questions from earlier videos will show up again.")) onResetUsed();
  };

  return (
    <main className="menu">
      <h1>Image Quiz</h1>

      <section>
        <h2>Category</h2>
        <select
          value={settings.category}
          onChange={(e) => onChange({ ...settings, category: e.target.value as Category })}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </section>

      <section>
        <h2>Effect</h2>
        <select
          value={settings.effect}
          onChange={(e) => onChange({ ...settings, effect: e.target.value as EffectSetting })}
        >
          {EFFECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </section>

      <button className="start" disabled={left === 0} onClick={onStart}>Start</button>
      <p className="count">{left} of {total} questions not used yet</p>
      <p className="note">
        Questions play in the order listed in <code>src/images.ts</code>. Once a question's answer is shown,
        it's skipped next time, so each video gets fresh questions.
      </p>
      <button className="link" disabled={!hasUsed} onClick={resetUsed}>Reset used questions</button>

      <ul className="help">
        <li><b>Tap</b>: next level (4 levels, the last is the plain image)</li>
        <li><b>Tap on the plain image</b>: show the answer, <b>tap again</b>: next question</li>
        <li><b>Swipe left</b>: next question, <b>swipe right</b>: previous</li>
        <li><b>Swipe up</b>: reveal instantly, <b>swipe down</b>: back to this menu</li>
        <li>Keyboard: Space (tap), ← →, Enter (reveal), Esc (menu)</li>
      </ul>
    </main>
  );
}
