import { useCallback, useEffect, useState } from "react";
import { Game } from "./Game";
import { IMAGES, type QuizImage } from "./images";
import { Menu } from "./Menu";
import { loadSettings, loadUsed, saveSettings, saveUsed, type Settings } from "./storage";

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [used, setUsed] = useState(loadUsed);
  // The questions for the current session, fixed when Start is pressed. null = on the menu.
  const [deck, setDeck] = useState<QuizImage[] | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveUsed(used), [used]);

  const selected = IMAGES.filter((i) => i.category === settings.category);
  const unused = selected.filter((i) => !used.has(i.src));

  const start = () => {
    // Fullscreen has to be requested straight from the tap on Start.
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
    setDeck(unused); // in images.ts order
  };

  const exit = useCallback(() => {
    setDeck(null);
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  }, []);

  const markUsed = useCallback((src: string) => {
    setUsed((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);

  if (deck) {
    return <Game deck={deck} effect={settings.effect} onAnswered={markUsed} onExit={exit} />;
  }

  return (
    <Menu
      settings={settings}
      onChange={(s: Settings) => setSettings(s)}
      total={selected.length}
      left={unused.length}
      onStart={start}
      onResetUsed={() => {
        // Only the selected category; other categories keep their used questions.
        const inCategory = new Set(selected.map((i) => i.src));
        setUsed((prev) => new Set([...prev].filter((src) => !inCategory.has(src))));
      }}
    />
  );
}
