import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Resize } from '@react-three/drei';
import * as THREE from 'three';

const STATUS_LINE_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};

// Voltage-level visual config
const VOLTAGE_CONFIG = {
  hv:   { tubeRadius: 0.035, towerScale: 4.5, wireElevation: 5.5, particleSize: 0.11, particleCount: 8, wireColor: '#475569' },
  sub:  { tubeRadius: 0.022, towerScale: 3.2, wireElevation: 3.8, particleSize: 0.09, particleCount: 7, wireColor: '#374151' },
  dist: { tubeRadius: 0.015, towerScale: 2.2, wireElevation: 2.8, particleSize: 0.07, particleCount: 5, wireColor: '#374151' },
  lv:   { tubeRadius: 0.010, towerScale: 0,   wireElevation: 1.8, particleSize: 0.055,particleCount: 4, wireColor: '#6B7280' },
};

function PowerlineTower({ position, rotation = 0, scale = 3.2 }) {
  const { scene } = useGLTF('/models/powerline.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.color = new THREE.Color('#d1d5db');
          child.material.emissive = new THREE.Color('#d1d5db');
          child.material.emissiveIntensity = 0.1;
          child.material.metalness = 0.7;
          child.material.roughness = 0.3;
        }
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Resize scale={scale}>
        <primitive object={clonedScene} />
      </Resize>
    </group>
  );
}

function WoodenPole({ position, rotation = 0 }) {
  const { scene } = useGLTF('/models/Wooden Utility pole.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Resize scale={2.5}>
        <primitive object={clonedScene} />
      </Resize>
    </group>
  );
}

export default function PowerLine({ line, fromPos, toPos }) {
  const vLevel = line.voltageLevel ?? 'sub';
  const cfg = VOLTAGE_CONFIG[vLevel] || VOLTAGE_CONFIG.sub;
  const isRingTie = line.isRingTie;
  const isActive = line.currentFlow > 0.05;

  const particlesRef = useRef([]);
  const offsetsRef = useRef(
    Array.from({ length: cfg.particleCount }, (_, i) => i / cfg.particleCount)
  );

  const lineColor = STATUS_LINE_COLORS[line.status] || STATUS_LINE_COLORS.optimal;

  const curve = useMemo(() => {
    const from = new THREE.Vector3(...fromPos);
    const to   = new THREE.Vector3(...toPos);
    from.y = cfg.wireElevation;
    to.y   = cfg.wireElevation * 0.85;
    const mid = from.clone().lerp(to, 0.5);
    mid.y = cfg.wireElevation + (isRingTie ? 1.5 : 1.2);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [fromPos[0], fromPos[1], fromPos[2], toPos[0], toPos[1], toPos[2], cfg.wireElevation, isRingTie]);

  const towerData = useMemo(() => {
    if (cfg.towerScale === 0) return []; // LV lines have no towers
    const from = new THREE.Vector3(...fromPos);
    const to   = new THREE.Vector3(...toPos);
    const dir  = new THREE.Vector3().subVectors(to, from);
    const rotation = Math.atan2(dir.x, dir.z);
    const dist = dir.length();
    if (dist < 4) return [];
    const fractions = dist > 14 ? [0.25, 0.5, 0.75] : [0.4, 0.6];
    return fractions.map(f => {
      const p = from.clone().lerp(to, f);
      return { position: [p.x, 0, p.z], rotation };
    });
  }, [fromPos[0], fromPos[2], toPos[0], toPos[2]]);

  useFrame((_, delta) => {
    if (!isActive) return;
    const speed = 0.25 + line.loadRatio * 0.55;
    const dir = line.powerFlowDirection ?? 1;
    if (dir === 0) return;
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
      mesh.position.y += 0.1;
    });
  });

  // Ring tie: dashed appearance using segments
  const ringTieOpacity = isRingTie ? (line.currentFlow > 0.1 ? 0.9 : 0.3) : 1.0;

  return (
    <group>
      {/* Towers / poles */}
      {towerData.map((t, i) =>
        vLevel === 'dist'
          ? <WoodenPole key={i} position={t.position} rotation={t.rotation} />
          : <PowerlineTower key={i} position={t.position} rotation={t.rotation} scale={cfg.towerScale} />
      )}

      {/* Wire */}
      <mesh>
        <tubeGeometry args={[curve, 48, cfg.tubeRadius, 6, false]} />
        <meshStandardMaterial
          color={cfg.wireColor}
          metalness={0.5}
          roughness={0.4}
          transparent={isRingTie}
          opacity={ringTieOpacity}
        />
      </mesh>

      {/* Ring tie marker (dashed arc overlay) */}
      {isRingTie && (
        <mesh>
          <tubeGeometry args={[curve, 48, cfg.tubeRadius * 1.6, 6, false]} />
          <meshStandardMaterial
            color={line.currentFlow > 0.1 ? '#22C55E' : '#94A3B8'}
            transparent opacity={0.35}
            wireframe
          />
        </mesh>
      )}

      {/* Energy flow particles */}
      {isActive && Array.from({ length: cfg.particleCount }).map((_, i) => (
        <mesh key={i} ref={el => { particlesRef.current[i] = el; }}>
          <sphereGeometry args={[cfg.particleSize, 6, 6]} />
          <meshStandardMaterial
            color={lineColor}
            emissive={lineColor}
            emissiveIntensity={line.status === 'failed' ? 2.5 : 1.5}
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload('/models/powerline.glb');
useGLTF.preload('/models/Wooden Utility pole.glb');
