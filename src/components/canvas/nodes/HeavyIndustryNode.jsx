import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useGLTF, Resize } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

const STATUS_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};

function HeavyIndustryModel({ node }) {
  const { scene } = useGLTF('/models/factory.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const smokeRef = useRef();
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;
  const isSurge = node.surgeModeActive;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = isSurge ? new THREE.Color('#EF4444') : color;
          child.material.emissiveIntensity = isSurge ? 0.5 : 0.22;
        }
      }
    });
  }, [clonedScene, node.status, isSurge, color]);

  useFrame(({ clock }) => {
    if (smokeRef.current) {
      const t = clock.getElapsedTime();
      smokeRef.current.position.y = 4.0 + Math.sin(t * 2.2) * 0.12;
      smokeRef.current.rotation.y = t * 0.35;
      // Heavier smoke during surge
      smokeRef.current.scale.setScalar(isSurge ? 1.6 : 1.0);
    }
  });

  // Power factor visual: cos(θ) angle arc
  const pfAngle = Math.acos(Math.max(0.1, node.power_factor_ratio));
  const pfColor = node.power_factor_ratio < 0.8
    ? new THREE.Color('#EF4444')
    : node.power_factor_ratio < 0.9
      ? new THREE.Color('#F59E0B')
      : new THREE.Color('#22C55E');

  return (
    <group>
      <Resize scale={10.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Smoke stacks */}
      <group ref={smokeRef} position={[0, 4.8, -0.5]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[(i - 0.5) * 1.4, i * 0.2, 0]}>
            <sphereGeometry args={[0.32 + i * 0.08, 8, 8]} />
            <meshStandardMaterial color="#4B5563" transparent opacity={isSurge ? 0.7 : 0.35} />
          </mesh>
        ))}
      </group>
      {/* Power factor arc indicator */}
      <mesh position={[2.2, 1.8, 0]} rotation={[Math.PI / 2, 0, -pfAngle]}>
        <torusGeometry args={[0.45, 0.07, 6, 20, pfAngle]} />
        <meshStandardMaterial color={pfColor} emissive={pfColor} emissiveIntensity={2.0} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color={isSurge ? new THREE.Color('#EF4444') : color} emissive={isSurge ? new THREE.Color('#EF4444') : color} emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 3.2, 0]} color={isSurge ? '#EF4444' : color} intensity={isSurge ? 5 : 2} distance={12} />
    </group>
  );
}

export default function HeavyIndustryNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.surgeModeActive && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.04;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const pfColor = node.power_factor_ratio < 0.8 ? '#b91c1c' : node.power_factor_ratio < 0.9 ? '#d97706' : '#15803d';
  const loadMW = (node.heavy_machinery_load_kw / 1000).toFixed(1);
  const surgeLabel = node.surgeModeActive ? ' ⚡ SURGE' : '';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <HeavyIndustryModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[3.4, 3.8, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 8.2, 0]}>
        <Text fontSize={0.44} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}{surgeLabel}
        </Text>
        <Text fontSize={0.33} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.60, 0]} outlineWidth={0.02} outlineColor="white">
          🏭 L2 — Heavy Industry (33kV direct)
        </Text>
        <Text fontSize={0.36} color="#b91c1c" fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.14, 0]} outlineWidth={0.02} outlineColor="white">
          {`${loadMW} MW  (${node.heavy_machinery_load_kw?.toLocaleString()} kW)`}
        </Text>
        <Text fontSize={0.33} color={pfColor} anchorX="center" anchorY="middle" position={[0, -1.64, 0]} outlineWidth={0.02} outlineColor="white">
          {`cos(θ) = ${node.power_factor_ratio?.toFixed(3)}`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/factory.glb');
