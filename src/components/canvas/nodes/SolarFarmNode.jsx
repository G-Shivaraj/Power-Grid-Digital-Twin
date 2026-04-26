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


// ── GLB solar panels model ───────────────────────────────────────────────────
function SolarModel({ node }) {
  const { scene } = useGLTF('/models/solar_panels.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef();
  const materialsRef = useRef([]);
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;
  const solarFraction = node.solarOutput > 0 ? node.solarOutput / node.maxSolarOutput : 0;

  useEffect(() => {
    const mats = [];
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color('#3b82f6');
          child.material.emissiveIntensity = 0.15 + solarFraction * 0.4;
          mats.push(child.material);
        }
      }
    });
    materialsRef.current = mats;
  }, [clonedScene, solarFraction]);

  // Subtle shimmer effect on materials
  useFrame(({ clock }) => {
    materialsRef.current.forEach((mat, i) => {
      mat.emissiveIntensity = 0.15 + Math.sin(clock.getElapsedTime() * 1.5 + i * 0.4) * 0.08 * solarFraction;
    });
  });

  return (
    <group ref={groupRef}>
      <Resize scale={8.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Output indicator */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial
          color={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'}
          emissive={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'}
          emissiveIntensity={solarFraction * 2}
        />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'} intensity={solarFraction * 2} distance={6} />
    </group>
  );
}

export default function SolarFarmNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.status === 'failed' && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.07;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      position={node.position}
      ref={groupRef}
      onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}
    >
      <SolarModel node={node} />

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.8, 3.1, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}

      <Billboard position={[0, 4.5, 0]}>
        <Text fontSize={0.32} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.26} color="#d97706" fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.42, 0]} outlineWidth={0.02} outlineColor="white">
          {`☀ ${node.solarOutput?.toFixed(1)} / ${node.maxSolarOutput} MW`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/solar_panels.glb');
