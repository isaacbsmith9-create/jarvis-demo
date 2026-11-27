import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, HALF_X, HALF_Z } from '../game/config';
import {
  blockCenterX, blockCenterZ, Building, dockContainers, LANDMARKS, LAYOUT, mulberry32, roadX, roadZ,
} from '../game/city';
import { asphaltTexture, labelTexture, windowTextures, WINDOW_TILE } from '../game/textures';
import { useSwappableTexture } from '../game/assets';

const TILE_U = WINDOW_TILE.cellW * WINDOW_TILE.cells;
const TILE_V = WINDOW_TILE.cellH * WINDOW_TILE.cells;

function buildingGeometry(list: Building[]) {
  const rand = mulberry32(11);
  const col = new THREE.Color();
  const geos = list.map((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // offset u per building so neighbours don't share identical window patterns
    const uOff = Math.floor(rand() * 4) * 0.25;
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) {
          uv.setXY(i, 0.01, 0.01); // roof/bottom: plain wall color
        } else {
          const span = f < 2 ? b.d : b.w;
          uv.setXY(i, uv.getX(i) * (span / TILE_U) + uOff, uv.getY(i) * (b.h / TILE_V));
        }
      }
    }
    g.translate(b.x, b.h / 2, b.z);
    col.set(b.color).multiplyScalar(0.85 + rand() * 0.3);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      // roofs a bit darker
      const v = Math.floor(i / 3);
      const roof = v >= 8 && v < 12 ? 0.55 : 1;
      colors[i] = col.r * roof;
      colors[i + 1] = col.g * roof;
      colors[i + 2] = col.b * roof;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  return mergeGeometries(geos)!;
}

function Buildings({ list }: { list: Building[] }) {
  const geo = useMemo(() => buildingGeometry(list), [list]);
  const win = windowTextures();
  const map = useSwappableTexture('/assets/textures/facade.png', () => win.map);
  const emissiveMap = useSwappableTexture('/assets/textures/facade_emissive.png', () => win.emissive);
  for (const t of [map, emissiveMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        map={map}
        emissiveMap={emissiveMap}
        emissive="#ffffff"
        emissiveIntensity={0.9}
        roughness={0.85}
      />
    </mesh>
  );
}

function Ground() {
  const tex = useSwappableTexture('/assets/textures/asphalt.png', asphaltTexture);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((HALF_X * 2) / 8, (HALF_Z * 2) / 8);
  }, [tex]);
  return (
    <>
      {/* outskirts */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#17181d" />
      </mesh>
      {/* district asphalt */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[HALF_X * 2, HALF_Z * 2]} />
        <meshStandardMaterial map={tex} color="#c4c4cc" roughness={0.95} />
      </mesh>
      {/* waterfront */}
      <Water />
    </>
  );
}

function Water() {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.03;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, HALF_Z + 150]}>
        <planeGeometry args={[1200, 300]} />
        <meshStandardMaterial ref={mat} color="#0d2436" emissive="#1b4a6b" emissiveIntensity={0.12} metalness={0.6} roughness={0.25} />
      </mesh>
      {/* sea wall */}
      <mesh position={[0, -0.3, HALF_Z + 0.5]}>
        <boxGeometry args={[HALF_X * 2 + 8, 0.9, 1]} />
        <meshStandardMaterial color="#5d5a55" />
      </mesh>
      {/* railing */}
      <mesh position={[0, 0.55, HALF_Z + 0.3]}>
        <boxGeometry args={[HALF_X * 2, 0.08, 0.08]} />
        <meshStandardMaterial color="#888" metalness={0.6} />
      </mesh>
    </>
  );
}

