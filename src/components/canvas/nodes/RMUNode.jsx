import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useGLTF, Resize, Center } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

const STATUS_COLORS = {
  optimal: new THREE.Color('#22C55E'),
  stressed: new THREE.Color('#F59E0B'),
  failed: new THREE.Color('#EF4444'),
};

function RMUModel({ node }) {
  const { scene } = useGLTF('/models/ring_main_unit.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const sparkRef = useRef();
  const isIsolated = node.isolation_switch_state;
  const isFaultHigh = node.fault_current_detected_amps > 1500;
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = isIsolated ? new THREE.Color('#EF4444') : color;
          child.material.emissiveIntensity = isIsolated ? 0.4 : 0.15;
        }
      }
    });
  }, [clonedScene, isIsolated, color]);

  // Spark effect on fault detection
  useFrame(({ clock }) => {
    if (sparkRef.current) {
      if (isFaultHigh) {
        const t = clock.getElapsedTime();
        sparkRef.current.visible = Math.sin(t * 25) > 0.3;
        sparkRef.current.rotation.z = t * 8;
        sparkRef.current.scale.setScalar(0.5 + Math.abs(Math.sin(t * 20)) * 1.5);
      } else {
        sparkRef.current.visible = false;
      }
    }
  });

  const switchColor = isIsolated ? new THREE.Color('#EF4444') : new THREE.Color('#22C55E');

  return (
    <group>
      <Resize scale={7.0}>
        <Center disableY>
          <primitive object={clonedScene} />
        </Center>
      </Resize>
      {/* Isolation switch indicator */}
      <mesh position={[0, 4.0, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.1]} />
        <meshStandardMaterial
          color={switchColor}
          emissive={switchColor}
          emissiveIntensity={2.0}
          rotation={isIsolated ? [0, 0, Math.PI / 4] : [0, 0, 0]}
        />
      </mesh>
      {/* Fault spark */}
      <mesh position={[0, 5.0, 0]} ref={sparkRef} visible={false}>
        <torusGeometry args={[0.25, 0.08, 6, 12]} />
        <meshStandardMaterial color="#FCD34D" emissive="#FCD34D" emissiveIntensity={4.0} />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.20, 10, 10]} />
        <meshStandardMaterial color={switchColor} emissive={switchColor} emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 2.8, 0]} color={isIsolated ? '#EF4444' : '#22C55E'} intensity={isFaultHigh ? 4 : 1} distance={10} />
    </group>
  );
}

export default function RMUNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.isolation_switch_state && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 7) * 0.06;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const faultColor = node.fault_current_detected_amps > 1500 ? '#b91c1c' : '#15803d';
  const switchText = node.isolation_switch_state ? '🔴 ISOLATED' : '🟢 CLOSED';
  const latColor = node.telemetry_latency_ms > 50 ? '#d97706' : '#15803d';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <RMUModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.5, 2.8, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 5.8, 0]}>
        <Text fontSize={0.42} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.31} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.57, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L3 — Ring Main Unit
        </Text>
        <Text fontSize={0.35} color={faultColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.09, 0]} outlineWidth={0.02} outlineColor="white">
          {`${node.fault_current_detected_amps?.toFixed(0)} A`}
        </Text>
        <Text fontSize={0.31} color={latColor} anchorX="center" anchorY="middle" position={[0, -1.56, 0]} outlineWidth={0.02} outlineColor="white">
          {`${switchText}  Lat:${node.telemetry_latency_ms?.toFixed(1)}ms`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/ring_main_unit.glb');
