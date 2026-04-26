import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

// Model raw size: 1.56 x 4.56 x 3.79, bounds Y=[0.04, 4.59] — already small, scale ~0.6
const MODEL_SCALE = 0.6;

function CapacitorModel() {
  const { scene } = useGLTF('/models/capacitor_bank.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const ringRef = useRef();

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color('#0EA5E9');
          child.material.emissiveIntensity = 0.4;
        }
      }
    });
  }, [clonedScene]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = clock.getElapsedTime() * 0.8;
    }
  });

  return (
    <group>
      {/* Bounds Y starts near 0, no offset needed */}
      <primitive object={clonedScene} scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]} position={[0, 0, 0]} />
      <group ref={ringRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.8, 0]}>
          <torusGeometry args={[1.2, 0.04, 8, 32]} />
          <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={1.5} transparent opacity={0.9} />
        </mesh>
      </group>
      <mesh position={[0, 3.0, 0]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={2.5} transparent opacity={0.95} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color="#38BDF8" intensity={3} distance={8} />
    </group>
  );
}

export default function CapacitorNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();
  const scaleRef = useRef({ t: 0 });

  useFrame((_, delta) => {
    if (scaleRef.current.t < 1) {
      scaleRef.current.t = Math.min(1, scaleRef.current.t + delta * 2.5);
      const s = scaleRef.current.t < 0.85
        ? scaleRef.current.t / 0.85
        : 1 + Math.sin((scaleRef.current.t - 0.85) / 0.15 * Math.PI) * 0.15;
      if (groupRef.current) groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group
      position={node.position}
      ref={groupRef}
      scale={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}
    >
      <CapacitorModel />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.8, 2.1, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 4.0, 0]}>
        <Text fontSize={0.28} color="#1E293B" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.22} color="#0EA5E9" anchorX="center" anchorY="middle" position={[0, -0.38, 0]}>
          {`+${node.reactivePowerSupport} MVAR`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/capacitor_bank.glb');
