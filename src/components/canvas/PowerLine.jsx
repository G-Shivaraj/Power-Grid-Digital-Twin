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
  hv:   { tubeRadius: 0.035, towerScale: 4.5, wireElevation: 4.2, particleSize: 0.11, particleCount: 8, wireColor: '#000000' },
  sub:  { tubeRadius: 0.022, towerScale: 3.2, wireElevation: 2.9, particleSize: 0.09, particleCount: 7, wireColor: '#000000' },
  dist: { tubeRadius: 0.015, towerScale: 2.2, wireElevation: 2.0, particleSize: 0.07, particleCount: 5, wireColor: '#000000' },
  lv:   { tubeRadius: 0.010, towerScale: 0,   wireElevation: 1.2, particleSize: 0.055,particleCount: 4, wireColor: '#000000' },
};

// Exclusion radius per component type — towers/poles must not be placed within
// this distance (xz-plane) of any node center
const EXCLUSION_RADIUS = 8;

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

/**
 * Check if a 2D point (xz-plane) falls inside any node's exclusion zone.
 * Returns true if it's too close.
 */
function isInsideExclusionZone(x, z, nodePositions) {
  for (const pos of nodePositions) {
    const dx = x - pos[0];
    const dz = z - pos[2];
    const distSq = dx * dx + dz * dz;
    if (distSq < EXCLUSION_RADIUS * EXCLUSION_RADIUS) return true;
  }
  return false;
}

export default function PowerLine({ line, fromPos, toPos, nodePositions = [] }) {
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
    const startFlat = new THREE.Vector3(...fromPos);
    const endFlat   = new THREE.Vector3(...toPos);
    startFlat.y = 0; endFlat.y = 0;
    
    // v0: Start connection point dipping downwards to touch the source entity directly
    const v0 = new THREE.Vector3(startFlat.x, 0.6, startFlat.z);
    
    // v1: First control point rises smoothly to the utility pole crossarm elevation
    const v1 = startFlat.clone().lerp(endFlat, 0.2);
    v1.y = cfg.wireElevation + (isRingTie ? 0.2 : 0);
    
    // v2: Second control point maintains crossarm elevation across the entire middle span
    const v2 = startFlat.clone().lerp(endFlat, 0.8);
    v2.y = cfg.wireElevation + (isRingTie ? 0.2 : 0);
    
    // v3: End connection point dipping downwards to touch destination entity directly
    const v3 = new THREE.Vector3(endFlat.x, 0.6, endFlat.z);
    
    return new THREE.CubicBezierCurve3(v0, v1, v2, v3);
  }, [fromPos[0], fromPos[2], toPos[0], toPos[2], cfg.wireElevation, isRingTie]);

  const towerData = useMemo(() => {
    if (cfg.towerScale === 0) return []; // LV lines have no towers
    const from = new THREE.Vector3(...fromPos);
    const to   = new THREE.Vector3(...toPos);
    const dir  = new THREE.Vector3().subVectors(to, from);
    const rotation = Math.atan2(dir.x, dir.z);
    const dist = dir.length();
    if (dist < 4) return [];
    const fractions = dist > 14 ? [0.25, 0.5, 0.75] : [0.4, 0.6];

    // Build candidate positions, then filter/shift away from exclusion zones
    const candidates = fractions.map(f => {
      const p = from.clone().lerp(to, f);
      return { position: [p.x, 0, p.z], rotation, fraction: f };
    });

    // Filter out any tower that falls inside an exclusion zone
    const filtered = candidates.filter(c =>
      !isInsideExclusionZone(c.position[0], c.position[2], nodePositions)
    );

    return filtered;
  }, [fromPos[0], fromPos[2], toPos[0], toPos[2], nodePositions]);

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

