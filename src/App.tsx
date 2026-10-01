import { useCallback, useEffect, useState } from "react";
import { Game } from "./Game";
import { IMAGES, type QuizImage } from "./images";

interface Session {
  deck: QuizImage[]; // the whole category, in images.ts order
  startIndex: number;
}
import { Menu } from "./Menu";
import { loadSettings, loadUsed, saveSettings, saveUsed, type Settings } from "./storage";

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [used, setUsed] = useState(loadUsed);
  // Fixed when Start is pressed. null = on the menu.
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveUsed(used), [used]);

  const selected = IMAGES.filter((i) => i.category === settings.category);
  const unused = selected.filter((i) => !used.has(i.src));
  // Where Start picks up: the first unused question, or the very first one if they're all used.
  const startIndex = unused.length ? selected.indexOf(unused[0]) : 0;

  const start = () => {
    // Fullscreen has to be requested straight from the tap on Start.
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
    if (unused.length === 0) resetCategory(selected); // all used: start the category over
    setSession({ deck: selected, startIndex });
  };

  // Mark a category's questions as unused; other categories keep theirs.
  const resetCategory = useCallback((images: QuizImage[]) => {
    const inCategory = new Set(images.map((i) => i.src));
    setUsed((prev) => new Set([...prev].filter((src) => !inCategory.has(src))));
  }, []);

  const exit = useCallback(() => {
    setSession(null);
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  }, []);

  const markUsed = useCallback((src: string) => {
    setUsed((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);

  const onLoop = useCallback(() => {
    if (session) resetCategory(session.deck);
  }, [session, resetCategory]);

  if (session) {
    return (
      <Game
        deck={session.deck}
        startIndex={session.startIndex}
        effect={settings.effect}
        onAnswered={markUsed}
        onLoop={onLoop}
        onExit={exit}
      />
    );
  }

  return (
    <Menu
      settings={settings}
      onChange={(s: Settings) => setSettings(s)}
      total={selected.length}
      left={unused.length}
      startNumber={startIndex + 1}
      onStart={start}
      onResetUsed={() => resetCategory(selected)}
    />
  );
}
