/**
 * GenericNode.jsx — Procedural 3D nodes for dynamically-added components
 * No GLB required. Uses Three.js primitives with status-reactive materials.
 * Supports: bess, capacitor-bank, harmonic-filter, phase-balancer,
 *           load-limiter, backup-rtu, forced-cooling, aux-transformer,
 *           bypass-switch
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../../store/gridStore';

const STATUS_COLORS = {
  optimal: '#22C55E',
  stressed: '#F59E0B',
  failed:   '#EF4444',
};

// ── BESS — Battery Energy Storage System ─────────────────────────────────────
function BESSModel() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.children.forEach((c, i) => {
      if (c.material) {
        c.material.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 2 + i) * 0.3;
      }
    });
  });
  return (
    <group ref={ref}>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, i * 0.9 + 0.45, 0]}>
          <boxGeometry args={[2.2, 0.7, 1.2]} />
          <meshStandardMaterial color="#1D4ED8" emissive="#3B82F6" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 3.2, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#3B82F6" intensity={3} distance={7} />
    </group>
  );
}

// ── Capacitor Bank ────────────────────────────────────────────────────────────
function CapacitorBankModel() {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.y = clock.getElapsedTime() * 1.2;
  });
  return (
    <group>
      {[-0.7, 0, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 1.0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 2.0, 10]} />
          <meshStandardMaterial color="#0EA5E9" emissive="#38BDF8" emissiveIntensity={0.5} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <group ref={ringRef} position={[0, 2.2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.1, 0.04, 8, 32]} />
          <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={1.5} transparent opacity={0.85} />
        </mesh>
      </group>
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.20, 12, 12]} />
        <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#38BDF8" intensity={2.5} distance={6} />
    </group>
  );
}

// ── Harmonic Filter ───────────────────────────────────────────────────────────
function HarmonicFilterModel() {
  const waveRef = useRef();
  useFrame(({ clock }) => {
    if (waveRef.current) {
      waveRef.current.rotation.y = clock.getElapsedTime() * 2.0;
      waveRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 4) * 0.08);
    }
  });
  return (
    <group>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 2.0, 16]} />
        <meshStandardMaterial color="#7C3AED" emissive="#8B5CF6" emissiveIntensity={0.4} metalness={0.5} roughness={0.4} />
      </mesh>
      <group ref={waveRef} position={[0, 2.2, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[Math.PI / 2, (i * Math.PI * 2) / 3, 0]}>
            <torusGeometry args={[0.6 + i * 0.2, 0.03, 6, 24]} />
            <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.5} transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#C4B5FD" emissive="#C4B5FD" emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#8B5CF6" intensity={2} distance={6} />
    </group>
  );
}

// ── Phase Balancer ────────────────────────────────────────────────────────────
function PhaseBalancerModel() {
  const spinRef = useRef();
  useFrame(({ clock }) => {
    if (spinRef.current) spinRef.current.rotation.y = clock.getElapsedTime() * 1.5;
  });
  const phaseColors = ['#EF4444', '#FBBF24', '#22C55E'];
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4} />
      </mesh>
      <group ref={spinRef} position={[0, 2.2, 0]}>
        {phaseColors.map((c, i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.7, 0, Math.sin((i * Math.PI * 2) / 3) * 0.7]}>
            <sphereGeometry args={[0.2, 10, 10]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.0} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#F9FAFB" emissive="#F9FAFB" emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#FBBF24" intensity={2} distance={5} />
    </group>
  );
}

// ── Load Limiter ──────────────────────────────────────────────────────────────
function LoadLimiterModel() {
  const ledRef = useRef();
  useFrame(({ clock }) => {
    if (ledRef.current) ledRef.current.material.emissiveIntensity = 1.5 + Math.sin(clock.getElapsedTime() * 3) * 0.8;
  });
  return (
    <group>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[1.4, 2.0, 0.6]} />
        <meshStandardMaterial color="#1F2937" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.6, 0.31]}>
        <boxGeometry args={[0.8, 0.5, 0.05]} />
        <meshStandardMaterial color="#DC2626" emissive="#EF4444" emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={ledRef} position={[0, 1.0, 0.32]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#FCD34D" emissive="#FCD34D" emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#EF4444" intensity={1.5} distance={4} />
    </group>
  );
}

// ── Backup RTU ────────────────────────────────────────────────────────────────
function BackupRTUModel() {
  const ledRef = useRef(0);
  const meshRefs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    meshRefs.current.forEach((m, i) => {
      if (m) m.material.emissiveIntensity = Math.sin(t * 5 + i * 1.2) > 0.3 ? 2.0 : 0.2;
    });
  });
  return (
    <group>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.6, 2.4, 0.7]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el; }} position={[(-0.5 + i * 0.25), 1.8, 0.36]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={2.0} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#60A5FA" emissive="#60A5FA" emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#22C55E" intensity={1.5} distance={5} />
    </group>
  );
}

// ── Forced Cooling Unit ───────────────────────────────────────────────────────
function ForcedCoolingModel() {
  const fanRef = useRef();
  useFrame(({ clock }) => {
    if (fanRef.current) fanRef.current.rotation.z = clock.getElapsedTime() * 8;
  });
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1.8, 1.6, 1.0]} />
        <meshStandardMaterial color="#0F4C75" metalness={0.6} roughness={0.5} />
      </mesh>
      <group ref={fanRef} position={[0, 1.0, 0.52]}>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <boxGeometry args={[0.08, 0.55, 0.04]} />
            <meshStandardMaterial color="#93C5FD" emissive="#BFDBFE" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#BAE6FD" emissive="#BAE6FD" emissiveIntensity={2.0} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#BAE6FD" intensity={2} distance={5} />
    </group>
  );
}

// ── Aux Transformer ───────────────────────────────────────────────────────────
function AuxTransformerModel() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.6, 1.8, 1.0]} />
        <meshStandardMaterial color="#78350F" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 0.5, 12]} />
        <meshStandardMaterial color="#92400E" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#FCD34D" emissive="#FCD34D" emissiveIntensity={1.8} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#FCD34D" intensity={1.5} distance={5} />
    </group>
  );
}

// ── Bypass Switch ─────────────────────────────────────────────────────────────
function BypassSwitchModel() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.emissiveIntensity = 1.0 + Math.sin(clock.getElapsedTime() * 4) * 0.5;
  });
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 1.0, 0.5]} />
        <meshStandardMaterial color="#1F2937" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 6]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <meshStandardMaterial color="#FCD34D" emissive="#FCD34D" emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={ref} position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#22C55E" intensity={1.5} distance={4} />
    </group>
  );
}

// ── Model map ─────────────────────────────────────────────────────────────────
const MODEL_MAP = {
  'bess':            { Model: BESSModel,           billboardY: 4.2, label2color: '#3B82F6', label2fn: n => `⚡ ${n.chargeMW}MW / ${n.capacityMWh}MWh` },
  'capacitor-bank':  { Model: CapacitorBankModel,  billboardY: 3.8, label2color: '#0EA5E9', label2fn: n => `+${n.reactivePowerSupport} MVAR` },
  'harmonic-filter': { Model: HarmonicFilterModel, billboardY: 3.8, label2color: '#8B5CF6', label2fn: () => 'Active Filter' },
  'phase-balancer':  { Model: PhaseBalancerModel,  billboardY: 3.8, label2color: '#F59E0B', label2fn: () => 'Phase Balancer' },
  'load-limiter':    { Model: LoadLimiterModel,    billboardY: 3.6, label2color: '#EF4444', label2fn: n => `Cap: ${n.limitMW}MW` },
  'backup-rtu':      { Model: BackupRTUModel,      billboardY: 3.8, label2color: '#22C55E', label2fn: () => 'Encrypted RTU' },
  'forced-cooling':  { Model: ForcedCoolingModel,  billboardY: 3.4, label2color: '#BAE6FD', label2fn: () => 'Cooling Active' },
  'aux-transformer': { Model: AuxTransformerModel, billboardY: 3.6, label2color: '#FCD34D', label2fn: () => 'Parallel TX' },
  'bypass-switch':   { Model: BypassSwitchModel,   billboardY: 3.2, label2color: '#22C55E', label2fn: () => 'Bypass CLOSED' },
};

// ── Generic Node wrapper ──────────────────────────────────────────────────────
export default function GenericNode({ node }) {
  const selectNode = useGridStore(s => s.selectNode);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const isSelected = selectedNodeId === node.id;
  const groupRef = useRef();
  const scaleRef = useRef({ t: 0 });

  // Pop-in animation
  useFrame((_, delta) => {
    if (scaleRef.current.t < 1) {
      scaleRef.current.t = Math.min(1, scaleRef.current.t + delta * 3);
      const s = scaleRef.current.t < 0.8
        ? scaleRef.current.t / 0.8
        : 1 + Math.sin((scaleRef.current.t - 0.8) / 0.2 * Math.PI) * 0.12;
      if (groupRef.current) groupRef.current.scale.setScalar(s);
    }
  });

  const cfg = MODEL_MAP[node.type] || MODEL_MAP['backup-rtu'];
  const { Model, billboardY, label2color, label2fn } = cfg;
  const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.optimal;

  return (
    <group
      position={node.position}
      ref={groupRef}
      scale={[0, 0, 0]}
      onClick={e => { e.stopPropagation(); selectNode(node.id); }}
    >
      <Model node={node} />

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.6, 1.9, 32]} />
          <meshBasicMaterial color="#0EA5E9" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Dynamic deploy glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.2, 1.5, 32]} />
        <meshBasicMaterial color={statusColor} transparent opacity={0.25} />
      </mesh>

      <Billboard position={[0, billboardY, 0]}>
        <Text fontSize={0.30} color="#0f172a" fontWeight="bold" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="white">
          {node.label}
        </Text>
        <Text fontSize={0.23} color={label2color} fontWeight="bold" anchorX="center" anchorY="middle" position={[0, -0.38, 0]} outlineWidth={0.02} outlineColor="white">
          {label2fn(node)}
        </Text>
      </Billboard>
    </group>
  );
}
