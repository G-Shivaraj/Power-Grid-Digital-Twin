import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── Initial grid topology ────────────────────────────────────────────────────
const INITIAL_NODES = {
  substation: {
    id: 'substation', label: 'Main Substation', type: 'source',
    position: [0, 0, 0],
    voltage: 1.0, activePower: 0, reactivePower: 0,
    maxCapacity: 50, current: 0, status: 'optimal',
    description: 'Primary 132kV/33kV transmission substation feeding the microgrid.',
  },
  solarFarm: {
    id: 'solarFarm', label: 'Solar Farm', type: 'renewable',
    position: [-12, 0, -12],
    voltage: 1.0, activePower: 0, reactivePower: 0,
    maxCapacity: 15, solarOutput: 0, maxSolarOutput: 15,
    solarOutputPercent: 100, status: 'optimal',
    description: '15MW photovoltaic solar array with grid-tie inverters.',
  },
  residential1: {
    id: 'residential1', label: 'District Alpha', type: 'load',
    position: [15, 0, -4],
    voltage: 1.0, activePower: 0, reactivePower: 0,
    baseDemand: 8, actualDemand: 8, status: 'optimal',
    description: 'Residential zone A — 2,400 homes and light commercial.',
  },
  residential2: {
    id: 'residential2', label: 'District Beta', type: 'load',
    position: [10, 0, 15],
    voltage: 1.0, activePower: 0, reactivePower: 0,
    baseDemand: 10, actualDemand: 10, status: 'optimal',
    description: 'Residential zone B — 3,100 homes and mixed commercial.',
  },
  residential3: {
    id: 'residential3', label: 'District Gamma', type: 'load',
    position: [-15, 0, 10],
    voltage: 1.0, activePower: 0, reactivePower: 0,
    baseDemand: 7, actualDemand: 7, status: 'optimal',
    description: 'Residential zone C — 2,000 homes near solar farm.',
  },
};

