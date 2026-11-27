import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAX_UNITS } from '../game/police';
import { world } from '../game/world';

function PoliceCar({ index }: { index: number }) {
  const g = useRef<THREE.Group>(null!);
  const red = useRef<THREE.MeshStandardMaterial>(null!);
  const blue = useRef<THREE.MeshStandardMaterial>(null!);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(({ clock }) => {
    const u = world.police[index];
    g.current.visible = !!u;
    if (!u) return;
    g.current.position.set(u.pos.x, 0, u.pos.z);
    g.current.rotation.y = u.heading;
    const chasing = u.mode === 'chase';
    const on = Math.sin(clock.elapsedTime * 14 + index) > 0;
    red.current.emissiveIntensity = chasing ? (on ? 5 : 0.2) : 0.15;
    blue.current.emissiveIntensity = chasing ? (on ? 0.2 : 5) : 0.15;
    glow.current.opacity = chasing ? 0.35 : 0;
    glow.current.color.set(on ? '#ff2a2a' : '#2a5bff');
  });

  return (
    <group ref={g} visible={false}>
      {/* body */}
      <mesh position-y={0.62} castShadow>
        <boxGeometry args={[1.9, 0.75, 4.3]} />
        <meshStandardMaterial color="#e9e9ee" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* black lower doors */}
      <mesh position-y={0.55}>
        <boxGeometry args={[1.94, 0.4, 2.2]} />
        <meshStandardMaterial color="#14161c" />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 1.25, -0.2]} castShadow>
        <boxGeometry args={[1.7, 0.6, 2.1]} />
        <meshStandardMaterial color="#1d2633" metalness={0.6} roughness={0.2} />
      </mesh>
      {/* light bar */}
      <mesh position={[-0.4, 1.62, -0.2]}>
        <boxGeometry args={[0.7, 0.18, 0.35]} />
        <meshStandardMaterial ref={red} color="#ff3030" emissive="#ff0000" toneMapped={false} />
      </mesh>
      <mesh position={[0.4, 1.62, -0.2]}>
        <boxGeometry args={[0.7, 0.18, 0.35]} />
        <meshStandardMaterial ref={blue} color="#3060ff" emissive="#1040ff" toneMapped={false} />
      </mesh>
      {/* headlights */}
      <mesh position={[0, 0.7, 2.16]}>
        <boxGeometry args={[1.5, 0.18, 0.05]} />
        <meshStandardMaterial color="#fff" emissive="#fff3d0" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* wheels */}
      {[[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.36, 0.36, 0.3, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* siren glow on the street */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.24}>
        <circleGeometry args={[4.5, 24]} />
        <meshBasicMaterial ref={glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function Police() {
  return (
    <>
      {Array.from({ length: MAX_UNITS }).map((_, i) => (
        <PoliceCar key={i} index={i} />
      ))}
    </>
  );
}
