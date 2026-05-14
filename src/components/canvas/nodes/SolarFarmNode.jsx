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

function SolarModel({ node }) {
  const { scene } = useGLTF('/models/solar_panels.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const materialsRef = useRef([]);
  const solarFraction = node.maxSolarOutput > 0 ? (node.solarOutput ?? 0) / node.maxSolarOutput : 0;

  useEffect(() => {
    const mats = [];
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
            // Solar panel frames and photovoltaic cells
            child.material.color = new THREE.Color('#0F172A'); // Deep sleek solar slate/blue
            child.material.roughness = 0.2;
            child.material.metalness = 0.85; // High gloss/reflection
            child.material.emissive = new THREE.Color('#3B82F6');
            child.material.emissiveIntensity = 0.05 + solarFraction * 0.25;
            mats.push(child.material);
          }
        }
      }
    });
    materialsRef.current = mats;
  }, [clonedScene, solarFraction]);

  useFrame(({ clock }) => {
    materialsRef.current.forEach((mat, i) => {
      mat.emissiveIntensity = 0.05 + (solarFraction * 0.2) + Math.sin(clock.getElapsedTime() * 1.5 + i * 0.4) * 0.05 * solarFraction;
    });
  });

  return (
    <group>
      <Resize scale={10.0}>
        <primitive object={clonedScene} />
      </Resize>
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.24, 10, 10]} />
        <meshStandardMaterial
          color={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'}
          emissive={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'}
          emissiveIntensity={solarFraction * 2}
        />
      </mesh>
      <pointLight position={[0, 3.5, 0]} color={solarFraction > 0.1 ? '#FBBF24' : '#94A3B8'} intensity={solarFraction * 2.5} distance={12} />
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

  const solarFraction = node.maxSolarOutput > 0 ? (node.solarOutput ?? 0) / node.maxSolarOutput : 0;

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <SolarModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[3.4, 3.8, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 5.2, 0]}>
        <Text fontSize={0.43} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.33} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.59, 0]} outlineWidth={0.02} outlineColor="white">
          ☀ L1 — Renewable Generation
        </Text>
        <Text fontSize={0.35} color="#d97706" fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.14, 0]} outlineWidth={0.02} outlineColor="white">
          {`${node.solarOutput?.toFixed(1)} / ${node.maxSolarOutput} MW (${(solarFraction * 100).toFixed(0)}%)`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/solar_panels.glb');
