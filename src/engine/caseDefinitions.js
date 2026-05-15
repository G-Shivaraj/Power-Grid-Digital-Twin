/**
 * caseDefinitions.js — 5 Core Real-World Grid Failure Cases
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
    }
  ],
};

// ── Case 2: Industrial Surge Overload ─────────────────────────────────────────
export const CASE_INDUSTRIAL_SURGE = {
  id: 'industrial_surge',
  title: 'Industrial Surge Overload',
  severity: 'critical',
  cooldownTicks: 60,
  detect(nodes, lines, simulation) {
    const hi = nodes.heavyIndustry;
    const freqDev = Math.abs((simulation.gridFrequency ?? 50) - 50);
    return simulation.surgeEventActive && hi?.activePower > 35;
  },
  promptTemplate(state) {
    const hi = state.nodes.heavyIndustry;
    return `CASE: Industrial Surge Overload. Heavy Industry drawing ${hi?.activePower?.toFixed(1)} MW (rated 28 MW). Power factor: ${hi?.power_factor_ratio?.toFixed(2)}. Frequency deviation: ${Math.abs((state.simulation.gridFrequency - 50)).toFixed(3)} Hz. Recommend curtailment strategy.`;
  },
  availableActions: [
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
    }
  ],
};

// ── Case 3: Solar Intermittency Ramp ─────────────────────────────────────────
export const CASE_SOLAR_RAMP = {
  id: 'solar_ramp',
  title: 'Solar Intermittency Ramp',
  severity: 'warning',
  cooldownTicks: 120,
  detect(nodes, lines, simulation, state) {
    if (state?.dynamicEffects?.solar_ramp?.bess) return false;
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
    }
  ],
};

// ── Case 4: SCADA Cyber Intrusion ─────────────────────────────────────────────
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
      id: 'deploy_backup_rtu',
      label: 'Deploy Backup RTU',
      icon: '📡',
      description: 'Bring hardened backup Remote Terminal Unit online.',
      expectedOutcome: 'Secure telemetry restored with encrypted channel. Intrusion cleared.',
      execute(store) {
        const id = makeId();
        store.getState().addDynamicNode({
          id, label: 'Backup RTU', type: 'backup-rtu',
          position: [6, 0, -28], layer: 2,
          voltage: 1.0, status: 'optimal',
          description: 'Hardened backup RTU with IEC 62351 encryption active.',
        });
        store.getState().clearCyberIntrusion();
        store.getState().setDynamicEffect('cyber_intrusion', { backupRTU: true });
      },
    }
  ],
};

// ── Case 5: RMU Fault + Feeder Isolation ─────────────────────────────────────
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
        store.getState().clearFault();
        store.getState().setDynamicEffect('rmu_fault', { bypassSwitch: true });
      },
    }
  ],
};

// ── Master case list ──────────────────────────────────────────────────────────
export const ALL_CASES = [
  CASE_TRANSFORMER_OVERLOAD,
  CASE_INDUSTRIAL_SURGE,
  CASE_SOLAR_RAMP,
  CASE_CYBER_INTRUSION,
  CASE_RMU_FAULT,
];
