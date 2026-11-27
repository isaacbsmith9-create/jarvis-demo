import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { consumeCamYaw, getMoveIntent } from '../game/input';
import { resolveCircleVsAABBs, world } from '../game/world';
import { PLAYER } from '../game/config';

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const desiredVel = new THREE.Vector3();

export function Player() {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Mesh>(null!);
  const legR = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Mesh>(null!);
  const armR = useRef<THREE.Mesh>(null!);
  const walkPhase = useRef(0);
  const { camera } = useThree();

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = world.player;

    // camera yaw (Q/E or drag)
    world.camYaw += consumeCamYaw(dt);

    // movement relative to camera yaw
    const intent = getMoveIntent();
    const maxSpeed = intent.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(world.camYaw);
    const cos = Math.cos(world.camYaw);
    // forward = -Z rotated by yaw; right = +X rotated by yaw
    const fx = -sin, fz = -cos;
    const rx = cos, rz = -sin;
    desiredVel.set(fx * intent.y + rx * intent.x, 0, fz * intent.y + rz * intent.x).multiplyScalar(maxSpeed);

    const accel = desiredVel.lengthSq() > 0 ? PLAYER.accel : PLAYER.decel;
    p.vel.lerp(desiredVel, 1 - Math.exp(-accel * dt));
    p.pos.addScaledVector(p.vel, dt);
    resolveCircleVsAABBs(p.pos, p.radius, world.colliders);
    p.speed = Math.hypot(p.vel.x, p.vel.z);

    // face movement direction
    if (p.speed > 0.3) {
      const targetHeading = Math.atan2(p.vel.x, p.vel.z);
      let diff = targetHeading - p.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.heading += diff * (1 - Math.exp(-14 * dt));
    }

    root.current.position.copy(p.pos);
    root.current.rotation.y = p.heading;

    // simple procedural walk cycle
    walkPhase.current += dt * p.speed * 1.6;
    const swing = Math.sin(walkPhase.current) * Math.min(1, p.speed / 4) * 0.8;
    legL.current.rotation.x = swing;
    legR.current.rotation.x = -swing;
    armL.current.rotation.x = -swing * 0.8;
    armR.current.rotation.x = swing * 0.8;
    body.current.position.y = Math.abs(Math.sin(walkPhase.current)) * 0.06 * Math.min(1, p.speed / 4);

    // chase camera
    const dist = PLAYER.camDistance;
    camTarget.set(p.pos.x, p.pos.y + 1.4, p.pos.z);
    camPos.set(p.pos.x + sin * dist, p.pos.y + PLAYER.camHeight, p.pos.z + cos * dist);
    camera.position.lerp(camPos, 1 - Math.exp(-8 * dt));
    camera.lookAt(camTarget);
  });

  const jacket = '#1b1b24';
  const skin = '#c99a74';
  return (
    <group ref={root}>
      {/* shadow blob */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* legs pivot at hips */}
        <group position={[-0.16, 0.9, 0]}>
          <mesh ref={legL} position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.22, 0.9, 0.24]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
        </group>
        <group position={[0.16, 0.9, 0]}>
          <mesh ref={legR} castShadow>
            <boxGeometry args={[0.22, 0.9, 0.24]} />
            <meshStandardMaterial color="#2a2f3a" />
          </mesh>
        </group>
        {/* torso */}
        <mesh position={[0, 1.3, 0]} castShadow>
          <boxGeometry args={[0.6, 0.75, 0.34]} />
          <meshStandardMaterial color={jacket} />
        </mesh>
        {/* gold chain accent */}
        <mesh position={[0, 1.55, 0.175]}>
          <boxGeometry args={[0.28, 0.05, 0.02]} />
          <meshStandardMaterial color="#e8b84a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* arms */}
        <group position={[-0.4, 1.62, 0]}>
          <mesh ref={armL} position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.2]} />
            <meshStandardMaterial color={jacket} />
          </mesh>
        </group>
        <group position={[0.4, 1.62, 0]}>
          <mesh ref={armR} position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.18, 0.7, 0.2]} />
            <meshStandardMaterial color={jacket} />
          </mesh>
        </group>
        {/* head */}
        <mesh position={[0, 1.9, 0]} castShadow>
          <boxGeometry args={[0.36, 0.38, 0.36]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* cap */}
        <mesh position={[0, 2.1, 0.04]}>
          <boxGeometry args={[0.4, 0.1, 0.46]} />
          <meshStandardMaterial color="#8a1c2b" />
        </mesh>
      </group>
    </group>
  );
}
