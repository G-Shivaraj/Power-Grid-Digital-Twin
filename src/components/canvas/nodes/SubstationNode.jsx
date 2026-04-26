import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useGLTF, Resize } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

// Status → emissive color map
const STATUS_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};
const STATUS_INTENSITY = { optimal: 0.4, stressed: 0.8, failed: 1.2 };


// ── GLB model substation ─────────────────────────────────────────────────────
function SubstationModel({ status }) {
  const { scene } = useGLTF('/models/substation.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef();
  const color = STATUS_COLORS[status] || STATUS_COLORS.optimal;
  const intensity = STATUS_INTENSITY[status] || 0.4;

  // Apply emissive coloring to all meshes in the model
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = color;
          child.material.emissiveIntensity = intensity * 0.3;
        }
      }
    });
  }, [clonedScene, status, color, intensity]);

  useFrame((_, delta) => {
    if (status === 'failed' && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <Resize scale={8.0}>
        <primitive object={clonedScene} rotation={[0, 0, 0]} />
      </Resize>
      
      {/* Substation Boundary Fence */}
      <group position={[0, 0, 0]}>
        {/* Front */}
        <mesh position={[0, 0.4, 4.0]} receiveShadow castShadow>
          <boxGeometry args={[8.2, 0.8, 0.1, 32, 4, 1]} />
          <meshStandardMaterial color="#111827" roughness={0.9} wireframe={true} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0.4, -4.0]} receiveShadow castShadow>
          <boxGeometry args={[8.2, 0.8, 0.1, 32, 4, 1]} />
          <meshStandardMaterial color="#111827" roughness={0.9} wireframe={true} />
        </mesh>
        {/* Right */}
        <mesh position={[4.0, 0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.1, 0.8, 8.0, 1, 4, 32]} />
          <meshStandardMaterial color="#111827" roughness={0.9} wireframe={true} />
        </mesh>
        {/* Left */}
        <mesh position={[-4.0, 0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.1, 0.8, 8.0, 1, 4, 32]} />
          <meshStandardMaterial color="#111827" roughness={0.9} wireframe={true} />
        </mesh>
      </group>
      {/* Status beacon */}
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      {/* Point light glow */}
      <pointLight position={[0, 2.0, 0]} color={color} intensity={status === 'failed' ? 3 : 1} distance={8} />
    </group>
  );
}

// ── SubstationNode ───────────────────────────────────────────────────────────
export default function SubstationNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const meshRef = useRef();

  // Alarm pulse
  useFrame(({ clock }) => {
    if (node.status === 'failed' && meshRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.08;
      meshRef.current.scale.setScalar(s);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      position={node.position}
      ref={meshRef}
      onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}
    >
      <SubstationModel status={node.status} />

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.0, 2.3, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Label */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false} position={[0, 9.0, 0]}>
        <Text fontSize={0.35} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.28} color={node.voltage >= 0.95 ? '#15803d' : '#b91c1c'} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.45, 0]} outlineWidth={0.02} outlineColor="white">
          {`${(node.voltage * 100).toFixed(1)}% | ${node.activePower?.toFixed(1)} MW`}
        </Text>
      </Billboard>
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/substation.glb');
