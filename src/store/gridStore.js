import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── Initial grid topology — 5-Layer City Power Grid ─────────────────────────
const INITIAL_NODES = {

  // ══ Layer 1: Bulk Generation ══════════════════════════════════════════════
  coalPlant: {
    id: 'coalPlant', label: 'Metro Coal Plant', type: 'thermal-generator', layer: 1,
    position: [-30, 0, -38],
    generator_rpm: 3000,
    active_power_mw: 160,
    reactive_power_mvar: 35,
    spinning_reserve_mw: 30,
    ramp_up_rate_mw_per_min: 8,
    maxCapacity: 220,
    voltage: 1.0, status: 'optimal',
    description: '220MW coal-fired synchronous generator. Primary baseload for the city. RPM locked to 3000 for 50Hz sync.',
  },
  solarFarm: {
    id: 'solarFarm', label: 'North Solar Farm', type: 'renewable', layer: 1,
    position: [-18, 0, -30],
    generator_rpm: 0,
    active_power_mw: 0,
    reactive_power_mvar: 0,
    spinning_reserve_mw: 0,
    ramp_up_rate_mw_per_min: 0,
    maxSolarOutput: 45,
    solarOutput: 0,
    solarOutputPercent: 100,
    voltage: 1.0, status: 'optimal',
    description: '45MW photovoltaic solar array with grid-tie inverters and MPPT controllers feeding the HV substation.',
  },
  gasStabilizer: {
    id: 'gasStabilizer', label: 'Gas Peaker Plant', type: 'thermal-generator', layer: 1,
    position: [24, 0, -35],
    generator_rpm: 3000,
    active_power_mw: 0,
    reactive_power_mvar: 0,
    spinning_reserve_mw: 60,
    ramp_up_rate_mw_per_min: 25,
    maxCapacity: 80,
    isStandby: true,
    voltage: 1.0, status: 'optimal',
    description: 'Fast-response gas peaker. Hot standby with 60MW spinning reserve. Ramps to full in under 3 minutes.',
  },

  // ══ Layer 2: City Gateways ════════════════════════════════════════════════
  hvSubstation: {
    id: 'hvSubstation', label: 'Primary HV Substation', type: 'primary-substation', layer: 2,
    position: [0, 0, -18],
    transformer_oil_temp_c: 52.0,
    tap_changer_position: 0,
    incoming_voltage_kv: 220,
    outgoing_voltage_kv: 33,
    cyber_intrusion_flag: false,
    voltage: 1.0, activePower: 0, reactivePower: 0, status: 'optimal',
    description: '220kV/33kV step-down substation with OLTC tap changer and SCADA monitoring. Primary city power gateway.',
  },
  heavyIndustry: {
    id: 'heavyIndustry', label: 'Heavy Industry Complex', type: 'heavy-load', layer: 2,
    position: [-26, 0, 4],
    heavy_machinery_load_kw: 28000,
    power_factor_ratio: 0.82,
    surgeModeActive: false,
    voltage: 1.0, activePower: 28, reactivePower: 0, status: 'optimal',
    description: 'Arc furnaces and rolling mills directly on 33kV gateway layer. Massive reactive power consumer.',
  },

  // ══ Layer 3: Urban Veins ══════════════════════════════════════════════════
  zoneSub_north: {
    id: 'zoneSub_north', label: 'Zone Sub — North', type: 'zone-substation', layer: 3,
    position: [0, 0, 4],
    feeder_breaker_status: 'CLOSED',
    phase_imbalance_percent: 1.2,
    voltage: 1.0, activePower: 0, status: 'optimal',
    description: '33kV/11kV zone distribution substation serving northern urban sector with ring-bus configuration.',
  },
  zoneSub_east: {
    id: 'zoneSub_east', label: 'Zone Sub — East', type: 'zone-substation', layer: 3,
    position: [22, 0, 1],
    feeder_breaker_status: 'CLOSED',
    phase_imbalance_percent: 0.9,
    voltage: 1.0, activePower: 0, status: 'optimal',
    description: '33kV/11kV zone substation for eastern sector. Ring tie to North enables self-healing path.',
  },
  zoneSub_west: {
    id: 'zoneSub_west', label: 'Zone Sub — West', type: 'zone-substation', layer: 3,
    position: [-20, 0, 1],
    feeder_breaker_status: 'CLOSED',
    phase_imbalance_percent: 1.5,
    voltage: 1.0, activePower: 0, status: 'optimal',
    description: '33kV/11kV zone substation for western industrial sector.',
  },
  rmu_north: {
    id: 'rmu_north', label: 'RMU North-A', type: 'rmu', layer: 3,
    position: [0, 0, 16],
    fault_current_detected_amps: 0,
    isolation_switch_state: false,
    telemetry_latency_ms: 12,
    voltage: 1.0, status: 'optimal',
    description: 'Automated Ring Main Unit on 11kV northern feeder. Auto-isolates faults and reroutes via ring path.',
  },
  rmu_east: {
    id: 'rmu_east', label: 'RMU East-A', type: 'rmu', layer: 3,
    position: [22, 0, 14],
    fault_current_detected_amps: 0,
    isolation_switch_state: false,
    telemetry_latency_ms: 8,
    voltage: 1.0, status: 'optimal',
    description: 'Automated RMU on eastern 11kV feeder. Provides normally-open tie switch for self-healing.',
  },

  // ══ Layer 4: Intelligent Edge ═════════════════════════════════════════════
  distTransformer_alpha: {
    id: 'distTransformer_alpha', label: 'Dist. Transformer α', type: 'dist-transformer', layer: 4,
    position: [-6, 0, 26],
    ambient_temp_celsius: 28.5,
    load_saturation_percent: 55,
    estimated_lifespan_remaining_days: 4200,
    voltage: 1.0, activePower: 0, status: 'optimal',
    description: '11kV/400V pole-mounted distribution transformer serving northern residential area (~1,400 homes).',
  },
  distTransformer_beta: {
    id: 'distTransformer_beta', label: 'Dist. Transformer β', type: 'dist-transformer', layer: 4,
    position: [14, 0, 26],
    ambient_temp_celsius: 31.2,
    load_saturation_percent: 72,
    estimated_lifespan_remaining_days: 3650,
    voltage: 1.0, activePower: 0, status: 'optimal',
    description: '11kV/400V distribution transformer for eastern sector including City Hospital (critical load).',
  },
  smartMeter_residential: {
    id: 'smartMeter_residential', label: 'Residential Prosumers', type: 'smart-meter', layer: 4,
    position: [-6, 0, 35],
    net_metering_kw: 8500,
    ev_charging_draw_kw: 0,
    harmonic_distortion_percent: 2.1,
    baseDemand: 18,
    voltage: 1.0, status: 'optimal',
    description: '2,800 residential smart meters. Bi-directional prosumers with rooftop solar and EV charging capability.',
  },
  smartMeter_hospital: {
    id: 'smartMeter_hospital', label: 'City Hospital', type: 'smart-meter', layer: 4,
    position: [14, 0, 35],
    net_metering_kw: 4200,
    ev_charging_draw_kw: 180,
    harmonic_distortion_percent: 5.8,
    baseDemand: 12,
    voltage: 1.0, status: 'optimal',
    description: 'Critical facility — City General Hospital. Always-on load with medical equipment harmonics. Priority supply.',
  },
};

