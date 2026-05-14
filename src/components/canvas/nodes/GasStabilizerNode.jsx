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

function GasStabilizerModel({ node }) {
  const { scene } = useGLTF('/models/gas_stabilizer_plant.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const glowRef = useRef();
  const isStandby = node.isStandby;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          const name = child.name.toLowerCase();

          if (name.includes('ground') || name.includes('pad') || name.includes('base')) {
            child.material.color = new THREE.Color('#64748B');
            child.material.roughness = 0.9;
            child.material.metalness = 0.1;
            child.material.emissive = new THREE.Color('#000000');
          } else {
            // Metallic turbines, piping, exhaust structures
            child.material.color = new THREE.Color('#334155');
            child.material.roughness = 0.3;
            child.material.metalness = 0.75;
            child.material.emissive = isStandby ? new THREE.Color('#374151') : new THREE.Color('#F97316');
            child.material.emissiveIntensity = isStandby ? 0.02 : 0.25;
          }
        }
      }
    });
  }, [clonedScene, isStandby]);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const t = clock.getElapsedTime();
      // Pulse faster when active
      const freq = isStandby ? 0.8 : 3.0;
      glowRef.current.material.emissiveIntensity = isStandby
        ? 0.3 + Math.sin(t * freq) * 0.1
        : 1.5 + Math.sin(t * freq) * 0.5;
    }
  });

  const beaconColor = isStandby ? new THREE.Color('#6B7280') : new THREE.Color('#F97316');

  return (
    <group>
      <Resize scale={11.0}>
        <primitive object={clonedScene} />
      </Resize>
      <mesh position={[0, 4.8, 0]} ref={glowRef}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color={beaconColor} emissive={beaconColor} emissiveIntensity={isStandby ? 0.4 : 2.0} />
      </mesh>
      <pointLight
        position={[0, 3.8, 0]}
        color={isStandby ? '#6B7280' : '#F97316'}
        intensity={isStandby ? 0.5 : 3.0}
        distance={14}
      />
    </group>
  );
}

export default function GasStabilizerNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!node.isStandby && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.02;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const labelColor = node.isStandby ? '#6B7280' : '#F97316';
  const statusText = node.isStandby
    ? `⏸ STANDBY | ${node.spinning_reserve_mw} MW Reserve`
    : `▶ ACTIVE | ${node.active_power_mw?.toFixed(1)} MW`;

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <GasStabilizerModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[3.8, 4.2, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 8.8, 0]}>
        <Text fontSize={0.47} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.35} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.62, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L1 — Spinning Reserve
        </Text>
        <Text fontSize={0.39} color={labelColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.20, 0]} outlineWidth={0.02} outlineColor="white">
          {statusText}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/gas_stabilizer_plant.glb');
