/**
 * Physics Engine — Simplified Per-Unit Power Flow
 *
 * Per-unit system:
 *   V_base = 33 kV,  S_base = 50 MVA
 *   Z_base = V_base² / S_base ≈ 21.78 Ω
 *
 * Voltage drop model (simplified):
 *   ΔV ≈ (P*R + Q*X) / V_base²   [in per-unit]
 *
 * Resistance values are given in per-unit (already normalised).
 * The key insight: with S_base=50 MVA, a 10 MW demand over a 0.05pu line
 * gives ΔV = 10/50 * 0.05 = 0.01 pu — very small. Scale is critical.
 *
 * We use: ΔV = (flow_MW / S_base_MVA) * resistance_pu
 * This keeps voltages in realistic 0.95–1.05 pu range for normal load,
 * and crashes to <0.88 pu when factory (35 MW) is added.
 */

const S_BASE = 50; // MVA

// ── Solar curve ───────────────────────────────────────────────────────────────
export function computeSolarOutput(timeOfDay, maxSolarMW, solarOutputPercent = 100) {
  const t = timeOfDay;
  if (t < 6 || t > 18) return 0;
  const raw = Math.sin((Math.PI * (t - 6)) / 12);
  return raw * maxSolarMW * (solarOutputPercent / 100);
}

// ── Status from voltage ───────────────────────────────────────────────────────
function voltageStatus(v) {
  if (v >= 0.95) return 'optimal';
  if (v >= 0.88) return 'stressed';
  return 'failed';
}

// ── Status from line loading ──────────────────────────────────────────────────
function lineStatus(ratio) {
  if (ratio <= 0.75) return 'optimal';
  if (ratio <= 0.95) return 'stressed';
  return 'failed';
}

// ── Voltage drop ──────────────────────────────────────────────────────────────
// ΔV = (P_MW / S_base) * R_pu
function vDrop(powerMW, resistance) {
  return (powerMW / S_BASE) * resistance;
}

