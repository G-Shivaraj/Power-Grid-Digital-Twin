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

function DistTransformerModel({ node }) {
  const { scene } = useGLTF('/models/substation.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const saturation = node.load_saturation_percent ?? 55;
  const isOverloaded = saturation > 100;
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = isOverloaded ? new THREE.Color('#F59E0B') : color;
          child.material.emissiveIntensity = isOverloaded ? 0.45 : 0.15;
        }
      }
    });
  }, [clonedScene, node.status, isOverloaded, color]);

  // Heat shimmer when overloaded
  const heatRef = useRef();
  useFrame(({ clock }) => {
    if (heatRef.current && isOverloaded) {
      const t = clock.getElapsedTime();
      heatRef.current.scale.setScalar(1 + Math.abs(Math.sin(t * 3.5)) * 0.12);
      heatRef.current.material.opacity = 0.15 + Math.abs(Math.sin(t * 2)) * 0.15;
    } else if (heatRef.current) {
      heatRef.current.scale.setScalar(1);
    }
  });

  // Saturation bar segments (3D)
  const satFraction = Math.min(1.5, saturation / 100);
  const barColor = saturation > 100 ? '#EF4444' : saturation > 80 ? '#F59E0B' : '#22C55E';

  return (
    <group>
      <Resize scale={5.4}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Load saturation bar (vertical strip) */}
      <mesh position={[1.1, satFraction * 0.5, 0]}>
        <boxGeometry args={[0.15, Math.min(1.6, satFraction * 1.2), 0.15]} />
        <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={1.5} />
      </mesh>
      {/* Heat halo (overload warning) */}
      <mesh position={[0, 1.5, 0]} ref={heatRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.8, 32]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Status beacon */}
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 2.0, 0]} color={color} intensity={isOverloaded ? 3 : 1} distance={10} />
    </group>
  );
}

export default function DistTransformerNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.load_saturation_percent > 100 && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.04;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const satColor = node.load_saturation_percent > 100 ? '#b91c1c'
    : node.load_saturation_percent > 80 ? '#d97706' : '#15803d';
  const lifespanYears = (node.estimated_lifespan_remaining_days / 365).toFixed(1);
  const lifespanColor = node.estimated_lifespan_remaining_days < 365 ? '#b91c1c'
    : node.estimated_lifespan_remaining_days < 1095 ? '#d97706' : '#15803d';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <DistTransformerModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.6, 1.9, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 6.5, 0]}>
        <Text fontSize={0.42} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.31} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.57, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L4 — Dist. Transformer (11kV/400V)
        </Text>
        <Text fontSize={0.35} color={satColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.12, 0]} outlineWidth={0.02} outlineColor="white">
          {`Load: ${node.load_saturation_percent?.toFixed(1)}%  T: ${node.ambient_temp_celsius?.toFixed(1)}°C`}
        </Text>
        <Text fontSize={0.33} color={lifespanColor} anchorX="center" anchorY="middle" position={[0, -1.61, 0]} outlineWidth={0.02} outlineColor="white">
          {`Lifespan: ${lifespanYears}yr remaining`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/substation.glb');
