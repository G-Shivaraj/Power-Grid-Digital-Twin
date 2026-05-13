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

function SmartMeterModel({ node }) {
  const { scene } = useGLTF('/models/houses.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const evIndicatorRef = useRef();
  const solarArrowRef = useRef();
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;
  const isExporting = node.net_metering_kw < 0;
  const hasEV = node.ev_charging_draw_kw > 100;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = isExporting ? new THREE.Color('#FCD34D') : color;
          child.material.emissiveIntensity = isExporting ? 0.25 : 0.12;
        }
      }
    });
  }, [clonedScene, node.status, isExporting, color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // EV charging pulse (teal)
    if (evIndicatorRef.current) {
      evIndicatorRef.current.visible = hasEV;
      if (hasEV) {
        evIndicatorRef.current.material.emissiveIntensity = 1.0 + Math.sin(t * 4) * 0.6;
        evIndicatorRef.current.position.y = 1.8 + Math.sin(t * 2) * 0.08;
      }
    }
    // Net metering arrow (up=exporting, down=consuming)
    if (solarArrowRef.current) {
      solarArrowRef.current.position.y = isExporting
        ? 2.5 + Math.sin(t * 2) * 0.12
        : 2.1 - Math.abs(Math.sin(t * 1.5)) * 0.08;
      solarArrowRef.current.rotation.y = t * 0.5;
    }
  });

  const netArrowColor = isExporting ? new THREE.Color('#FCD34D') : new THREE.Color('#60A5FA');

  return (
    <group>
      <Resize scale={7.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Net metering arrow */}
      <mesh position={[0, 2.5, 0]} ref={solarArrowRef} rotation={isExporting ? [0, 0, 0] : [Math.PI, 0, 0]}>
        <coneGeometry args={[0.18, 0.45, 6]} />
        <meshStandardMaterial color={netArrowColor} emissive={netArrowColor} emissiveIntensity={2.0} />
      </mesh>
      {/* EV charging indicator (teal lightning bolt sphere) */}
      <mesh position={[-1.0, 1.8, 0.5]} ref={evIndicatorRef} visible={false}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={1.5} />
      </mesh>
      {/* Status glow */}
      <mesh position={[0, 3.2, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 2.0, 0]} color={isExporting ? '#FCD34D' : color} intensity={1.2} distance={6} />
    </group>
  );
}

export default function SmartMeterNode({ node }) {
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

  const isExporting = node.net_metering_kw < 0;
  const netKW = Math.abs(node.net_metering_kw ?? 0);
  const netLabel = isExporting ? `↑ ${netKW.toFixed(0)} kW export` : `↓ ${netKW.toFixed(0)} kW consume`;
  const netColor = isExporting ? '#d97706' : '#1d4ed8';
  const evColor = node.ev_charging_draw_kw > 100 ? '#0891b2' : '#6B7280';
  const harmonicColor = node.harmonic_distortion_percent > 5 ? '#b91c1c' : node.harmonic_distortion_percent > 3 ? '#d97706' : '#15803d';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <SmartMeterModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.0, 2.3, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 8.0, 0]}>
        <Text fontSize={0.31} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.23} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.43, 0]} outlineWidth={0.02} outlineColor="white">
          ⚡ L4 — Smart Meter (Prosumer)
        </Text>
        <Text fontSize={0.26} color={netColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.83, 0]} outlineWidth={0.02} outlineColor="white">
          {netLabel}
        </Text>
        <Text fontSize={0.23} color={evColor} anchorX="center" anchorY="middle" position={[0, -1.20, 0]} outlineWidth={0.02} outlineColor="white">
          {`⚡ EV: ${node.ev_charging_draw_kw?.toFixed(0)} kW`}
        </Text>
        <Text fontSize={0.22} color={harmonicColor} anchorX="center" anchorY="middle" position={[0, -1.53, 0]} outlineWidth={0.02} outlineColor="white">
          {`THD: ${node.harmonic_distortion_percent?.toFixed(2)}%`}
        </Text>
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/houses.glb');