const INITIAL_LINES = [
  // Layer 1 → 2: HV Transmission Corridors (220kV)
  { id: 'hv-coal-sub',   from: 'coalPlant',    to: 'hvSubstation', voltageLevel: 'hv',  resistance: 0.02, thermalLimit: 250, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,  conductor_temp_celsius: 45, line_sag_meters: 8.2, apparent_power_mva: 0 },
  { id: 'hv-solar-sub',  from: 'solarFarm',    to: 'hvSubstation', voltageLevel: 'hv',  resistance: 0.03, thermalLimit: 60,  currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: -1, conductor_temp_celsius: 38, line_sag_meters: 6.1, apparent_power_mva: 0 },
  { id: 'hv-gas-sub',    from: 'gasStabilizer',to: 'hvSubstation', voltageLevel: 'hv',  resistance: 0.025,thermalLimit: 90,  currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,  conductor_temp_celsius: 35, line_sag_meters: 5.5, apparent_power_mva: 0 },
  // Layer 2 → 3: Sub-Transmission (33kV)
  { id: 'sub-zone-north',from: 'hvSubstation', to: 'zoneSub_north', voltageLevel: 'sub', resistance: 0.04, thermalLimit: 80, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'sub-zone-east', from: 'hvSubstation', to: 'zoneSub_east',  voltageLevel: 'sub', resistance: 0.05, thermalLimit: 80, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'sub-zone-west', from: 'hvSubstation', to: 'zoneSub_west',  voltageLevel: 'sub', resistance: 0.04, thermalLimit: 80, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'sub-industry',  from: 'hvSubstation', to: 'heavyIndustry', voltageLevel: 'sub', resistance: 0.03, thermalLimit: 50, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  // Layer 3: Distribution feeders (11kV) + ring tie
  { id: 'north-rmu-n',   from: 'zoneSub_north',to: 'rmu_north',    voltageLevel: 'dist',resistance: 0.06, thermalLimit: 40, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'east-rmu-e',    from: 'zoneSub_east', to: 'rmu_east',     voltageLevel: 'dist',resistance: 0.06, thermalLimit: 40, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'ring-tie',      from: 'zoneSub_north',to: 'zoneSub_east', voltageLevel: 'dist',resistance: 0.05, thermalLimit: 30, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 0, isRingTie: true },
  // Layer 3 → 4: 11kV → 400V
  { id: 'rmu-n-alpha',   from: 'rmu_north',    to: 'distTransformer_alpha', voltageLevel: 'dist', resistance: 0.07, thermalLimit: 25, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'rmu-e-beta',    from: 'rmu_east',     to: 'distTransformer_beta',  voltageLevel: 'dist', resistance: 0.07, thermalLimit: 25, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  // Layer 4: LV (400V)
  { id: 'alpha-res',     from: 'distTransformer_alpha', to: 'smartMeter_residential', voltageLevel: 'lv', resistance: 0.1, thermalLimit: 20, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
  { id: 'beta-hosp',     from: 'distTransformer_beta',  to: 'smartMeter_hospital',    voltageLevel: 'lv', resistance: 0.08,thermalLimit: 18, currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1 },
];

const INITIAL_SIMULATION = {
  tick: 0,
  timeOfDay: 10,
  isRunning: true,
  autoAdvanceTime: true,
  faultActive: false,
  faultDetails: null,
  totalGeneration: 0,
  totalLoad: 0,
  gridFrequency: 50.0,
  selfHealingActive: false,
  selfHealingLog: null,
  cyberIntrusionActive: false,
  surgeEventActive: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useGridStore = create(
  subscribeWithSelector((set, get) => ({
    nodes: { ...INITIAL_NODES },
    lines: INITIAL_LINES.map(l => ({ ...l })),
    simulation: { ...INITIAL_SIMULATION },
    selectedNodeId: null,
    history: [],
    aiAdvisor: {
      messages: [],
      isAnalyzing: false,
      recommendation: null,
    },
    isFullscreen: false,

    toggleFullscreen: () => set(s => ({ isFullscreen: !s.isFullscreen })),
    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    // ── Node parameter editing ──────────────────────────────────────────────
    updateNodeParameter: (nodeId, param, value) => set(state => ({
      nodes: { ...state.nodes, [nodeId]: { ...state.nodes[nodeId], [param]: value } },
    })),

    // ── Simulation controls ─────────────────────────────────────────────────
    setTimeOfDay: (time) => set(s => ({ simulation: { ...s.simulation, timeOfDay: Number(time) } })),
    toggleAutoAdvance: () => set(s => ({ simulation: { ...s.simulation, autoAdvanceTime: !s.simulation.autoAdvanceTime } })),
    toggleSimulation: () => set(s => ({ simulation: { ...s.simulation, isRunning: !s.simulation.isRunning } })),

    // ── Scenario toggles ────────────────────────────────────────────────────
    toggleSurgeEvent: () => set(s => ({
      simulation: { ...s.simulation, surgeEventActive: !s.simulation.surgeEventActive },
    })),
    triggerCyberIntrusion: () => set(s => ({
      nodes: { ...s.nodes, hvSubstation: { ...s.nodes.hvSubstation, cyber_intrusion_flag: true } },
      simulation: { ...s.simulation, cyberIntrusionActive: true },
    })),
    clearCyberIntrusion: () => set(s => ({
      nodes: { ...s.nodes, hvSubstation: { ...s.nodes.hvSubstation, cyber_intrusion_flag: false } },
      simulation: { ...s.simulation, cyberIntrusionActive: false },
    })),
    triggerRMUFault: () => set(s => ({
      nodes: {
        ...s.nodes,
        rmu_north: { ...s.nodes.rmu_north, fault_current_detected_amps: 2800, isolation_switch_state: true, status: 'failed' },
        zoneSub_north: { ...s.nodes.zoneSub_north, feeder_breaker_status: 'TRIPPED' },
      },
      simulation: { ...s.simulation, faultActive: true, faultDetails: { type: 'rmu-isolation', location: 'rmu_north' } },
    })),

    // ── Physics engine output ───────────────────────────────────────────────
    applyPhysicsResult: (result) => set(state => {
      const newHistory = [
        ...state.history.slice(-59),
        {
          tick: result.tick,
          totalLoad: result.totalLoad,
          totalGen: result.totalGeneration,
          frequency: result.gridFrequency,
          voltageAvg: result.voltageAvg,
          coalRPM: result.coalRPM,
        },
      ];
      return {
        nodes: result.nodes,
        lines: result.lines,
        simulation: {
          ...state.simulation,
          tick: result.tick,
          faultActive: result.faultActive,
          faultDetails: result.faultDetails,
          totalGeneration: result.totalGeneration,
          totalLoad: result.totalLoad,
          gridFrequency: result.gridFrequency,
          selfHealingActive: result.selfHealingActive,
          selfHealingLog: result.selfHealingLog,
          cyberIntrusionActive: result.cyberIntrusionActive,
        },
        history: newHistory,
      };
    }),

    clearFault: () => set(s => ({
      simulation: { ...s.simulation, faultActive: false, faultDetails: null },
      nodes: {
        ...s.nodes,
        rmu_north: { ...s.nodes.rmu_north, fault_current_detected_amps: 0, isolation_switch_state: false, status: 'optimal' },
        zoneSub_north: { ...s.nodes.zoneSub_north, feeder_breaker_status: 'CLOSED' },
      },
    })),

    // ── AI Advisor ──────────────────────────────────────────────────────────
    addAIMessage: (msg) => set(s => ({
      aiAdvisor: { ...s.aiAdvisor, messages: [...s.aiAdvisor.messages, { id: Date.now(), ...msg }] },
    })),
    setAIAnalyzing: (v) => set(s => ({ aiAdvisor: { ...s.aiAdvisor, isAnalyzing: v } })),
    setAIRecommendation: (rec) => set(s => ({ aiAdvisor: { ...s.aiAdvisor, recommendation: rec } })),
    clearAIMessages: () => set(s => ({ aiAdvisor: { ...s.aiAdvisor, messages: [], recommendation: null } })),

    // ── Reset ────────────────────────────────────────────────────────────────
    resetGrid: () => set({
      nodes: (() => { const n = {}; Object.keys(INITIAL_NODES).forEach(k => { n[k] = { ...INITIAL_NODES[k] }; }); return n; })(),
      lines: INITIAL_LINES.map(l => ({ ...l })),
      simulation: { ...INITIAL_SIMULATION },
      selectedNodeId: null,
      history: [],
      isFullscreen: false,
      aiAdvisor: { messages: [], isAnalyzing: false, recommendation: null },
    }),
  }))
);
