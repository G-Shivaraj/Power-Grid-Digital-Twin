import React, { Suspense, useCallback, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../store/gridStore';

// Node components — all 5 layers
import CoalPlantNode from './nodes/CoalPlantNode';
import GasStabilizerNode from './nodes/GasStabilizerNode';
import SolarFarmNode from './nodes/SolarFarmNode';
import HVSubstationNode from './nodes/HVSubstationNode';
import HeavyIndustryNode from './nodes/HeavyIndustryNode';
import ZoneSubstationNode from './nodes/ZoneSubstationNode';
import RMUNode from './nodes/RMUNode';
import DistTransformerNode from './nodes/DistTransformerNode';
import SmartMeterNode from './nodes/SmartMeterNode';
import PowerLine from './PowerLine';

// ── Ground plane ──────────────────────────────────────────────────────────────
function SolidGround() {
  const soilTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4a5e2a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#3a4e1f' : '#5a6e32';
      const x = Math.random() * 512, y = Math.random() * 512;
      const s = Math.random() * 2 + 1;
      ctx.fillRect(x, y, s, s);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(60, 60);
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[350, 350]} />
      <meshStandardMaterial map={soilTexture} roughness={1.0} metalness={0.0} />
    </mesh>
  );
}

function GridDecoration() {
  return (
    <Grid
      args={[200, 200]}
      cellSize={2}
      cellThickness={0.4}
      cellColor="#4a7c20"
      sectionSize={10}
      sectionThickness={0.8}
      sectionColor="#2d5a10"
      fadeDistance={150}
      fadeStrength={2}
      position={[0, -0.04, 0]}
    />
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
function Scene() {
  const { nodes, lines, selectNode } = useGridStore();

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Resolve node positions for power lines
  const getNodePos = (id) => nodes[id]?.position;

  // Collect all node positions for exclusion zone checking in power lines
  const allNodePositions = React.useMemo(() =>
    Object.values(nodes).map(n => n.position).filter(Boolean),
    [nodes]
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[15, 30, 15]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={200} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} />
      <directionalLight position={[-20, 15, -20]} intensity={0.35} color="#bfdbfe" />
      <hemisphereLight skyColor="#87CEEB" groundColor="#4a5e2a" intensity={0.5} />

      {/* Ground */}
      <SolidGround />
      <GridDecoration />

      {/* Background click to deselect */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={handleBackgroundClick} visible={false}>
        <planeGeometry args={[350, 350]} />
        <meshBasicMaterial />
      </mesh>

      {/* ── Power Lines ───────────────────────────────────────────────────── */}
      {lines.map(line => {
        const fromPos = getNodePos(line.from);
        const toPos = getNodePos(line.to);
        if (!fromPos || !toPos) return null;
        return <PowerLine key={line.id} line={line} fromPos={fromPos} toPos={toPos} nodePositions={allNodePositions} />;
      })}

      {/* ── Layer 1: Bulk Generation ──────────────────────────────────────── */}
      <Suspense fallback={null}>
        <CoalPlantNode node={nodes.coalPlant} />
        <SolarFarmNode node={nodes.solarFarm} />
        <GasStabilizerNode node={nodes.gasStabilizer} />
      </Suspense>

      {/* ── Layer 2: City Gateways ────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <HVSubstationNode node={nodes.hvSubstation} />
        <HeavyIndustryNode node={nodes.heavyIndustry} />
      </Suspense>

      {/* ── Layer 3: Urban Veins ──────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <ZoneSubstationNode node={nodes.zoneSub_north} />
        <ZoneSubstationNode node={nodes.zoneSub_east} />
        <ZoneSubstationNode node={nodes.zoneSub_west} />
        <RMUNode node={nodes.rmu_north} />
        <RMUNode node={nodes.rmu_east} />
      </Suspense>

      {/* ── Layer 4: Intelligent Edge ─────────────────────────────────────── */}
      <Suspense fallback={null}>
        <DistTransformerNode node={nodes.distTransformer_alpha} />
        <DistTransformerNode node={nodes.distTransformer_beta} />
        <SmartMeterNode node={nodes.smartMeter_residential} />
        <SmartMeterNode node={nodes.smartMeter_hospital} />
      </Suspense>

      {/* Sky & atmosphere */}
      <Sky sunPosition={[100, 30, 100]} turbidity={0.6} rayleigh={0.4} />
      <Environment preset="city" />
      <fog attach="fog" args={['#D9E8F5', 150, 400]} />
    </>
  );
}

// ── Canvas root ───────────────────────────────────────────────────────────────
export default function GridCanvas() {
  const [panningMode, setPanningMode] = useState(false);
  const controlsRef = useRef();

  const handleDoubleClick = () => setPanningMode(true);
  const handlePointerUp = () => setPanningMode(false);

  return (
    <div className="relative w-full h-full" onDoubleClick={handleDoubleClick} onPointerUp={handlePointerUp}>
      <Canvas
        shadows
        camera={{ position: [30, 40, 60], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#D9E8F5'); }}
      >
        <Scene />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          minDistance={8}
          maxDistance={300}
          maxPolarAngle={Math.PI / 2.1}
          enableRotate={!panningMode}
          enablePan={panningMode}
          mouseButtons={{
            LEFT: panningMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: panningMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
          }}
        />
      </Canvas>
    </div>
  );
}