// ── Main tick ─────────────────────────────────────────────────────────────────
export function runPhysicsTick(state) {
  const { nodes, lines, factory, capacitor, simulation } = state;
  const { timeOfDay, tick } = simulation;

  // 1. Solar generation
  const sf = nodes.solarFarm;
  const solarMW = computeSolarOutput(timeOfDay, sf.maxSolarOutput, sf.solarOutputPercent);

  // 2. Load demands
  const r1Demand = nodes.residential1.baseDemand;
  const r2Demand = nodes.residential2.baseDemand;
  const r3Demand = nodes.residential3.baseDemand;
  const factoryDemand = factory ? factory.industrialLoad : 0;
  const factoryPF = factory ? Math.max(0.1, factory.powerFactor) : 0.75;
  const factoryQ = factoryDemand * Math.tan(Math.acos(factoryPF));

  // Capacitor reactive support
  const capQ = capacitor ? capacitor.reactivePowerSupport : 0;
  // Capacitor provides voltage boost via reactive compensation
  // ΔV_cap = capQ / S_base * X_eff (simplified)
  const capVBoost = (capQ / S_BASE) * 6.5; // 5 MVAR → ~0.65 pu boost factor for full recovery

  // Total load and generation
  const totalLoad = r1Demand + r2Demand + r3Demand + factoryDemand;
  const netSubstation = Math.max(0, totalLoad - solarMW);
  const totalGeneration = netSubstation + solarMW;

  // 3. Per-unit line resistances
  const R_sub_r1    = lines.find(l => l.id === 'line-sub-r1')?.resistance    ?? 0.05;
  const R_sub_r2    = lines.find(l => l.id === 'line-sub-r2')?.resistance    ?? 0.06;
  const R_sub_solar = lines.find(l => l.id === 'line-sub-solar')?.resistance ?? 0.04;
  const R_solar_r3  = lines.find(l => l.id === 'line-solar-r3')?.resistance  ?? 0.03;
  const R_r1_r2     = lines.find(l => l.id === 'line-r1-r2')?.resistance     ?? 0.03;

  // Scale factor: resistance is in pu but 0.05 on a 50MVA base gives very small drops.
  // Multiply by 10 to get realistic drops (0.01 → 0.1 pu per 10 MW over 0.05R line).
  const RF = 10;

  // 4. Voltage at each bus (V_bus = 1.0 - Σ drops on path from substation)
  const vSub = 1.0; // slack bus

  // R1: path Sub → R1
  const r1Path = r1Demand + (factory ? factoryDemand * 0.35 : 0);
  const vR1 = vSub
    - vDrop(r1Path, R_sub_r1 * RF)
    + capVBoost * 0.35;

  // R2: path Sub → R2 (factory hangs off R2 path)
  const r2Path = r2Demand + (factory ? factoryDemand * 0.65 : 0);
  const r2QDrop = factory ? (factoryQ / S_BASE) * R_sub_r2 * RF * 0.8 : 0;
  const vR2 = vSub
    - vDrop(r2Path, R_sub_r2 * RF)
    - r2QDrop
    + capVBoost * 0.65;

  // R3: path Sub → SolarBus → R3 (solar partially supplies R3)
  const solarToR3 = Math.min(solarMW, r3Demand);
  const r3NetFromSub = Math.max(0, r3Demand - solarToR3);
  // Solar exports to bus: negative drop on sub→solar line
  const solarExport = Math.max(0, solarMW - r3Demand);
  const vSolarBus = vSub + vDrop(solarExport, R_sub_solar * RF * 0.5);
  const vR3 = vSolarBus - vDrop(r3Demand, R_solar_r3 * RF * 0.5) + capVBoost * 0.20;

  // Solar farm bus
  const vSolarFarm = Math.min(1.05, vSolarBus);

  // Factory bus (branch off R2)
  let vFactory = null;
  if (factory) {
    vFactory = Math.max(0.6, vR2 - (factoryQ / S_BASE) * R_sub_r2 * RF * 0.5 + capVBoost * 0.5);
  }

  // Grid frequency deviation from load-gen imbalance
  const imbalancePct = totalLoad > 0 ? (totalLoad - totalGeneration) / totalLoad : 0;
  const gridFrequency = Math.max(48, Math.min(52, 50.0 - imbalancePct * 2.5));

  // 5. Line flows
  const r1Flow = r1Path;
  const r2Flow = r2Path;
  const solarFlow = Math.abs(solarMW - r3NetFromSub);
  const solarFlowDir = solarMW > r3Demand ? -1 : 1;
  const r3Flow = solarToR3;
  const tieFlow = Math.abs(r1Flow - r2Flow) * 0.12;

  const newLines = lines.map(line => {
    let flow = 0, direction = line.powerFlowDirection;
    switch (line.id) {
      case 'line-sub-r1':    flow = r1Flow;   direction = 1; break;
      case 'line-sub-r2':    flow = r2Flow;   direction = 1; break;
      case 'line-sub-solar': flow = solarFlow; direction = solarFlowDir; break;
      case 'line-solar-r3':  flow = r3Flow;   direction = 1; break;
      case 'line-r1-r2':     flow = tieFlow;  direction = r1Flow > r2Flow ? 1 : -1; break;
    }
    const ratio = Math.min(flow / line.thermalLimit, 2.0);
    return { ...line, currentFlow: flow, loadRatio: ratio, status: lineStatus(ratio), powerFlowDirection: direction };
  });

  // 6. Clamp voltages to physical limits
  const vR1c = Math.max(0.6, Math.min(1.05, vR1));
  const vR2c = Math.max(0.6, Math.min(1.05, vR2));
  const vR3c = Math.max(0.6, Math.min(1.05, vR3));

  const newNodes = {
    ...nodes,
    substation: {
      ...nodes.substation,
      voltage: vSub,
      activePower: parseFloat(netSubstation.toFixed(2)),
      reactivePower: parseFloat((factoryQ - capQ).toFixed(2)),
      current: parseFloat((netSubstation / (vSub * 33)).toFixed(3)),
      status: 'optimal',
    },
    solarFarm: {
      ...nodes.solarFarm,
      voltage: Math.max(0.95, vSolarFarm),
      activePower: parseFloat(solarMW.toFixed(2)),
      solarOutput: solarMW,
      status: solarMW > sf.maxSolarOutput * 0.9 ? 'stressed' : 'optimal',
    },
    residential1: {
      ...nodes.residential1,
      voltage: vR1c,
      activePower: r1Demand,
      reactivePower: parseFloat((r1Demand * 0.33).toFixed(2)),
      actualDemand: r1Demand,
      status: voltageStatus(vR1c),
    },
    residential2: {
      ...nodes.residential2,
      voltage: vR2c,
      activePower: r2Demand,
      reactivePower: parseFloat((r2Demand * 0.33).toFixed(2)),
      actualDemand: r2Demand,
      status: voltageStatus(vR2c),
    },
    residential3: {
      ...nodes.residential3,
      voltage: vR3c,
      activePower: r3Demand,
      reactivePower: parseFloat((r3Demand * 0.33).toFixed(2)),
      actualDemand: r3Demand,
      status: voltageStatus(vR3c),
    },
  };

  // 7. Factory node update
  let newFactory = factory;
  if (factory && vFactory !== null) {
    newFactory = {
      ...factory,
      voltage: vFactory,
      activePower: factoryDemand,
      reactivePower: parseFloat(factoryQ.toFixed(2)),
      status: voltageStatus(vFactory),
    };
  }

  // 8. Fault detection (only when factory is present — base grid should be healthy)
  const allNodes = factory
    ? { ...newNodes, factory: newFactory }
    : newNodes;

  const failedNodes = Object.values(allNodes).filter(n => n.status === 'failed');
  const overloadedLines = newLines.filter(l => l.status === 'failed');
  const faultActive = factory !== null && (failedNodes.length > 0 || overloadedLines.length > 0);

  let faultDetails = null;
  if (faultActive) {
    const worstNode = [...failedNodes].sort((a, b) => a.voltage - b.voltage)[0];
    const worstLine = [...overloadedLines].sort((a, b) => b.loadRatio - a.loadRatio)[0];
    faultDetails = {
      primaryFaultNodeId: worstNode?.id,
      worstVoltage: worstNode?.voltage?.toFixed(3),
      worstLineId: worstLine?.id,
      worstLoadRatio: worstLine?.loadRatio?.toFixed(2),
      reactiveDeficit: parseFloat((factoryQ - capQ).toFixed(1)),
      failedNodeCount: failedNodes.length,
      overloadedLineCount: overloadedLines.length,
      factoryLoad: factoryDemand,
      totalLoad,
      totalGeneration,
    };
  }

  const voltageAvg = (
    newNodes.substation.voltage +
    newNodes.residential1.voltage +
    newNodes.residential2.voltage +
    newNodes.residential3.voltage
  ) / 4;

  return {
    nodes: newNodes,
    lines: newLines,
    factory: newFactory,
    tick: tick + 1,
    totalLoad,
    totalGeneration,
    gridFrequency,
    faultActive,
    faultDetails,
    voltageAvg,
  };
}
