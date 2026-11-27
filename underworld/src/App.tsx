import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Player } from './scene/Player';
import { City } from './scene/City';
import { Storefronts } from './scene/Storefronts';
import { TouchControls } from './ui/TouchControls';
import { bindKeyboard, input } from './game/input';
import { world } from './game/world';
import { buildColliders, SPAWN } from './game/city';

// one-time world init (colliders + spawn)
world.colliders = buildColliders();
world.player.pos.set(SPAWN.x, 0, SPAWN.z);

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

export function App() {
  const drag = useRef<{ id: number; x: number } | null>(null);
  useEffect(() => bindKeyboard(), []);

  return (
    <div
      className="game-root"
      onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX }; }}
      onPointerMove={(e) => {
        if (!drag.current || drag.current.id !== e.pointerId) return;
        input.camYawDelta -= (e.clientX - drag.current.x) * 0.006;
        drag.current.x = e.clientX;
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 55, near: 0.1, far: 700, position: [0, 8, 10] }}>
        <Lighting />
        <City />
        <Storefronts />
        <Player />
      </Canvas>
      <TouchControls actionLabel="ACT" />
    </div>
  );
}
