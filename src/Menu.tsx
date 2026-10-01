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
  /** 1-based question number Start will begin at. */
  startNumber: number;
  onStart: () => void;
  onResetUsed: () => void;
}

export function Menu({ settings, onChange, total, left, startNumber, onStart, onResetUsed }: Props) {
  const categoryLabel = CATEGORIES.find((c) => c.value === settings.category)?.label ?? settings.category;
  const usedCount = total - left;

  const resetUsed = () => {
    const message = `Mark all ${usedCount} used ${categoryLabel} questions as unused? They'll show up again in the next video. Other categories aren't affected.`;
    if (confirm(message)) onResetUsed();
  };

  const usedPercent = total ? (usedCount / total) * 100 : 0;

  return (
    <main className="menu">
      <header className="header">
        <img src="/images/companies/supabase.svg" alt="" />
        <h1>Image Quiz</h1>
      </header>

      <div className="card settings">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={settings.category}
            onChange={(e) => onChange({ ...settings, category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="effect">Effect</label>
          <select
            id="effect"
            value={settings.effect}
            onChange={(e) => onChange({ ...settings, effect: e.target.value as EffectSetting })}
          >
            {EFFECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="progress">
          <div className="progress-label">
            <span>Questions left</span>
            <span className="count"><strong>{left}</strong> of {total} not used yet</span>
          </div>
          <div className="progress-bar"><span style={{ width: `${usedPercent}%` }} /></div>
        </div>

        <button className="start" disabled={total === 0} onClick={onStart}>
          {left === 0 ? "Start over from question 1" : startNumber === 1 ? "Start" : `Continue from question ${startNumber}`}
        </button>
      </div>

      <p className="note">
        Questions play in the order listed in <code>src/images.ts</code>. Start picks up at the first question
        whose answer hasn't been shown yet, so each video gets fresh questions. After the last question it loops
        back to question 1 and the category starts over.
      </p>
      <button className="link" disabled={usedCount === 0} onClick={resetUsed}>
        Reset used questions in {categoryLabel}
      </button>

      <section className="card help">
        <h2>Controls</h2>
        <ul>
          <li><b>Tap</b> to go to the next level (4 levels, the last is the plain image)</li>
          <li><b>Tap on the plain image</b> to show the answer, then tap <b>Next →</b> for the next question</li>
          <li><b>Swipe right</b> for the previous question</li>
          <li><b>Swipe up</b> to reveal instantly, <b>swipe down</b> to come back here</li>
          <li>Keyboard: <kbd>Space</kbd> tap, <kbd>←</kbd> <kbd>→</kbd> previous / next, <kbd>Enter</kbd> reveal, <kbd>Esc</kbd> menu</li>
        </ul>
      </section>
    </main>
  );
}
