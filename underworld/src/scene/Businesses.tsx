import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BusinessSite, LAYOUT, ZONE_RADIUS } from '../game/city';
import { ringTexture, signTexture } from '../game/textures';
import { useSwappableTexture } from '../game/assets';
import { useGame } from '../game/store';
import { loop } from '../game/GameLoop';

const GOLD = new THREE.Color('#e8b84a');
const GREEN = new THREE.Color('#5fd38a');

function Storefront({ site }: { site: BusinessSite }) {
  const { def, building: b, nx, nz } = site;
  const fallback = useMemo(() => () => signTexture(def.name, def.signBg, def.signFg), [def]);
  const sign = useSwappableTexture(def.signImage, fallback);
  const yaw = Math.atan2(nx, nz);
  const fx = b.x + nx * (b.w / 2 + 0.06);
  const fz = b.z + nz * (b.d / 2 + 0.06);
  const width = Math.min(b.w, b.d) - 0.6;
  return (
    <group position={[fx, 0, fz]} rotation-y={yaw}>
      {/* lit shop window */}
      <mesh position={[0, 1.6, 0]}>
        <planeGeometry args={[width - 1.6, 2.4]} />
        <meshStandardMaterial color="#1b1b1b" emissive={def.signFg} emissiveIntensity={0.25} />
      </mesh>
      {/* awning */}
      <mesh position={[0, 3.2, 0.7]} rotation-x={0.35} castShadow>
        <boxGeometry args={[width, 0.08, 1.6]} />
        <meshStandardMaterial color={def.signBg} />
      </mesh>
      {/* sign */}
      <mesh position={[0, 4.4, 0.05]}>
        <planeGeometry args={[width, width / 4]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Zone({ site }: { site: BusinessSite }) {
  const level = useGame((s) => s.owned[site.def.id] ?? 0);
  const owned = level > 0;
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
  const fill = useRef<THREE.Mesh>(null!);
  const crown = useRef<THREE.Group>(null!);
  const ring = ringTexture();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const active = loop.captureId === site.def.id;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + site.zx);
    ringMat.current.opacity = owned ? 0.55 : 0.6 + pulse * 0.4;
    beamMat.current.opacity = owned ? 0.06 : 0.12 + pulse * 0.08 + (active ? 0.15 : 0);
    const prog = active ? loop.captureProgress : 0;
    fill.current.visible = prog > 0.001;
    fill.current.scale.setScalar(Math.max(0.001, prog));
    if (crown.current) {
      crown.current.rotation.y = t * 1.5;
      crown.current.position.y = site.building.h + 2 + Math.sin(t * 2) * 0.3;
    }
  });

  const color = owned ? GREEN : GOLD;
  return (
    <group>
      <group position={[site.zx, 0.22, site.zz]}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[ZONE_RADIUS * 2.2, ZONE_RADIUS * 2.2]} />
          <meshBasicMaterial ref={ringMat} map={ring} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh ref={fill} rotation-x={-Math.PI / 2} position-y={0.01}>
          <circleGeometry args={[ZONE_RADIUS * 0.95, 32]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position-y={owned ? 1.5 : 6}>
          <cylinderGeometry args={[ZONE_RADIUS * 0.9, ZONE_RADIUS * 0.9, owned ? 3 : 12, 24, 1, true]} />
          <meshBasicMaterial ref={beamMat} color={color} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      {owned && (
        <group ref={crown} position={[site.building.x, site.building.h + 2, site.building.z]}>
          <mesh>
            <octahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color="#5fd38a" emissive="#2fae5e" emissiveIntensity={1.2} metalness={0.5} roughness={0.3} />
          </mesh>
          {Array.from({ length: level }).map((_, i) => (
            <mesh key={i} position={[(i - (level - 1) / 2) * 0.6, -1.4, 0]}>
              <boxGeometry args={[0.35, 0.35, 0.35]} />
              <meshStandardMaterial color="#e8b84a" emissive="#e8b84a" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function Businesses() {
  return (
    <>
      {LAYOUT.sites.map((s) => (
        <group key={s.def.id}>
          <Storefront site={s} />
          <Zone site={s} />
        </group>
      ))}
    </>
  );
}
