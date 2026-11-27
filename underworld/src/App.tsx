import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Player } from './scene/Player';
import { City } from './scene/City';
import { Businesses } from './scene/Businesses';
import { Police } from './scene/Police';
import { GameLoop, loop } from './game/GameLoop';
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { TouchControls } from './ui/TouchControls';
import { bindKeyboard, input } from './game/input';
import { world } from './game/world';
import { buildColliders, SPAWN } from './game/city';
import { BUSINESSES, CITY, ECONOMY } from './game/config';
import { territoryPct, useGame } from './game/store';
import { applySave, clearSave, loadGame, saveGame, startAutosave } from './game/save';
import { initPolice } from './game/police';

// ---- one-time world init: colliders, spawn, saved progress ----
world.colliders = buildColliders();
world.player.pos.set(SPAWN.x, 0, SPAWN.z);
const existingSave = loadGame();
if (existingSave) applySave(existingSave);

function Lighting() {
  return (
    <>
      <color attach="background" args={['#1a1630']} />
      <fog attach="fog" args={['#1a1630', 70, 260]} />
      <hemisphereLight args={['#a9a2e0', '#4a3d48', 1.5]} />
      <ambientLight intensity={0.35} color="#ffd9c0" />
      <directionalLight
        position={[-60, 90, 40]}
        intensity={1.8}
        color="#ffc7a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-far={300}
        shadow-bias={-0.0006}
      />
    </>
  );
}

function ActionButton() {
  const owned = useGame((s) => (s.zoneId ? !!s.owned[s.zoneId] : false));
  return <TouchControls actionLabel={owned ? 'UPGRD' : 'ACT'} />;
}

function newGame() {
  clearSave();
  useGame.getState().reset();
  world.player.pos.set(SPAWN.x, 0, SPAWN.z);
  world.player.vel.set(0, 0, 0);
  world.camYaw = 0;
  world.bustedCooldown = 0;
  loop.captureId = null;
  loop.captureProgress = 0;
  loop.payoutTimer = ECONOMY.payoutInterval;
  loop.heatAcc = 0;
  initPolice();
  saveGame();
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  const [hasSave] = useState(() => !!existingSave && (Object.keys(existingSave.owned).length > 0 || existingSave.cash !== ECONOMY.startCash));
  const owned = useGame((s) => s.owned);
  const cash = useGame((s) => s.cash);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="title" onPointerDown={(e) => e.stopPropagation()}>
      <div className="title-card">
        <div className="title-kicker">{CITY.name.toUpperCase()} · {CITY.district.toUpperCase()}</div>
        <h1 className="title-logo">UNDERWORLD</h1>
        <p className="title-tag">Take the block. Then take the city.</p>
        <ul className="title-goals">
          <li>Stand in a <b className="gold">gold zone</b> to take over a business.</li>
          <li>Owned businesses pay <b className="money">cash</b> every {ECONOMY.payoutInterval}s. Upgrade them for more.</li>
          <li>Takeovers raise <b className="hot">heat</b>. Above 2 stars, patrols chase on sight. Get caught and you pay.</li>
        </ul>
        <div className="title-controls">
          <div><span className="kbd">WASD</span>/<span className="kbd">↑↓←→</span> move · <span className="kbd">Shift</span> sprint</div>
          <div><span className="kbd">F</span>/<span className="kbd">Space</span> upgrade · <span className="kbd">Q</span>/<span className="kbd">E</span> or drag to turn camera</div>
          <div className="touch-hint">Phone: left stick to move (push to edge to run), right button to act, drag to look.</div>
        </div>
        <div className="title-actions">
          {hasSave ? (
            <>
              <button className="btn primary" onClick={onStart}>
                Continue · ${cash.toLocaleString()} · {territoryPct(owned)}% territory
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (window.confirm('Start over? Your saved empire will be wiped.')) {
                    newGame();
                    onStart();
                  }
                }}
              >
                New Game
              </button>
            </>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                newGame();
                onStart();
              }}
            >
              Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Menu({ onPause }: { onPause: () => void }) {
  const owned = useGame((s) => s.owned);
  const done = Object.keys(owned).length === BUSINESSES.length;
  const [saved, setSaved] = useState(false);
  return (
    <div className="menu">
      <button
        className="menu-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          setSaved(saveGame());
          setTimeout(() => setSaved(false), 1200);
        }}
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>
      <button className="menu-btn" onPointerDown={(e) => e.stopPropagation()} onClick={onPause}>
        Menu
      </button>
      {done && <div className="menu-win">The Narrows is yours.</div>}
    </div>
  );
}

export function App() {
  const drag = useRef<{ id: number; x: number } | null>(null);
  const paused = useGame((s) => s.paused);

  useEffect(() => {
    bindKeyboard();
    startAutosave();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') useGame.setState((s) => ({ paused: !s.paused }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="game-root"
      onPointerDown={(e) => {
        drag.current = { id: e.pointerId, x: e.clientX };
      }}
      onPointerMove={(e) => {
        if (!drag.current || drag.current.id !== e.pointerId) return;
        input.camYawDelta -= (e.clientX - drag.current.x) * 0.006;
        drag.current.x = e.clientX;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 55, near: 0.1, far: 700, position: [SPAWN.x, 8, SPAWN.z + 10] }}>
        <Lighting />
        <City />
        <Businesses />
        <Police />
        <Player />
        <GameLoop />
      </Canvas>
      {!paused && (
        <>
          <HUD>
            <div className="hud-top-right">
              <Minimap />
              <Menu onPause={() => useGame.setState({ paused: true })} />
            </div>
          </HUD>
          <ActionButton />
        </>
      )}
      {paused && <TitleScreen onStart={() => useGame.setState({ paused: false })} />}
    </div>
  );
}
