import { useEffect, useRef } from "react";
import { QuizEngine, type EngineOptions } from "./engine";

const SWIPE = 60;

interface Props extends Omit<EngineOptions, "onFinished"> {
  onExit: () => void;
}

export function Game({ deck, effect, onAnswered, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<QuizEngine | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  // Keep the latest callbacks without restarting the engine when they change.
  const callbacks = useRef({ onAnswered, onExit });
  callbacks.current = { onAnswered, onExit };

  useEffect(() => {
    const engine = new QuizEngine(canvasRef.current!, {
      deck,
      effect,
      onAnswered: (src) => callbacks.current.onAnswered(src),
      onFinished: () => callbacks.current.onExit(),
    });
    engineRef.current = engine;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); engine.tap(); }
      else if (e.key === "ArrowRight") engine.next();
      else if (e.key === "ArrowLeft") engine.prev();
      else if (e.key === "Enter") engine.reveal();
      else if (e.key === "Escape") callbacks.current.onExit();
    };
    const blockScroll = (e: Event) => e.preventDefault();

    window.addEventListener("resize", engine.resize);
    document.addEventListener("keydown", onKey);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    document.addEventListener("gesturestart", blockScroll);

    // Keep the iPad screen from dimming mid-game.
    let wakeLock: WakeLockSentinel | undefined;
    const requestWakeLock = async () => {
      try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") requestWakeLock(); };
    requestWakeLock();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      engine.destroy();
      engineRef.current = null;
      window.removeEventListener("resize", engine.resize);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("gesturestart", blockScroll);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock?.release().catch(() => {});
    };
  }, [deck, effect]);

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current;
    const engine = engineRef.current;
    pointerStart.current = null;
    if (!start || !engine) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) engine.next(); else engine.prev();
    } else if (Math.abs(dy) > SWIPE) {
      if (dy < 0) engine.reveal(); else onExit();
    } else {
      engine.tap();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="stage"
      onPointerDown={(e) => { pointerStart.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerStart.current = null; }}
    />
  );
}