function Sidewalks() {
  const geo = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (let bz = 0; bz < CITY.blocksZ; bz++) {
      for (let bx = 0; bx < CITY.blocksX; bx++) {
        const g = new THREE.BoxGeometry(CITY.block, 0.18, CITY.block);
        g.translate(blockCenterX(bx), 0.09, blockCenterZ(bz));
        geos.push(g);
      }
    }
    return mergeGeometries(geos)!;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color="#7b7a78" roughness={0.9} />
    </mesh>
  );
}

function RoadMarkings() {
  const { dashes, crossings } = useMemo(() => {
    const d: THREE.BufferGeometry[] = [];
    const c: THREE.BufferGeometry[] = [];
    const plane = (x: number, z: number, w: number, l: number, list: THREE.BufferGeometry[]) => {
      const g = new THREE.PlaneGeometry(w, l);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0.02, z);
      list.push(g);
    };
    const r = CITY.road / 2;
    for (let i = 0; i <= CITY.blocksX; i++) {
      for (let j = 0; j < CITY.blocksZ; j++) {
        // vertical road i between intersections j and j+1
        const z0 = roadZ(j) + r + 2;
        const z1 = roadZ(j + 1) - r - 2;
        for (let z = z0; z < z1; z += 4) plane(roadX(i), z + 1, 0.2, 2, d);
      }
    }
    for (let j = 0; j <= CITY.blocksZ; j++) {
      for (let i = 0; i < CITY.blocksX; i++) {
        const x0 = roadX(i) + r + 2;
        const x1 = roadX(i + 1) - r - 2;
        for (let x = x0; x < x1; x += 4) {
          const g = new THREE.PlaneGeometry(2, 0.2);
          g.rotateX(-Math.PI / 2);
          g.translate(x + 1, 0.02, roadZ(j));
          d.push(g);
        }
      }
    }
    // zebra crossings on each intersection approach
    for (let i = 0; i <= CITY.blocksX; i++) {
      for (let j = 0; j <= CITY.blocksZ; j++) {
        const x = roadX(i);
        const z = roadZ(j);
        for (let s = -3; s <= 3; s++) {
          if (j > 0) plane(x + s * 1.3, z - r - 1.1, 0.6, 1.8, c);
          if (j < CITY.blocksZ) plane(x + s * 1.3, z + r + 1.1, 0.6, 1.8, c);
          if (i > 0) plane(x - r - 1.1, z + s * 1.3, 1.8, 0.6, c);
          if (i < CITY.blocksX) plane(x + r + 1.1, z + s * 1.3, 1.8, 0.6, c);
        }
      }
    }
    return { dashes: mergeGeometries(d)!, crossings: mergeGeometries(c)! };
  }, []);
  return (
    <>
      <mesh geometry={dashes}>
        <meshBasicMaterial color="#d9b44a" />
      </mesh>
      <mesh geometry={crossings}>
        <meshBasicMaterial color="#bdbcb8" transparent opacity={0.75} />
      </mesh>
    </>
  );
}

