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


// ── GLB houses model ─────────────────────────────────────────────────────────
function HousesModel({ node }) {
  const { scene } = useGLTF('/models/houses.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;
  const isFailed = node.status === 'failed';

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = isFailed ? new THREE.Color('#1a0000') : color;
          child.material.emissiveIntensity = isFailed ? 0.05 : 0.15;
        }
      }
    });
  }, [clonedScene, node.status, color, isFailed]);

  return (
    <group>
      <Resize scale={7.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Street lamp */}
      <mesh position={[1.0, 0.5, 0.8]}>
        <cylinderGeometry args={[0.02, 0.02, 1.0, 6]} />
        <meshStandardMaterial color="#6B7280" />
      </mesh>
      <mesh position={[1.0, 1.0, 0.8]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          color={isFailed ? '#374151' : '#FEF3C7'}
          emissive={isFailed ? '#000000' : '#FBBF24'}
          emissiveIntensity={isFailed ? 0 : 1.5}
        />
      </mesh>
      {/* Status glow */}
      <pointLight position={[0, 1.5, 0]} color={color} intensity={isFailed ? 0.5 : 1.2} distance={4} />
    </group>
  );
}

export default function ResidentialNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.status === 'failed' && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.06;
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
      <HousesModel node={node} />

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.5, 1.8, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}

      <Billboard position={[0, 3.5, 0]}>
        <Text fontSize={0.30} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.25} color={node.status === 'failed' ? '#b91c1c' : '#15803d'} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.40, 0]} outlineWidth={0.02} outlineColor="white">
          {node.status === 'failed' ? '⚠ BLACKOUT' : `${(node.voltage * 100).toFixed(1)}% | ${node.baseDemand} MW`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/houses.glb');
