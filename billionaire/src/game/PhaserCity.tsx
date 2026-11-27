import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { store } from '../app/store';
import type { DistrictId } from '../types/core';
import { CityScene, type CityBridge } from './scenes/CityScene';

export interface CityHandle {
  zoom(f: number): void;
  focus(id: string): void;
}

interface Props {
  active: boolean;
  onHover: (info: { propertyId: string | null; district: DistrictId | null; x: number; y: number } | null) => void;
  handleRef: React.MutableRefObject<CityHandle | null>;
}

/** Mounts the Phaser city once per game session and bridges it to the store. */
export function PhaserCity({ active, onHover, handleRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;
  const activeRef = useRef(active);
  activeRef.current = active;
  // Build the city lazily the first time it is opened.
  const [started, setStarted] = useState(active);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);

  useEffect(() => {
    if (!started || !host.current) return;
    const bridge: CityBridge = {
      getState: () => store.state,
      onSelectProperty: (id) => store.select({ propertyId: id, district: id ? store.state?.properties[id]?.district ?? null : null }),
      onSelectDistrict: (d) => store.select({ propertyId: null, district: d }),
      onHover: (info) => hoverRef.current(info),
      subscribe: (fn) => store.subscribe(fn),
      getSelection: () => ({ propertyId: store.selection.propertyId, district: store.selection.district, filter: store.cityFilter }),
      consumeFocus: () => {
        const f = store.focusRequest;
        if (!f) return null;
        store.focusRequest = null;
        return f.propertyId;
      },
      onProgress: (r) => setProgress((prev) => (r >= 1 || r - prev > 0.04 ? r : prev)),
    };
    let destroyed = false;
    const start = () => {
      if (destroyed || !host.current) return;
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: '#0b1a26',
        scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth || 800, height: host.current.clientHeight || 600 },
        render: { antialias: true, powerPreference: 'low-power', roundPixels: false },
        fps: { target: 60, limit: 40, min: 15 },
        banner: false,
        disableContextMenu: true,
        audio: { noAudio: true },
      });
      game.scene.add('city', CityScene, true, { bridge });
      gameRef.current = game;
      // The city may be created while hidden (e.g. game opens on the dashboard): don't render then.
      game.events.once(Phaser.Core.Events.READY, () => {
        if (!activeRef.current) game.loop.sleep();
      });
      handleRef.current = {
        zoom: (f) => (game.scene.getScene('city') as CityScene | null)?.zoomBy(f),
        focus: (id) => (game.scene.getScene('city') as CityScene | null)?.focusProperty(id),
      };
    };
    // Wait for web fonts so district labels render in the display face.
    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();
    return () => {
      destroyed = true;
      handleRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [handleRef, started]);

  // Sleep the render loop while the city is hidden to save GPU/CPU.
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (active) {
      g.loop.wake();
      g.scale.refresh();
    } else g.loop.sleep();
  }, [active]);

  return (
    <>
      <div ref={host} className="city-canvas" data-testid="city-canvas" />
      {started && progress < 1 && (
        <div className="city-loading" data-testid="city-loading">
          <div className="eyebrow">Constructing Miami</div>
          <div className="bar" style={{ width: 220 }}>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
