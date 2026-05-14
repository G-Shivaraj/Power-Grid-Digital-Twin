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

function CoalPlantModel({ node }) {
  const { scene } = useGLTF('/models/coal plant.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const smokeRef = useRef();
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = color;
          child.material.emissiveIntensity = 0.2;
        }
      }
    });
  }, [clonedScene, node.status, color]);

  // Animate smoke based on RPM
  useFrame(({ clock }) => {
    if (smokeRef.current) {
      const t = clock.getElapsedTime();
      smokeRef.current.position.y = 6.8 + Math.sin(t * 1.8) * 0.15;
      smokeRef.current.rotation.y = t * 0.4;
      // Scale smoke with load
      const loadFraction = node.active_power_mw / (node.maxCapacity || 220);
      smokeRef.current.scale.setScalar(0.8 + loadFraction * 0.8);
    }
  });

  return (
    <group>
      <Resize scale={12.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Smoke plume */}
      <group ref={smokeRef} position={[0, 6.8, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.8, i * 0.3, 0]}>
            <sphereGeometry args={[0.35 + i * 0.12, 8, 8]} />
            <meshStandardMaterial color="#6B7280" transparent opacity={0.4 - i * 0.1} />
          </mesh>
        ))}
      </group>
      {/* Status beacon */}
      <mesh position={[0, 5.5, 0]}>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 4.0, 0]} color={color} intensity={node.status === 'failed' ? 4 : 1.5} distance={12} />
    </group>
  );
}

export default function CoalPlantNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.status === 'failed' && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.05;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const rpmColor = node.generator_rpm >= 2990 && node.generator_rpm <= 3010 ? '#22C55E' : '#F59E0B';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <CoalPlantModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[4.2, 4.6, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 9.8, 0]}>
        <Text fontSize={0.49} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.36} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.65, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L1 — Bulk Generation
        </Text>
        <Text fontSize={0.39} color={rpmColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.24, 0]} outlineWidth={0.02} outlineColor="white">
          {`${node.generator_rpm?.toFixed(0)} RPM | ${node.active_power_mw?.toFixed(1)} MW`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/coal plant.glb');
