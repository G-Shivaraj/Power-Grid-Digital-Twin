/**
 * caseDefinitions.js — 10 Real-World Grid Failure Cases
 * Each case has: id, title, severity, detect(), promptTemplate(), availableActions[]
 */

// ── Action factory helpers ────────────────────────────────────────────────────
const makeId = () => `dyn_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

function offsetPosition(base, dx, dz) {
  return [base[0] + dx, 0, base[2] + dz];
}

// ── Case 1: Transformer Overload ──────────────────────────────────────────────
export const CASE_TRANSFORMER_OVERLOAD = {
  id: 'transformer_overload',
  title: 'Transformer Overload',
  severity: 'critical',
  cooldownTicks: 100,
  detect(nodes) {
    const alpha = nodes.distTransformer_alpha;
    const beta  = nodes.distTransformer_beta;
    return (alpha?.load_saturation_percent > 95) || (beta?.load_saturation_percent > 95);
  },
  getContext(nodes) {
    const alpha = nodes.distTransformer_alpha;
    const beta  = nodes.distTransformer_beta;
    const which = (alpha?.load_saturation_percent > 95) ? alpha : beta;
    return { nodeId: which.id, label: which.label, sat: which.load_saturation_percent?.toFixed(1) };
  },
  promptTemplate(state) {
    const ctx = CASE_TRANSFORMER_OVERLOAD.getContext(state.nodes);
    return `CASE: Transformer Overload. ${ctx.label} is at ${ctx.sat}% load saturation (limit 95%). Lifespan is degrading. Total system load: ${state.simulation.totalLoad?.toFixed(1)} MW. Recommend solutions.`;
  },
  availableActions: [
    {
      id: 'deploy_parallel_transformer',
      label: 'Deploy Parallel Transformer',
      icon: '🔌',
      description: 'Add a second distribution transformer to share the load.',
      expectedOutcome: 'Load saturation drops ~50% on overloaded transformer.',
      execute(store) {
        const state = store.getState();
        const ctx = CASE_TRANSFORMER_OVERLOAD.getContext(state.nodes);
        const base = state.nodes[ctx.nodeId]?.position || [0, 0, 45];
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Aux Transformer', type: 'aux-transformer',
          position: offsetPosition(base, 5, 0),
          layer: 4, voltage: 1.0, status: 'optimal',
          load_saturation_percent: 0,
          description: 'Parallel distribution transformer deployed to share overload.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: ctx.nodeId, to: id,
          voltageLevel: 'lv', resistance: 0.05, thermalLimit: 25,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,
        });
        store.getState().setDynamicEffect('transformer_overload', { parallelTransformer: true, targetId: ctx.nodeId });
      },
    },
    {
      id: 'reduce_residential_load',
      label: 'Shed Non-Critical Load',
      icon: '📉',
      description: 'Reduce residential base demand by 20% via demand response.',
      expectedOutcome: 'Load saturation drops 15-20%.',
      execute(store) {
        const state = store.getState();
        const current = state.nodes.smartMeter_residential?.baseDemand ?? 18;
        store.getState().updateNodeParameter('smartMeter_residential', 'baseDemand', Math.max(5, current * 0.8));
        store.getState().setDynamicEffect('transformer_overload', { demandResponse: true });
      },
    },
  ],
};

// ── Case 2: Voltage Collapse ──────────────────────────────────────────────────
export const CASE_VOLTAGE_COLLAPSE = {
  id: 'voltage_collapse',
  title: 'Voltage Collapse (Cascading)',
  severity: 'emergency',
  cooldownTicks: 80,
  detect(nodes) {
    return Object.values(nodes).some(n => n.voltage < 0.85 && n.layer >= 3);
  },
  promptTemplate(state) {
    const low = Object.values(state.nodes).filter(n => n.voltage < 0.85 && n.layer >= 3);
    const names = low.map(n => `${n.label} (${n.voltage?.toFixed(3)} pu)`).join(', ');
    return `CASE: Voltage Collapse. Nodes below 0.85 pu: ${names}. Grid frequency: ${state.simulation.gridFrequency?.toFixed(3)} Hz. Self-healing: ${state.simulation.selfHealingActive}. Recommend emergency actions.`;
  },
  availableActions: [
    {
      id: 'activate_gas_peaker',
      label: 'Activate Gas Peaker',
      icon: '⚡',
      description: 'Dispatch Gas Peaker Plant spinning reserve (60 MW available).',
      expectedOutcome: 'Generation increases 30-60 MW, frequency stabilises.',
      execute(store) {
        store.getState().updateNodeParameter('gasStabilizer', 'isStandby', false);
        store.getState().setDynamicEffect('voltage_collapse', { gasPeakerActive: true });
      },
    },
    {
      id: 'deploy_capacitor_bank',
      label: 'Deploy Capacitor Bank',
      icon: '🔋',
      description: 'Add a 20 MVAR capacitor bank at Zone Sub North for reactive support.',
      expectedOutcome: 'Voltage at north zone recovers +0.04 pu.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Capacitor Bank', type: 'capacitor-bank',
          position: [-6, 0, 4], layer: 3,
          voltage: 1.0, status: 'optimal',
          reactivePowerSupport: 20,
          description: 'Emergency capacitor bank providing 20 MVAR reactive support.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: 'zoneSub_north', to: id,
          voltageLevel: 'dist', resistance: 0.02, thermalLimit: 30,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: -1,
        });
        store.getState().setDynamicEffect('voltage_collapse', { capacitorBank: true, reactiveSupport: 20 });
      },
    },
  ],
};

// ── Case 3: Industrial Surge Overload ─────────────────────────────────────────
export const CASE_INDUSTRIAL_SURGE = {
  id: 'industrial_surge',
  title: 'Industrial Surge Overload',
  severity: 'critical',
  cooldownTicks: 60,
  detect(nodes, lines, simulation) {
    const hi = nodes.heavyIndustry;
    const freqDev = Math.abs((simulation.gridFrequency ?? 50) - 50);
    return simulation.surgeEventActive && hi?.activePower > 35 && freqDev > 0.15;
  },
  promptTemplate(state) {
    const hi = state.nodes.heavyIndustry;
    return `CASE: Industrial Surge Overload. Heavy Industry drawing ${hi?.activePower?.toFixed(1)} MW (rated 28 MW). Power factor: ${hi?.power_factor_ratio?.toFixed(2)}. Frequency deviation: ${Math.abs((state.simulation.gridFrequency - 50)).toFixed(3)} Hz. Recommend curtailment strategy.`;
  },
  availableActions: [
    {
      id: 'curtail_industry',
      label: 'Curtail Industrial Load',
      icon: '🏭',
      description: 'Reduce heavy industry machinery load by 30%.',
      expectedOutcome: 'Industry load drops ~8 MW, frequency recovers.',
      execute(store) {
        const cur = store.getState().nodes.heavyIndustry?.heavy_machinery_load_kw ?? 28000;
        store.getState().updateNodeParameter('heavyIndustry', 'heavy_machinery_load_kw', Math.round(cur * 0.7));
        store.getState().setDynamicEffect('industrial_surge', { industryCurtailed: true });
      },
    },
    {
      id: 'deploy_load_limiter',
      label: 'Deploy Load Limiter',
      icon: '🔒',
      description: 'Install electronic load limiter on heavy industry feeder.',
      expectedOutcome: 'Hard cap at 30 MW prevents further surge.',
      execute(store) {
        const id = makeId();
        const base = store.getState().nodes.heavyIndustry?.position || [-48, 0, -12];
        store.getState().addDynamicNode({
          id, label: 'Load Limiter', type: 'load-limiter',
          position: offsetPosition(base, 4, 4),
          layer: 2, voltage: 1.0, status: 'optimal',
          limitMW: 30,
          description: 'Electronic load limiter capping heavy industry at 30 MW.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: 'heavyIndustry', to: id,
          voltageLevel: 'sub', resistance: 0.01, thermalLimit: 40,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,
        });
        store.getState().setDynamicEffect('industrial_surge', { loadLimiter: true });
      },
    },
  ],
};

// ── Case 4: Solar Intermittency Ramp ─────────────────────────────────────────
export const CASE_SOLAR_RAMP = {
  id: 'solar_ramp',
  title: 'Solar Intermittency Ramp',
  severity: 'warning',
  cooldownTicks: 120,
  detect(nodes, lines, simulation) {
    const solar = nodes.solarFarm;
    return (
      simulation.timeOfDay >= 6 &&
      simulation.timeOfDay <= 19 &&
      solar?.solarOutputPercent < 40 &&
      solar?.maxSolarOutput > 0
    );
  },
  promptTemplate(state) {
    const s = state.nodes.solarFarm;
    return `CASE: Solar Intermittency. Solar output at ${s?.solarOutputPercent}% of max capacity (${s?.maxSolarOutput} MW). Gap: ${((1 - s?.solarOutputPercent / 100) * s?.maxSolarOutput)?.toFixed(1)} MW needs backup. Time of day: ${state.simulation.timeOfDay?.toFixed(1)}h. Recommend backup strategy.`;
  },
  availableActions: [
    {
      id: 'activate_gas_peaker_solar',
      label: 'Activate Gas Peaker',
      icon: '⚡',
      description: 'Bring gas peaker online to compensate solar shortfall.',
      expectedOutcome: 'Up to 60 MW backup generation available.',
      execute(store) {
        store.getState().updateNodeParameter('gasStabilizer', 'isStandby', false);
        store.getState().setDynamicEffect('solar_ramp', { gasPeakerActive: true });
      },
    },
    {
      id: 'deploy_bess',
      label: 'Deploy Battery Storage (BESS)',
      icon: '🔋',
      description: 'Deploy a 15 MW / 30 MWh battery system next to solar farm.',
      expectedOutcome: 'BESS discharges to fill solar gap for up to 2 hours.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'BESS — 15MW', type: 'bess',
          position: [8, 0, -55], layer: 1,
          voltage: 1.0, status: 'optimal',
          capacityMWh: 30, chargeMW: 15, stateOfCharge: 85,
          description: 'Battery Energy Storage System providing 15 MW solar backup.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: 'solarFarm', to: id,
          voltageLevel: 'hv', resistance: 0.02, thermalLimit: 20,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: -1,
        });
        store.getState().setDynamicEffect('solar_ramp', { bess: true, bessId: id });
      },
    },
  ],
};

// ── Case 5: SCADA Cyber Intrusion ─────────────────────────────────────────────
export const CASE_CYBER_INTRUSION = {
  id: 'cyber_intrusion',
  title: 'SCADA Cyber Intrusion',
  severity: 'emergency',
  cooldownTicks: 50,
  detect(nodes) {
    return nodes.hvSubstation?.cyber_intrusion_flag === true;
  },
  promptTemplate(state) {
    const hv = state.nodes.hvSubstation;
    return `CASE: SCADA Cyber Intrusion detected at HV Primary Substation. Oil temp: ${hv?.transformer_oil_temp_c?.toFixed(1)}°C. Tap position: ${hv?.tap_changer_position}. Grid frequency: ${state.simulation.gridFrequency?.toFixed(3)} Hz. Recommend isolation and response protocol.`;
  },
  availableActions: [
    {
      id: 'isolate_scada',
      label: 'Isolate SCADA Channel',
      icon: '🛡',
      description: 'Cut remote SCADA comms, switch to manual tap changer control.',
      expectedOutcome: 'Intrusion vector eliminated. Cyber flag cleared.',
      execute(store) {
        store.getState().clearCyberIntrusion();
        store.getState().setDynamicEffect('cyber_intrusion', { scadaIsolated: true });
      },
    },
    {
      id: 'deploy_backup_rtu',
      label: 'Deploy Backup RTU',
      icon: '📡',
      description: 'Bring hardened backup Remote Terminal Unit online.',
      expectedOutcome: 'Secure telemetry restored with encrypted channel.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Backup RTU', type: 'backup-rtu',
          position: [6, 0, -28], layer: 2,
          voltage: 1.0, status: 'optimal',
          description: 'Hardened backup RTU with IEC 62351 encryption active.',
        });
        store.getState().setDynamicEffect('cyber_intrusion', { backupRTU: true });
      },
    },
  ],
};

// ── Case 6: RMU Fault + Feeder Isolation ─────────────────────────────────────
export const CASE_RMU_FAULT = {
  id: 'rmu_fault',
  title: 'RMU Fault — Feeder Isolation',
  severity: 'critical',
  cooldownTicks: 80,
  detect(nodes) {
    return nodes.rmu_north?.fault_current_detected_amps > 2000 &&
           nodes.rmu_north?.isolation_switch_state === true;
  },
  promptTemplate(state) {
    const rmu = state.nodes.rmu_north;
    return `CASE: RMU North-A fault isolation active. Fault current: ${rmu?.fault_current_detected_amps?.toFixed(0)} A. Self-healing ring tie engaged: ${state.simulation.selfHealingActive}. North sector voltage: ${state.nodes.zoneSub_north?.voltage?.toFixed(3)} pu. Recommend restoration steps.`;
  },
  availableActions: [
    {
      id: 'close_ring_tie',
      label: 'Confirm Ring Tie Reroute',
      icon: '🔄',
      description: 'Acknowledge self-healing ring tie reroute is active.',
      expectedOutcome: 'North sector re-energised via East feeder.',
      execute(store) {
        store.getState().setDynamicEffect('rmu_fault', { ringTieConfirmed: true });
      },
    },
    {
      id: 'deploy_bypass_switch',
      label: 'Deploy Bypass Switch',
      icon: '🔀',
      description: 'Install temporary bypass switch around faulted RMU segment.',
      expectedOutcome: 'Radial topology restored pending physical repair.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Bypass Switch', type: 'bypass-switch',
          position: [-4, 0, 22], layer: 3,
          voltage: 1.0, status: 'optimal',
          description: 'Temporary bypass switch around faulted RMU North-A segment.',
        });
        store.getState().setDynamicEffect('rmu_fault', { bypassSwitch: true });
      },
    },
  ],
};

// ── Case 7: Harmonic Distortion ───────────────────────────────────────────────
export const CASE_HARMONICS = {
  id: 'harmonic_distortion',
  title: 'Harmonic Distortion Threshold Exceeded',
  severity: 'warning',
  cooldownTicks: 150,
  detect(nodes) {
    return (
      nodes.smartMeter_residential?.harmonic_distortion_percent > 8 ||
      nodes.smartMeter_hospital?.harmonic_distortion_percent > 8
    );
  },
  promptTemplate(state) {
    const res  = state.nodes.smartMeter_residential;
    const hosp = state.nodes.smartMeter_hospital;
    return `CASE: Harmonic Distortion. Residential THD: ${res?.harmonic_distortion_percent?.toFixed(2)}%. Hospital THD: ${hosp?.harmonic_distortion_percent?.toFixed(2)}%. EV charging draw: ${res?.ev_charging_draw_kw} kW. Recommend mitigation.`;
  },
  availableActions: [
    {
      id: 'deploy_harmonic_filter',
      label: 'Deploy Active Harmonic Filter',
      icon: '〰️',
      description: 'Install active harmonic filter at residential smart meter bus.',
      expectedOutcome: 'THD reduced below 5% within 2 simulation ticks.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Harmonic Filter', type: 'harmonic-filter',
          position: [-12, 0, 72], layer: 4,
          voltage: 1.0, status: 'optimal',
          filterRating: 15,
          description: 'Active harmonic filter suppressing EV and electronics THD.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: 'smartMeter_residential', to: id,
          voltageLevel: 'lv', resistance: 0.01, thermalLimit: 20,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,
        });
        store.getState().setDynamicEffect('harmonic_distortion', { harmonicFilter: true });
      },
    },
    {
      id: 'curtail_ev_charging',
      label: 'Curtail EV Charging',
      icon: '🚗',
      description: 'Reduce EV charging sessions to off-peak schedule.',
      expectedOutcome: 'EV draw drops, THD reduces by 2-3%.',
      execute(store) {
        store.getState().setDynamicEffect('harmonic_distortion', { evCurtailed: true });
      },
    },
  ],
};

// ── Case 8: Transformer Oil Overheating ───────────────────────────────────────
export const CASE_OIL_OVERHEAT = {
  id: 'oil_overheat',
  title: 'HV Transformer Oil Overheating',
  severity: 'critical',
  cooldownTicks: 200,
  detect(nodes) {
    return nodes.hvSubstation?.transformer_oil_temp_c > 78;
  },
  promptTemplate(state) {
    const hv = state.nodes.hvSubstation;
    return `CASE: HV Transformer oil temperature critical: ${hv?.transformer_oil_temp_c?.toFixed(1)}°C (limit 80°C). Tap position: ${hv?.tap_changer_position}. Load: ${state.simulation.totalLoad?.toFixed(1)} MW. Recommend thermal management.`;
  },
  availableActions: [
    {
      id: 'reduce_load_thermal',
      label: 'Reduce System Load',
      icon: '🌡️',
      description: 'Apply 10% system-wide demand response to reduce transformer stress.',
      expectedOutcome: 'Oil temp stabilises, begins cooling to <70°C.',
      execute(store) {
        const state = store.getState();
        const res  = state.nodes.smartMeter_residential?.baseDemand  ?? 18;
        const hosp = state.nodes.smartMeter_hospital?.baseDemand     ?? 12;
        store.getState().updateNodeParameter('smartMeter_residential', 'baseDemand', +(res  * 0.9).toFixed(1));
        store.getState().updateNodeParameter('smartMeter_hospital',    'baseDemand', +(hosp * 0.9).toFixed(1));
        store.getState().setDynamicEffect('oil_overheat', { loadReduced: true });
      },
    },
    {
      id: 'deploy_forced_cooling',
      label: 'Activate Forced Cooling',
      icon: '❄️',
      description: 'Deploy supplemental forced-oil cooling fans on HV transformer.',
      expectedOutcome: 'Oil cooling rate doubles, temp drops 8°C over time.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Forced Cooling', type: 'forced-cooling',
          position: [6, 0, -28], layer: 2,
          voltage: 1.0, status: 'optimal',
          coolingCapacityKW: 500,
          description: 'Supplemental forced-oil cooling unit for HV transformer.',
        });
        store.getState().setDynamicEffect('oil_overheat', { forcedCooling: true, coolingNodeId: id });
      },
    },
  ],
};

// ── Case 9: Generation-Load Imbalance ─────────────────────────────────────────
export const CASE_GEN_LOAD_IMBALANCE = {
  id: 'gen_load_imbalance',
  title: 'Generation–Load Imbalance',
  severity: 'critical',
  cooldownTicks: 60,
  detect(nodes, lines, simulation) {
    const imbalance = Math.abs((simulation.totalGeneration ?? 0) - (simulation.totalLoad ?? 0));
    const ratio     = simulation.totalLoad > 0 ? imbalance / simulation.totalLoad : 0;
    const freqDev   = Math.abs((simulation.gridFrequency ?? 50) - 50);
    return ratio > 0.12 && freqDev > 0.25;
  },
  promptTemplate(state) {
    const imb = Math.abs((state.simulation.totalGeneration - state.simulation.totalLoad)).toFixed(1);
    return `CASE: Generation-Load Imbalance. Gap: ${imb} MW (${((imb / state.simulation.totalLoad) * 100).toFixed(1)}%). Frequency: ${state.simulation.gridFrequency?.toFixed(3)} Hz. Coal RPM: ${state.nodes.coalPlant?.generator_rpm?.toFixed(0)}. Gas spinning reserve: ${state.nodes.gasStabilizer?.spinning_reserve_mw} MW. Recommend balancing action.`;
  },
  availableActions: [
    {
      id: 'activate_spinning_reserve',
      label: 'Activate Spinning Reserve',
      icon: '⚡',
      description: 'Dispatch Gas Peaker spinning reserve immediately.',
      expectedOutcome: 'Up to 60 MW injected, frequency recovers to 50 Hz.',
      execute(store) {
        store.getState().updateNodeParameter('gasStabilizer', 'isStandby', false);
        store.getState().setDynamicEffect('gen_load_imbalance', { gasPeakerActive: true });
      },
    },
    {
      id: 'demand_response_imbalance',
      label: 'Trigger Demand Response',
      icon: '📉',
      description: 'Auto-reduce residential and hospital base demand by 15%.',
      expectedOutcome: 'Load reduces ~5 MW, imbalance narrows.',
      execute(store) {
        const state = store.getState();
        const res  = state.nodes.smartMeter_residential?.baseDemand ?? 18;
        const hosp = state.nodes.smartMeter_hospital?.baseDemand    ?? 12;
        store.getState().updateNodeParameter('smartMeter_residential', 'baseDemand', +(res  * 0.85).toFixed(1));
        store.getState().updateNodeParameter('smartMeter_hospital',    'baseDemand', +(hosp * 0.85).toFixed(1));
        store.getState().setDynamicEffect('gen_load_imbalance', { demandResponse: true });
      },
    },
  ],
};

// ── Case 10: Phase Imbalance Critical ─────────────────────────────────────────
export const CASE_PHASE_IMBALANCE = {
  id: 'phase_imbalance',
  title: 'Critical Phase Imbalance',
  severity: 'warning',
  cooldownTicks: 180,
  detect(nodes) {
    return (
      nodes.zoneSub_north?.phase_imbalance_percent > 4 ||
      nodes.zoneSub_east?.phase_imbalance_percent  > 4 ||
      nodes.zoneSub_west?.phase_imbalance_percent  > 4
    );
  },
  promptTemplate(state) {
    const n = state.nodes.zoneSub_north?.phase_imbalance_percent?.toFixed(2);
    const e = state.nodes.zoneSub_east?.phase_imbalance_percent?.toFixed(2);
    const w = state.nodes.zoneSub_west?.phase_imbalance_percent?.toFixed(2);
    return `CASE: Phase Imbalance Critical. North: ${n}%, East: ${e}%, West: ${w}%. Time of day: ${state.simulation.timeOfDay?.toFixed(1)}h (evening peak). Recommend rebalancing.`;
  },
  availableActions: [
    {
      id: 'deploy_phase_balancer',
      label: 'Deploy Phase Balancer',
      icon: '⚖️',
      description: 'Install static VAR compensator / phase balancer at worst zone.',
      expectedOutcome: 'Phase imbalance reduced below 2% within 5 ticks.',
      execute(store) {
        const state = store.getState();
        // Find worst zone
        const zones = ['zoneSub_north', 'zoneSub_east', 'zoneSub_west'];
        const worst = zones.reduce((a, b) =>
          (state.nodes[a]?.phase_imbalance_percent ?? 0) > (state.nodes[b]?.phase_imbalance_percent ?? 0) ? a : b
        );
        const base = state.nodes[worst]?.position || [0, 0, 0];
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Phase Balancer', type: 'phase-balancer',
          position: offsetPosition(base, -5, 5),
          layer: 3, voltage: 1.0, status: 'optimal',
          description: 'Static VAR compensator balancing three-phase loading.',
        });
        store.getState().addDynamicLine({
          id: `line_${id}`, from: worst, to: id,
          voltageLevel: 'dist', resistance: 0.02, thermalLimit: 20,
          currentFlow: 0, loadRatio: 0, status: 'optimal', powerFlowDirection: 1,
        });
        store.getState().setDynamicEffect('phase_imbalance', { phaseBalancer: true, attachedTo: worst });
      },
    },
  ],
};

// ── Master case list ──────────────────────────────────────────────────────────
export const ALL_CASES = [
  CASE_TRANSFORMER_OVERLOAD,
  CASE_VOLTAGE_COLLAPSE,
  CASE_INDUSTRIAL_SURGE,
  CASE_SOLAR_RAMP,
  CASE_CYBER_INTRUSION,
  CASE_RMU_FAULT,
  CASE_HARMONICS,
  CASE_OIL_OVERHEAT,
  CASE_GEN_LOAD_IMBALANCE,
  CASE_PHASE_IMBALANCE,
];