function StreetLights() {
  const positions = useMemo(() => {
    const p: [number, number, number][] = [];
    const o = CITY.block / 2 - 0.7;
    for (let bz = 0; bz < CITY.blocksZ; bz++) {
      for (let bx = 0; bx < CITY.blocksX; bx++) {
        const cx = blockCenterX(bx);
        const cz = blockCenterZ(bz);
        // corners, arm pointing diagonally toward the intersection
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          p.push([cx + sx * o, cz + sz * o, Math.atan2(sx, sz)]);
        }
      }
    }
    return p;
  }, []);
  const poles = useRef<THREE.InstancedMesh>(null!);
  const heads = useRef<THREE.InstancedMesh>(null!);
  const pools = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    positions.forEach(([x, z, yaw], i) => {
      m.makeTranslation(x, 2.7, z);
      poles.current.setMatrixAt(i, m);
      q.setFromAxisAngle(up, yaw);
      const hx = x + Math.sin(yaw) * 0.9;
      const hz = z + Math.cos(yaw) * 0.9;
      m.compose(new THREE.Vector3(hx, 5.3, hz), q, new THREE.Vector3(1, 1, 1));
      heads.current.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(hx + Math.sin(yaw) * 0.8, 0.21, hz + Math.cos(yaw) * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
      pools.current.setMatrixAt(i, m);
    });
    poles.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    pools.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.11, 5.4, 6]} />
        <meshStandardMaterial color="#2e3036" metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, positions.length]}>
        <boxGeometry args={[0.35, 0.18, 1.9]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffcc77" emissiveIntensity={2} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, undefined, positions.length]}>
        <circleGeometry args={[3.6, 24]} />
        <meshBasicMaterial color="#ffb85c" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function Parking() {
  return (
    <>
      {LAYOUT.parking.map((p, i) => (
        <group key={i} position={[p.x, 0.19, p.z]}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[p.w, p.d]} />
            <meshStandardMaterial color="#2c2d31" />
          </mesh>
          {[-2, -1, 0, 1, 2].map((s) => (
            <mesh key={s} rotation-x={-Math.PI / 2} position={[s * 1.4, 0.01, -p.d / 2 + 1.6]}>
              <planeGeometry args={[0.12, 2.6]} />
              <meshBasicMaterial color="#cfcfcf" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ---------------- Landmarks ----------------

function Label3D({ text, position, scale = 6, color = '#fff' }: { text: string; position: [number, number, number]; scale?: number; color?: string }) {
  const tex = useMemo(() => labelTexture(text, color), [text, color]);
  return (
    <sprite position={position} scale={[scale, scale / 4, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0.18, z]} scale={s}>
      <mesh position-y={1} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 2, 6]} />
        <meshStandardMaterial color="#4a3526" />
      </mesh>
      <mesh position-y={2.8} castShadow>
        <coneGeometry args={[1.3, 3, 7]} />
        <meshStandardMaterial color="#284a2e" />
      </mesh>
    </group>
  );
}

function Plaza({ cx, cz }: { cx: number; cz: number }) {
  const water = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    water.current.position.y = 0.85 + Math.sin(clock.elapsedTime * 2) * 0.03;
  });
  const inner = CITY.block - CITY.sidewalk * 2;
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.19} receiveShadow>
        <planeGeometry args={[inner, inner]} />
        <meshStandardMaterial color="#2f4a2c" />
      </mesh>
      {/* cross paths */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.2}>
        <planeGeometry args={[3, inner]} />
        <meshStandardMaterial color="#8d8375" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.2}>
        <planeGeometry args={[inner, 3]} />
        <meshStandardMaterial color="#8d8375" />
      </mesh>
      {/* fountain */}
      <mesh position-y={0.5} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 2.6, 0.7, 24]} />
        <meshStandardMaterial color="#a39a8c" />
      </mesh>
      <mesh ref={water} position-y={0.85} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.1, 24]} />
        <meshStandardMaterial color="#2a6f9c" emissive="#1d5b80" emissiveIntensity={0.6} />
      </mesh>
      {/* statue of the city's founder */}
      <mesh position-y={1.6} castShadow>
        <boxGeometry args={[0.9, 1.6, 0.9]} />
        <meshStandardMaterial color="#9d9384" />
      </mesh>
      <mesh position-y={3.1} castShadow>
        <capsuleGeometry args={[0.35, 1, 4, 8]} />
        <meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.35} />
      </mesh>
      {[[-7, -7], [7, -7], [-7, 7], [7, 7], [-4, -8.5], [4, 8.5], [-8.5, 4], [8.5, -4]].map(([x, z], i) => (
        <Tree key={i} x={x} z={z} s={0.9 + (i % 3) * 0.15} />
      ))}
      <Label3D text="Plaza de la Fortuna" position={[0, 6.5, 0]} scale={9} color="#ffe2a6" />
    </group>
  );
}

