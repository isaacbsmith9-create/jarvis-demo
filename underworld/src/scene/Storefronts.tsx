import { useMemo } from 'react';
import * as THREE from 'three';
import { BusinessSite, LAYOUT } from '../game/city';
import { signTexture } from '../game/textures';
import { useSwappableTexture } from '../game/assets';

function Storefront({ site }: { site: BusinessSite }) {
  const { def, building: b, nx, nz } = site;
  const fallback = useMemo(() => () => signTexture(def.name, def.signBg, def.signFg), [def]);
  const sign = useSwappableTexture(def.signImage, fallback);
  // facade plane position: front face of the building
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
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={1.1} toneMapped={false} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

export function Storefronts() {
  return (
    <>
      {LAYOUT.sites.map((s) => (
        <Storefront key={s.def.id} site={s} />
      ))}
    </>
  );
}
