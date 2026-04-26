import React, { useRef, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Text, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useGridStore } from '../../store/gridStore';
import SubstationNode from './nodes/SubstationNode';
import SolarFarmNode from './nodes/SolarFarmNode';
import ResidentialNode from './nodes/ResidentialNode';
import FactoryNode from './nodes/FactoryNode';
import CapacitorNode from './nodes/CapacitorNode';
import PowerLine from './PowerLine';
import PlacementOverlay from './PlacementOverlay';

// ── Ground plane for raycasting during placement ───────────────────────────
function GroundPlane({ onClick }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={onClick} visible={false}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial />
    </mesh>
  );
}

// ── Grid decoration ────────────────────────────────────────────────────────
function GridDecoration() {
  return (
    <Grid
      args={[100, 100]}
      cellSize={2}
      cellThickness={0.5}
      cellColor="#CBD5E1"
      sectionSize={8}
      sectionThickness={1}
      sectionColor="#94A3B8"
      fadeDistance={100}
      fadeStrength={2}
      position={[0, -0.005, 0]}
    />
  );
}

// ── Scene root (inside Canvas) ─────────────────────────────────────────────
function Scene() {
  const { nodes, lines, factory, capacitor, placementMode, placeFactory, selectNode } = useGridStore();

  const handleGroundClick = useCallback((e) => {
    if (!placementMode) return;
    e.stopPropagation();
    const p = e.point;
    placeFactory([parseFloat(p.x.toFixed(1)), 0, parseFloat(p.z.toFixed(1))]);
  }, [placementMode, placeFactory]);

  const handleBackgroundClick = useCallback(() => {
    if (!placementMode) selectNode(null);
  }, [placementMode, selectNode]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} color="#bfdbfe" />

      {/* Ground grid */}
      <GridDecoration />

      {/* Ground click handler */}
      <GroundPlane onClick={handleGroundClick} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={handleBackgroundClick} visible={false}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      {/* Power lines */}
      {lines.map(line => {
        const fromNode = nodes[line.from] || (factory && factory.id === line.from ? factory : null)
                       || (capacitor && capacitor.id === line.from ? capacitor : null);
        const toNode   = nodes[line.to]   || (factory && factory.id === line.to   ? factory : null)
                       || (capacitor && capacitor.id === line.to   ? capacitor : null);
        if (!fromNode || !toNode) return null;
        return (
          <PowerLine
            key={line.id}
            line={line}
            fromPos={fromNode.position}
            toPos={toNode.position}
          />
        );
      })}

      {/* Static nodes */}
      <Suspense fallback={null}>
        <SubstationNode node={nodes.substation} />
        <SolarFarmNode node={nodes.solarFarm} />
        <ResidentialNode node={nodes.residential1} />
        <ResidentialNode node={nodes.residential2} />
        <ResidentialNode node={nodes.residential3} />
      </Suspense>

      {/* Dynamic: factory */}
      {factory && (
        <Suspense fallback={null}>
          <FactoryNode node={factory} />
        </Suspense>
      )}

      {/* Dynamic: capacitor */}
      {capacitor && (
        <Suspense fallback={null}>
          <CapacitorNode node={capacitor} />
        </Suspense>
      )}

      {/* Placement ghost */}
      {placementMode && <PlacementOverlay />}

      {/* Sky */}
      <Sky sunPosition={[100, 20, 100]} turbidity={0.5} rayleigh={0.5} />

      {/* Environment */}
      <Environment preset="city" />
      <fog attach="fog" args={['#EEF2F7', 100, 250]} />
    </>
  );
}

// ── Canvas root ────────────────────────────────────────────────────────────
export default function GridCanvas() {
  const placementMode = useGridStore(s => s.placementMode);

  return (
    <div className="relative w-full h-full" style={{ cursor: placementMode ? 'crosshair' : 'default' }}>
      {/* Placement hint */}
      {placementMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none animate-fade-in">
          📍 Click on the grid to place the Factory
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [18, 20, 22], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#E8F4FD'); }}
      >
        <Scene />
        <OrbitControls
          makeDefault
          minDistance={5}
          maxDistance={150}
          maxPolarAngle={Math.PI / 2.2}
          enabled={!placementMode}
        />
      </Canvas>
    </div>
  );
}