function Tower({ cx, cz }: { cx: number; cz: number }) {
  const beacon = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    beacon.current.emissiveIntensity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 4 : 0.3;
  });
  const geo = useMemo(
    () => buildingGeometry([
      { x: 0, z: 0, w: 16, d: 16, h: 60, color: '#3b4656' },
      { x: 0, z: 0, w: 11, d: 11, h: 78, color: '#465366' },
    ]),
    [],
  );
  const win = windowTextures();
  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors map={win.map} emissiveMap={win.emissive} emissive="#fff" emissiveIntensity={1} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position-y={86}>
        <cylinderGeometry args={[0.15, 0.4, 16, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} />
      </mesh>
      <mesh position-y={94.5}>
        <sphereGeometry args={[0.6, 10, 10]} />
        <meshStandardMaterial ref={beacon} color="#ff2a2a" emissive="#ff0000" />
      </mesh>
      {/* gold crown band */}
      <mesh position-y={78.3}>
        <boxGeometry args={[11.4, 0.6, 11.4]} />
        <meshStandardMaterial color="#e8b84a" emissive="#e8b84a" emissiveIntensity={0.6} metalness={0.8} />
      </mesh>
      <Label3D text="Aurelio Tower" position={[0, 64, 9]} scale={14} color="#e8b84a" />
    </group>
  );
}

function Precinct({ cx, cz }: { cx: number; cz: number }) {
  const red = useRef<THREE.MeshStandardMaterial>(null!);
  const blue = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 8) > 0;
    red.current.emissiveIntensity = on ? 3 : 0.2;
    blue.current.emissiveIntensity = on ? 0.2 : 3;
  });
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 4.5, -3]} castShadow receiveShadow>
        <boxGeometry args={[18, 9, 10]} />
        <meshStandardMaterial color="#c9c4b8" />
      </mesh>
      <mesh position={[0, 6.2, 2.05]}>
        <boxGeometry args={[18, 0.8, 0.1]} />
        <meshStandardMaterial color="#1f3f8c" emissive="#1f3f8c" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 1.6, 2.06]}>
        <boxGeometry args={[3, 3.2, 0.1]} />
        <meshStandardMaterial color="#1a1d24" />
      </mesh>
      <mesh position={[-4, 9.3, -3]}>
        <boxGeometry args={[1.4, 0.4, 0.5]} />
        <meshStandardMaterial ref={red} color="#ff3030" emissive="#ff0000" />
      </mesh>
      <mesh position={[4, 9.3, -3]}>
        <boxGeometry args={[1.4, 0.4, 0.5]} />
        <meshStandardMaterial ref={blue} color="#3060ff" emissive="#0040ff" />
      </mesh>
      <Label3D text="SAPD 9th Precinct" position={[0, 7.5, 2.3]} scale={10} color="#cfe0ff" />
      {/* lot */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.19, 7]}>
        <planeGeometry args={[22, 10]} />
        <meshStandardMaterial color="#2c2d31" />
      </mesh>
    </group>
  );
}

function Church({ cx, cz }: { cx: number; cz: number }) {
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 5, 1]} castShadow receiveShadow>
        <boxGeometry args={[10, 10, 16]} />
        <meshStandardMaterial color="#d6cbb4" />
      </mesh>
      <mesh position={[0, 11.5, 1]} rotation-z={Math.PI / 4} scale={[1, 1, 1]} castShadow>
        <boxGeometry args={[7.1, 7.1, 16]} />
        <meshStandardMaterial color="#6e3a2e" />
      </mesh>
      <mesh position={[0, 9, -8]} castShadow>
        <boxGeometry args={[5, 18, 5]} />
        <meshStandardMaterial color="#d6cbb4" />
      </mesh>
      <mesh position={[0, 21, -8]} castShadow>
        <coneGeometry args={[3.6, 6, 4]} />
        <meshStandardMaterial color="#6e3a2e" />
      </mesh>
      <mesh position={[0, 14, -5.45]}>
        <circleGeometry args={[1.2, 20]} />
        <meshStandardMaterial color="#fff6d8" emissive="#ffe8a8" emissiveIntensity={1.2} />
      </mesh>
      <Label3D text="Santa Lucia" position={[0, 26, -8]} scale={8} color="#fff6d8" />
    </group>
  );
}

