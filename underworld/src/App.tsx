import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Player } from './scene/Player';
import { TouchControls } from './ui/TouchControls';
import { bindKeyboard, input } from './game/input';
import { world } from './game/world';

function TestScene() {
  // Phase 1 movement test: a few crates to collide with
  const boxes = [
    { x: 6, z: -6, w: 3, d: 3 },
    { x: -8, z: -4, w: 4, d: 2 },
    { x: 0, z: -14, w: 10, d: 2 },
  ];
  world.colliders = boxes.map((b) => ({
    minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
  }));
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3a3d46" />
      </mesh>
      <gridHelper args={[200, 100, '#555', '#444']} position-y={0.01} />
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.x, 1, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, 2, b.d]} />
          <meshStandardMaterial color="#b0703a" />
        </mesh>
      ))}
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
      <Canvas shadows camera={{ fov: 55, near: 0.1, far: 600, position: [0, 8, 10] }}>
        <color attach="background" args={['#14141c']} />
        <hemisphereLight args={['#b8c4ff', '#2a2230', 0.7]} />
        <directionalLight position={[30, 50, 20]} intensity={1.4} castShadow />
        <TestScene />
        <Player />
      </Canvas>
      <TouchControls actionLabel="ACT" />
    </div>
  );
}
