import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Resize } from '@react-three/drei';
import * as THREE from 'three';

const STATUS_LINE_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};

const PARTICLE_COUNT = 6;

function PowerlineTower({ position, rotation = 0 }) {
  const { scene } = useGLTF('/models/powerline.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.color = new THREE.Color('#f8fafc'); // bright white-gray
          child.material.emissive = new THREE.Color('#f8fafc');
          child.material.emissiveIntensity = 0.15;
          child.material.metalness = 0.7;
          child.material.roughness = 0.2;
        }
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Resize scale={3.0}>
        <primitive object={clonedScene} />
      </Resize>
    </group>
  );
}

export default function PowerLine({ line, fromPos, toPos }) {
  const particlesRef = useRef([]);
  const tubeRef = useRef();
  const offsetsRef = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => i / PARTICLE_COUNT)
  );

  const lineColor = STATUS_LINE_COLORS[line.status] || STATUS_LINE_COLORS.optimal;

  const curve = useMemo(() => {
    const from = new THREE.Vector3(...fromPos);
    const to = new THREE.Vector3(...toPos);
    from.y = 2.0;
    to.y = 1.0;
    const mid = from.clone().lerp(to, 0.5);
    mid.y = 3.8;
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [fromPos[0], fromPos[1], fromPos[2], toPos[0], toPos[1], toPos[2]]);

  const towerData = useMemo(() => {
    const from = new THREE.Vector3(...fromPos);
    const to = new THREE.Vector3(...toPos);
    const dir = new THREE.Vector3().subVectors(to, from);
    const rotation = Math.atan2(dir.x, dir.z);
    const dist = dir.length();
    if (dist < 5) return [];
    const towers = [];
    const fractions = dist > 12 ? [0.25, 0.5, 0.75] : [0.35, 0.65];
    fractions.forEach(f => {
      const p = from.clone().lerp(to, f);
      towers.push({ position: [p.x, 0, p.z], rotation });
    });
    return towers;
  }, [fromPos[0], fromPos[1], fromPos[2], toPos[0], toPos[1], toPos[2]]);

  useFrame((_, delta) => {
    // Particles movement logic
    const speed = 0.35 + line.loadRatio * 0.5;
    const dir = line.powerFlowDirection ?? 1;
    offsetsRef.current = offsetsRef.current.map(o => {
      let next = o + delta * speed * dir;
      if (next > 1) next -= 1;
      if (next < 0) next += 1;
      return next;
    });
    offsetsRef.current.forEach((offset, i) => {
      const mesh = particlesRef.current[i];
      if (!mesh) return;
      const pt = curve.getPoint(Math.max(0, Math.min(1, offset)));
      mesh.position.copy(pt);
      mesh.position.y += 0.08;
    });
  });

  const isActive = line.currentFlow > 0.1;

  return (
    <group>
      {towerData.map((tower, i) => (
        <PowerlineTower key={`tower-${line.id}-${i}`} position={tower.position} rotation={tower.rotation} />
      ))}
      <mesh ref={tubeRef}>
        <tubeGeometry args={[curve, 40, 0.015, 6, false]} />
        <meshStandardMaterial
          color="#374151"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      {isActive && Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <mesh key={i} ref={el => { particlesRef.current[i] = el; }}>
          <sphereGeometry args={[0.085, 6, 6]} />
          <meshStandardMaterial
            color="#FF6B6B"
            emissive="#FF6B6B"
            emissiveIntensity={0.0}
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload('/models/powerline.glb');