const INITIAL_LINES = [
  { id: 'line-sub-r1', from: 'substation', to: 'residential1', resistance: 0.05, thermalLimit: 20, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'line-sub-r2', from: 'substation', to: 'residential2', resistance: 0.06, thermalLimit: 20, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'line-sub-solar', from: 'substation', to: 'solarFarm', resistance: 0.04, thermalLimit: 15, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: -1 },
  { id: 'line-solar-r3', from: 'solarFarm', to: 'residential3', resistance: 0.03, thermalLimit: 12, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'line-r1-r2', from: 'residential1', to: 'residential2', resistance: 0.03, thermalLimit: 10, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
];

const INITIAL_SIMULATION = {
  tick: 0,
  timeOfDay: 10,
  isRunning: true,
  autoAdvanceTime: true,
  faultActive: false,
  faultDetails: null,
  totalGeneration: 0,
  totalLoad: 25,
  gridFrequency: 50.0,
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useGridStore = create(
  subscribeWithSelector((set, get) => ({
    nodes: { ...INITIAL_NODES },
    lines: INITIAL_LINES.map(l => ({ ...l })),
    factory: null,
    capacitor: null,
    simulation: { ...INITIAL_SIMULATION },
    selectedNodeId: null,
    placementMode: false,
    history: [],         // [{tick, totalLoad, totalGen, freqency, voltage_avg}]
    aiAdvisor: {
      messages: [],
      isAnalyzing: false,
      recommendation: null,
      capacitorDeployed: false,
    },

    // ── Node selection ──────────────────────────────────────────────────────
    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    // ── Placement mode ──────────────────────────────────────────────────────
    setPlacementMode: (mode) => set({ placementMode: mode }),

    // ── Factory actions ─────────────────────────────────────────────────────
    placeFactory: (position) => set({
      factory: {
        id: 'factory', label: 'Industrial Factory', type: 'heavy-load',
        position,
        voltage: 1.0, activePower: 0, reactivePower: 0,
        industrialLoad: 35, powerFactor: 0.75, status: 'optimal',
        description: '35MW heavy industrial smelting facility — extreme reactive power demand.',
      },
      placementMode: false,
    }),
    removeFactory: () => set({ factory: null }),

    // ── Capacitor deploy ────────────────────────────────────────────────────
    deployCapacitor: () => set((state) => {
      // Place near factory if available, else between sub and r2
      const factoryPos = state.factory?.position;
      const capPos = factoryPos
        ? [factoryPos[0] * 0.5, 0, factoryPos[2] * 0.5]
        : [5, 0, 5];
      return {
        capacitor: {
          id: 'capacitor', label: 'Shunt Capacitor Bank', type: 'compensator',
          position: capPos,
          voltage: 1.0, reactivePowerSupport: 5, status: 'optimal',
          description: '5 MVAR shunt capacitor bank providing local reactive power compensation.',
        },
        aiAdvisor: {
          ...state.aiAdvisor,
          capacitorDeployed: true,
          recommendation: null,
        },
      };
    }),

    // ── Parameter tinkering ─────────────────────────────────────────────────
    updateNodeParameter: (nodeId, param, value) => set((state) => {
      if (nodeId === 'factory' && state.factory) {
        return { factory: { ...state.factory, [param]: value } };
      }
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: { ...state.nodes[nodeId], [param]: value },
        },
      };
    }),

    // ── Simulation controls ─────────────────────────────────────────────────
    setTimeOfDay: (time) => set((state) => ({
      simulation: { ...state.simulation, timeOfDay: Number(time) },
    })),
    toggleAutoAdvance: () => set((state) => ({
      simulation: { ...state.simulation, autoAdvanceTime: !state.simulation.autoAdvanceTime },
    })),
    toggleSimulation: () => set((state) => ({
      simulation: { ...state.simulation, isRunning: !state.simulation.isRunning },
    })),

    // ── Physics engine output ───────────────────────────────────────────────
    applyPhysicsResult: (result) => set((state) => {
      const newHistory = [
        ...state.history.slice(-59),
        {
          tick: result.tick,
          totalLoad: result.totalLoad,
          totalGen: result.totalGeneration,
          frequency: result.gridFrequency,
          voltageAvg: result.voltageAvg,
        },
      ];
      return {
        nodes: result.nodes,
        lines: result.lines,
        factory: result.factory !== undefined ? result.factory : state.factory,
        simulation: {
          ...state.simulation,
          tick: result.tick,
          faultActive: result.faultActive,
          faultDetails: result.faultDetails,
          totalGeneration: result.totalGeneration,
          totalLoad: result.totalLoad,
          gridFrequency: result.gridFrequency,
        },
        history: newHistory,
      };
    }),

    // ── Fault ───────────────────────────────────────────────────────────────
    clearFault: () => set((state) => ({
      simulation: { ...state.simulation, faultActive: false, faultDetails: null },
    })),

    // ── AI Advisor ──────────────────────────────────────────────────────────
    addAIMessage: (msg) => set((state) => ({
      aiAdvisor: {
        ...state.aiAdvisor,
        messages: [...state.aiAdvisor.messages, { id: Date.now(), ...msg }],
      },
    })),
    setAIAnalyzing: (v) => set((state) => ({
      aiAdvisor: { ...state.aiAdvisor, isAnalyzing: v },
    })),
    setAIRecommendation: (rec) => set((state) => ({
      aiAdvisor: { ...state.aiAdvisor, recommendation: rec },
    })),
    clearAIMessages: () => set((state) => ({
      aiAdvisor: { ...state.aiAdvisor, messages: [], recommendation: null },
    })),

    // ── Reset ────────────────────────────────────────────────────────────────
    resetGrid: () => set({
      nodes: (() => {
        const n = {};
        Object.keys(INITIAL_NODES).forEach(k => { n[k] = { ...INITIAL_NODES[k] }; });
        return n;
      })(),
      lines: INITIAL_LINES.map(l => ({ ...l })),
      factory: null,
      capacitor: null,
      simulation: { ...INITIAL_SIMULATION },
      selectedNodeId: null,
      placementMode: false,
      history: [],
      aiAdvisor: { messages: [], isAnalyzing: false, recommendation: null, capacitorDeployed: false },
    }),
  }))
);
