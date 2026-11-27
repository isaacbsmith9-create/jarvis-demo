import { useEffect, useRef, useState } from 'react';
import { input } from '../game/input';

const RADIUS = 56;

function useIsTouch() {
  const [touch, setTouch] = useState(
    () => typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window),
  );
  useEffect(() => {
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', on);
  }, []);
  return touch;
}

export function TouchControls({ actionLabel }: { actionLabel: string }) {
  const isTouch = useIsTouch();
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  if (!isTouch) return null;

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    pointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    input.stickActive = true;
    input.stickX = 0;
    input.stickY = 0;
    setKnob({ x: 0, y: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    e.stopPropagation();
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    input.stickX = dx / RADIUS;
    input.stickY = -dy / RADIUS;
    setKnob({ x: dx, y: dy });
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    input.stickActive = false;
    input.stickX = 0;
    input.stickY = 0;
    setKnob(null);
  };

  const hold = (key: 'sprintTouch' | 'actionTouch') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input[key] = true;
    },
    onPointerUp: () => { input[key] = false; },
    onPointerCancel: () => { input[key] = false; },
  });

  return (
    <>
      <div
        className="stick-zone"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div ref={baseRef} className="stick-base">
          <div
            className="stick-knob"
            style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }}
          />
        </div>
      </div>
      <div className="touch-buttons">
        <button className="tbtn tbtn-sprint" {...hold('sprintTouch')}>RUN</button>
        <button className="tbtn tbtn-action" {...hold('actionTouch')}>{actionLabel}</button>
      </div>
    </>
  );
}