function Docks({ bx, cx, cz, crane }: { bx: number; cx: number; cz: number; crane: boolean }) {
  const containers = useMemo(() => dockContainers(bx), [bx]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.19, cz]} receiveShadow>
        <planeGeometry args={[CITY.block - 2, CITY.block - 2]} />
        <meshStandardMaterial color="#4a4a4c" />
      </mesh>
      {containers.map((c, i) => (
        <group key={i}>
          {Array.from({ length: Math.round(c.h / 2.6) }).map((_, k) => (
            <mesh key={k} position={[c.x, 0.18 + 1.3 + k * 2.6, c.z]} castShadow receiveShadow>
              <boxGeometry args={[c.w, 2.5, c.d]} />
              <meshStandardMaterial color={k % 2 ? new THREE.Color(c.color).offsetHSL(0.05, 0, -0.08) : c.color} roughness={0.7} metalness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      {crane && (
        <group position={[cx, 0, cz + 11]}>
          {[-5, 5].map((x) => (
            <mesh key={x} position={[x, 9, 0]} castShadow>
              <boxGeometry args={[0.8, 18, 0.8]} />
              <meshStandardMaterial color="#d8a020" />
            </mesh>
          ))}
          <mesh position={[0, 18, 6]} castShadow>
            <boxGeometry args={[11, 1.2, 26]} />
            <meshStandardMaterial color="#d8a020" />
          </mesh>
          <mesh position={[0, 18.9, -6]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial color="#f00" emissive="#f00" emissiveIntensity={3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Landmarks() {
  let craneDone = false;
  return (
    <>
      {LANDMARKS.map((l, i) => {
        const cx = blockCenterX(l.block[0]);
        const cz = blockCenterZ(l.block[1]);
        switch (l.kind) {
          case 'plaza': return <Plaza key={i} cx={cx} cz={cz} />;
          case 'tower': return <Tower key={i} cx={cx} cz={cz} />;
          case 'precinct': return <Precinct key={i} cx={cx} cz={cz} />;
          case 'church': return <Church key={i} cx={cx} cz={cz} />;
          case 'docks': {
            const crane = !craneDone && l.block[0] === 4;
            if (crane) craneDone = true;
            return <Docks key={i} bx={l.block[0]} cx={cx} cz={cz} crane={crane} />;
          }
        }
        return null;
      })}
      <Label3D text="PORT AURELIO" position={[blockCenterX(4), 24, HALF_Z - 4]} scale={12} color="#ffd36b" />
    </>
  );
}

/** Distant skyline beyond the playable district for depth. */
function Skyline() {
  const geo = useMemo(() => {
    const rand = mulberry32(404);
    const list: Building[] = [];
    const ring = Math.max(HALF_X, HALF_Z) + 40;
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * Math.PI * 2;
      // keep the sea side (south, +z) open
      if (Math.sin(a) > 0.55) continue;
      const r = ring + rand() * 60;
      list.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w: 14 + rand() * 18, d: 14 + rand() * 18, h: 20 + rand() * 70, color: '#3a3f4c' });
    }
    return buildingGeometry(list);
  }, []);
  const win = windowTextures();
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors map={win.map} emissiveMap={win.emissive} emissive="#fff" emissiveIntensity={0.7} roughness={0.9} />
    </mesh>
  );
}

export function City() {
  return (
    <group>
      <Ground />
      <Sidewalks />
      <RoadMarkings />
      <Parking />
      <Buildings list={LAYOUT.buildings} />
      <StreetLights />
      <Landmarks />
      <Skyline />
    </group>
  );
}
