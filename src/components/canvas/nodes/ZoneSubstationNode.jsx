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

const BREAKER_COLORS = {
  CLOSED: new THREE.Color('#22C55E'),
  OPEN: new THREE.Color('#6B7280'),
  TRIPPED: new THREE.Color('#EF4444'),
};

function ZoneSubModel({ node }) {
  const { scene } = useGLTF('/models/hv_substation.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const breakerColor = BREAKER_COLORS[node.feeder_breaker_status] || BREAKER_COLORS.CLOSED;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          const name = child.name.toLowerCase();

          // Apply lovely high-contrast industrial materials for superb visual fidelity
          if (name.includes('ground') || name.includes('pad') || name.includes('base') || name.includes('plane') || name.includes('floor')) {
            child.material.color = new THREE.Color('#64748B'); // Slate concrete pad
            child.material.roughness = 0.9;
            child.material.metalness = 0.1;
            child.material.emissive = new THREE.Color('#000000');
          } else if (name.includes('fence') || name.includes('wire') || name.includes('gate') || name.includes('wall')) {
            child.material.color = new THREE.Color('#94A3B8'); // Galvanized steel fence
            child.material.roughness = 0.4;
            child.material.metalness = 0.8;
            child.material.emissive = new THREE.Color('#000000');
          } else {
            // Zone transformers and switching structures
            child.material.color = new THREE.Color('#334155'); // Deep slate industrial metal
            child.material.roughness = 0.3;
            child.material.metalness = 0.75;
            child.material.emissive = breakerColor;
            child.material.emissiveIntensity = 0.05;
          }
        }
      }
    });
  }, [clonedScene, node.feeder_breaker_status, breakerColor]);

  return (
    <group>
      <Resize scale={10.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Feeder breaker status indicator */}
      <mesh position={[0, 6.8, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color={breakerColor} emissive={breakerColor} emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 5.8, 0]} color={breakerColor} intensity={1.5} distance={12} />
    </group>
  );
}

export default function ZoneSubstationNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.feeder_breaker_status === 'TRIPPED' && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.05;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const breakerLabelColor = node.feeder_breaker_status === 'CLOSED'
    ? '#15803d' : node.feeder_breaker_status === 'TRIPPED' ? '#b91c1c' : '#6B7280';
  const imbalanceColor = node.phase_imbalance_percent > 3 ? '#b91c1c' : node.phase_imbalance_percent > 1.5 ? '#d97706' : '#15803d';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <ZoneSubModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[3.8, 4.2, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 14.0, 0]}>
        <Text fontSize={0.34} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.26} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.46, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L3 — Zone Sub (33kV/11kV)
        </Text>
        <Text fontSize={0.28} color={breakerLabelColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.88, 0]} outlineWidth={0.02} outlineColor="white">
          {`Breaker: ${node.feeder_breaker_status}`}
        </Text>
        <Text fontSize={0.25} color={imbalanceColor} anchorX="center" anchorY="middle" position={[0, -1.28, 0]} outlineWidth={0.02} outlineColor="white">
          {`ΔΦ: ${node.phase_imbalance_percent?.toFixed(2)}%  V:${(node.voltage * 100).toFixed(1)}%`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/hv_substation.glb');
