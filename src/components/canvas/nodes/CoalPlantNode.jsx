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
      smokeRef.current.position.y = 5.0 + Math.sin(t * 1.8) * 0.15;
      smokeRef.current.rotation.y = t * 0.4;
      // Scale smoke with load
      const loadFraction = node.active_power_mw / (node.maxCapacity || 220);
      smokeRef.current.scale.setScalar(0.6 + loadFraction * 0.6);
    }
  });

  return (
    <group>
      <Resize scale={9.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Smoke plume */}
      <group ref={smokeRef} position={[0, 5.0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.8, i * 0.3, 0]}>
            <sphereGeometry args={[0.3 + i * 0.1, 8, 8]} />
            <meshStandardMaterial color="#6B7280" transparent opacity={0.4 - i * 0.1} />
          </mesh>
        ))}
      </group>
      {/* Status beacon */}
      <mesh position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 3.0, 0]} color={color} intensity={node.status === 'failed' ? 4 : 1.5} distance={10} />
    </group>
  );
}

export default function CoalPlantNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.status === 'stressed' && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.03;
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
          <ringGeometry args={[3.2, 3.6, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 11.5, 0]}>
        <Text fontSize={0.38} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.28} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.50, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L1 — Bulk Generation
        </Text>
        <Text fontSize={0.30} color={rpmColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.95, 0]} outlineWidth={0.02} outlineColor="white">
          {`${node.generator_rpm?.toFixed(0)} RPM | ${node.active_power_mw?.toFixed(1)} MW`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/coal plant.glb');
