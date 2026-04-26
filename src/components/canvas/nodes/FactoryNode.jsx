import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useGLTF, Center, Resize } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

const STATUS_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};


function FactoryModel({ node }) {
  const { scene } = useGLTF('/models/factory.glb');
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
          child.material.emissiveIntensity = 0.25;
        }
      }
    });
  }, [clonedScene, node.status, color]);

  useFrame(({ clock }) => {
    if (smokeRef.current) {
      smokeRef.current.position.y = 3.5 + Math.sin(clock.getElapsedTime() * 2) * 0.1;
      smokeRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <group>
      <Center bottom>
        <Resize scale={3.5}>
          <primitive object={clonedScene} />
        </Resize>
      </Center>
      <group ref={smokeRef} position={[0, 3.5, -0.5]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[(i - 0.5) * 1.2, 0, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#9CA3AF" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 3.2, 0.8]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color={color} intensity={node.status === 'failed' ? 4 : 2} distance={8} />
    </group>
  );
}

export default function FactoryNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();
  const appearRef = useRef({ scale: 0 });

  useFrame((_, delta) => {
    if (appearRef.current.scale < 1) {
      appearRef.current.scale = Math.min(1, appearRef.current.scale + delta * 3);
      if (groupRef.current) groupRef.current.scale.setScalar(appearRef.current.scale);
    }
  });

  return (
    <group
      position={node.position}
      ref={groupRef}
      scale={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}
    >
      <FactoryModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.0, 2.3, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 4.5, 0]}>
        <Text fontSize={0.33} color="#1E293B" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.26} color="#EF4444" anchorX="center" anchorY="middle" position={[0, -0.43, 0]}>
          {`⚡ ${node.industrialLoad} MW  PF: ${node.powerFactor}`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/factory.glb');
