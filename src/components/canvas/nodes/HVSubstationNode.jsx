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

function HVSubstationModel({ node }) {
  const { scene } = useGLTF('/models/hv_substation.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const cyberAlertRef = useRef();
  const color = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.emissive = color;
          child.material.emissiveIntensity = node.cyber_intrusion_flag ? 0.6 : 0.15;
        }
      }
    });
  }, [clonedScene, node.status, node.cyber_intrusion_flag, color]);

  // Cyber intrusion: red flashing alert beacon
  useFrame(({ clock }) => {
    if (cyberAlertRef.current && node.cyber_intrusion_flag) {
      const flash = Math.sin(clock.getElapsedTime() * 12) > 0;
      cyberAlertRef.current.material.emissiveIntensity = flash ? 3.5 : 0.2;
      cyberAlertRef.current.visible = true;
    } else if (cyberAlertRef.current) {
      cyberAlertRef.current.visible = false;
    }
  });

  const oilTempColor = node.transformer_oil_temp_c > 80
    ? new THREE.Color('#EF4444')
    : node.transformer_oil_temp_c > 65
      ? new THREE.Color('#F59E0B')
      : new THREE.Color('#22C55E');

  return (
    <group>
      <Resize scale={10.0}>
        <primitive object={clonedScene} />
      </Resize>
      {/* Transformer oil temp indicator (heat glow) */}
      <pointLight
        position={[0, 2.0, 0]}
        color={oilTempColor}
        intensity={1 + (node.transformer_oil_temp_c / 100) * 2}
        distance={12}
      />
      {/* Status beacon */}
      <mesh position={[0, 6.5, 0]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
      {/* Cyber intrusion beacon (red flashing) */}
      <mesh position={[1.2, 6.5, 0]} ref={cyberAlertRef}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0} />
      </mesh>
    </group>
  );
}

export default function HVSubstationNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (node.cyber_intrusion_flag && groupRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 8) * 0.04;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  const tapStr = node.tap_changer_position >= 0 ? `+${node.tap_changer_position}` : `${node.tap_changer_position}`;
  const oilColor = node.transformer_oil_temp_c > 80 ? '#EF4444' : node.transformer_oil_temp_c > 65 ? '#F59E0B' : '#15803d';

  return (
    <group position={node.position} ref={groupRef} onClick={(e) => { e.stopPropagation(); selectNode(node.id); }}>
      <HVSubstationModel node={node} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[4.0, 4.4, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.8} />
        </mesh>
      )}
      <Billboard position={[0, 14.0, 0]}>
        <Text fontSize={0.40} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.27} color="#6B7280" anchorX="center" anchorY="middle" position={[0, -0.54, 0]} outlineWidth={0.02} outlineColor="white">
          🏭 L2 — City Gateway
        </Text>
        <Text fontSize={0.29} color={oilColor} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.00, 0]} outlineWidth={0.02} outlineColor="white">
          {`${node.incoming_voltage_kv}kV→${node.outgoing_voltage_kv?.toFixed(1)}kV  Tap:${tapStr}  Oil:${node.transformer_oil_temp_c?.toFixed(1)}°C`}
        </Text>
        {node.cyber_intrusion_flag && (
          <Text fontSize={0.32} color="#EF4444" fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -1.50, 0]} outlineWidth={0.02} outlineColor="white">
            ⚠ CYBER INTRUSION DETECTED
          </Text>
        )}
      </Billboard>
    </group>
  );
}

useGLTF.preload('/models/hv_substation.glb');
