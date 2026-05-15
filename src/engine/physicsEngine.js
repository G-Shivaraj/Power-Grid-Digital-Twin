/**
 * Physics Engine — 5-Layer City Power Grid
 *
 * Key equations:
 *   Apparent Power:  S = √(P² + Q²)  [MVA]
 *   Power Factor:    cos(θ) = P / S
 *   Voltage Drop:    ΔV ≈ (P·R + Q·X) / V²  [per-unit]
 *   Conductor Temp:  T = T_ambient + I²·R_thermal  (Joule heating)
 *   Line Sag:        sag ∝ thermal expansion coefficient × ΔT
 *   Generator Hz:    f = (RPM × poles) / 120
 */

const S_BASE = 300;       // MVA — system base
const RPM_SYNC = 3000;    // RPM for 50Hz (2-pole machine)
const POLES = 2;

// ── Solar irradiance curve ────────────────────────────────────────────────────
export function computeSolarOutput(timeOfDay, maxSolarMW, solarOutputPercent = 100) {
  if (timeOfDay < 6 || timeOfDay > 19) return 0;
  const raw = Math.sin((Math.PI * (timeOfDay - 6)) / 13);
  return Math.max(0, raw * maxSolarMW * (solarOutputPercent / 100));
}

// ── EV charging demand — spikes 17:00–22:00 ──────────────────────────────────
function computeEVChargingDraw(timeOfDay) {
  if (timeOfDay >= 17 && timeOfDay <= 22) {
    const peak = Math.sin(Math.PI * (timeOfDay - 17) / 5);
    return peak * 1.2; // MW additional
  }
  return 0;
}

// ── Voltage status thresholds ─────────────────────────────────────────────────
function voltageStatus(v) {
  if (v >= 0.95) return 'optimal';
  if (v >= 0.88) return 'stressed';
  return 'failed';
}

function lineStatus(ratio) {
  if (ratio <= 0.75) return 'optimal';
  if (ratio <= 0.95) return 'stressed';
  return 'failed';
}

// ── Conductor temperature (I² Joule heating model) ───────────────────────────
function computeConductorTemp(loadRatio, ambientTemp = 40) {
  return ambientTemp + loadRatio * loadRatio * 55;
}

// ── Line sag from thermal expansion ──────────────────────────────────────────
function computeLineSag(conductorTemp) {
  const alpha = 23e-6; // Al expansion coefficient /°C
  const deltaT = Math.max(0, conductorTemp - 20);
  return parseFloat((6.0 * (1 + alpha * deltaT * 80)).toFixed(2));
}

// ── Transformer oil temperature (thermal lag model) ───────────────────────────
function computeOilTemp(loadRatio, prevOilTemp, ambientTemp = 35) {
  const targetTemp = ambientTemp + loadRatio * loadRatio * 90;
  return parseFloat((prevOilTemp + (targetTemp - prevOilTemp) * 0.06).toFixed(2));
}

// ── Tap changer position (regulates output voltage) ───────────────────────────
function computeTapPosition(loadRatio) {
  if (loadRatio < 0.4) return -2;
  if (loadRatio < 0.6) return 0;
  if (loadRatio < 0.75) return 2;
  if (loadRatio < 0.90) return 4;
  return 6;
}

// ── Phase imbalance (worse under uneven single-phase loads) ──────────────────
function computePhaseImbalance(loadRatio, timeOfDay) {
  const eveningFactor = (timeOfDay >= 18 && timeOfDay <= 22) ? 1.8 : 1.0;
  return parseFloat((0.5 + loadRatio * 3.2 * eveningFactor).toFixed(2));
}

// ── Generator RPM (governor response to load-gen delta) ──────────────────────
function computeGeneratorRPM(imbalancePct, prevRPM) {
  const target = RPM_SYNC * (1 - imbalancePct * 0.12);
  return parseFloat(Math.max(2750, Math.min(3200, prevRPM + (target - prevRPM) * 0.18)).toFixed(1));
}

// ── Fault current in RMU (spikes when downstream fault) ──────────────────────
function computeFaultCurrent(loadRatio, faultActive) {
  if (faultActive) return parseFloat((3200 + Math.random() * 800).toFixed(0));
  return parseFloat((loadRatio * 420 + Math.random() * 20).toFixed(0));
}

// ── Lifespan decay from overload ──────────────────────────────────────────────
function decayLifespan(currentDays, saturationPct) {
  if (saturationPct > 100) {
    const overloadFactor = (saturationPct - 100) / 100;
    return Math.max(0, currentDays - overloadFactor * 0.4);
  }
  return currentDays;
}

// ── Harmonic distortion (EV charging + cheap electronics) ────────────────────
function computeHarmonics(baseHarmonic, evMW, timeOfDay) {
  const evFactor = evMW * 1.8;
  const nightFactor = (timeOfDay >= 20 && timeOfDay <= 23) ? 1.4 : 1.0;
  return parseFloat(Math.min(12.0, baseHarmonic + evFactor + (nightFactor - 1)).toFixed(2));
}

// ── Main physics tick ─────────────────────────────────────────────────────────
export function runPhysicsTick(state) {
  const { nodes, lines, simulation } = state;
  const { timeOfDay, tick, surgeEventActive } = simulation;
  const RF = 5;

  // ─── Dynamic effects from case engine ────────────────────────────────────
  const fx = state.dynamicEffects || {};
  const gasPeakerForced  = fx.voltage_collapse?.gasPeakerActive || fx.solar_ramp?.gasPeakerActive || fx.gen_load_imbalance?.gasPeakerActive || false;
  const capacitorSupport = fx.voltage_collapse?.capacitorBank ? 20 : 0;    // MVAR
  const harmonicFilter   = fx.harmonic_distortion?.harmonicFilter ? 4.0 : 0; // THD reduction %
  const forcedCooling    = fx.oil_overheat?.forcedCooling ? 0.12 : 0;       // cooling factor
  const demandRespFactor = (fx.transformer_overload?.demandResponse || fx.gen_load_imbalance?.demandResponse || fx.oil_overheat?.loadReduced) ? 0.85 : 1.0;
  const industryLimit    = fx.industrial_surge?.loadLimiter ? 30 : null;    // MW cap
  const evCurtailed      = fx.harmonic_distortion?.evCurtailed ? true : false;
  const phaseBalancer    = fx.phase_imbalance?.phaseBalancer ? 0.5 : 1.0;   // imbalance multiplier
  const parallelTX       = fx.transformer_overload?.parallelTransformer ? 0.55 : 1.0; // load share

  // ─── Layer 1: Generation ──────────────────────────────────────────────────
  const sf    = nodes.solarFarm;
  const coal  = nodes.coalPlant;
  const gas   = nodes.gasStabilizer;

  const solarMW = computeSolarOutput(timeOfDay, sf.maxSolarOutput, sf.solarOutputPercent);

  // ─── Layer 4: Load computation ────────────────────────────────────────────
  const smRes  = nodes.smartMeter_residential;
  const smHosp = nodes.smartMeter_hospital;
  const hi     = nodes.heavyIndustry;

  const timeVariation = 1 + 0.28 * Math.sin(Math.PI * (timeOfDay - 7) / 12);
  const resDemandBase = smRes.baseDemand * timeVariation * demandRespFactor;
  const evMW = evCurtailed ? 0 : computeEVChargingDraw(timeOfDay);
  const resDemand = resDemandBase + evMW;
  const hospDemand = smHosp.baseDemand * (1 + 0.06 * Math.sin(Math.PI * timeOfDay / 12)) * demandRespFactor;

  const industryBaseMW = hi.heavy_machinery_load_kw / 1000;
  let industryDemand = surgeEventActive ? industryBaseMW * 1.65 : industryBaseMW;
  if (industryLimit !== null) industryDemand = Math.min(industryDemand, industryLimit);
  const industryPF = hi.power_factor_ratio;
  const industryQ  = industryDemand * Math.tan(Math.acos(Math.max(0.5, Math.min(0.999, industryPF))));

  const totalLoad = resDemand + hospDemand + industryDemand;

  // Coal fills the gap; gas picks up overflow (or forced by case engine)
  const coalRequired = Math.max(0, totalLoad - solarMW);
  const coalMW = Math.min(coal.maxCapacity, coalRequired);
  const gasMWBase = Math.max(0, coalRequired - coal.maxCapacity);
  const gasMW  = gasPeakerForced ? Math.max(gasMWBase, Math.min(gas.spinning_reserve_mw ?? 60, totalLoad * 0.3)) : gasMWBase;
  const totalGeneration = solarMW + coalMW + gasMW;

  const imbalancePct = totalLoad > 0 ? (totalLoad - totalGeneration) / totalLoad : 0;
  const coalRPM = computeGeneratorRPM(imbalancePct, coal.generator_rpm);
  const gridFrequency = parseFloat(((coalRPM * POLES) / 120).toFixed(4));

  // Apparent power on coal line: S = √(P²+Q²)
  const coalQ  = coalMW * 0.22; // typical 0.22 MVAR/MW for coal plant
  const coalS  = Math.sqrt(coalMW ** 2 + coalQ ** 2);

  // ─── Layer 2: HV Substation ───────────────────────────────────────────────
  const hvSub = nodes.hvSubstation;
  const hvLoad = totalLoad;
  const hvLoadRatio = Math.min(2.0, hvLoad / S_BASE);

  const oilTempBase = computeOilTemp(hvLoadRatio, hvSub.transformer_oil_temp_c);
  // Apply forced cooling effect
  const oilTemp = forcedCooling > 0 ? parseFloat(Math.max(65, oilTempBase - forcedCooling * 50).toFixed(1)) : oilTempBase;
  const tapPos  = computeTapPosition(hvLoadRatio);

  // Cyber intrusion: low probability event under stress
  let cyberFlag = hvSub.cyber_intrusion_flag;
  if (hvLoadRatio > 0.55 && Math.random() < 0.0004) cyberFlag = true;
  if (cyberFlag && Math.random() < 0.003) cyberFlag = false;

  // HV bus voltage (tap changer partially compensates for voltage drop)
  const vHV = parseFloat(Math.max(0.92, Math.min(1.05,
    1.0 + tapPos * 0.004 - hvLoadRatio * 0.04
  )).toFixed(4));

  // Outgoing kV (nominal 33kV adjusted by tap)
  const outgoingKV = parseFloat((33.0 * (1 + tapPos * 0.004)).toFixed(2));

  // ─── Layer 3: Zone Substations ────────────────────────────────────────────
  const R_north = lines.find(l => l.id === 'sub-zone-north')?.resistance ?? 0.04;
  const R_east  = lines.find(l => l.id === 'sub-zone-east')?.resistance  ?? 0.05;
  const R_west  = lines.find(l => l.id === 'sub-zone-west')?.resistance  ?? 0.04;

  const northLoad = resDemand * 0.50 + hospDemand * 0.20;
  const eastLoad  = hospDemand * 0.80 + resDemand * 0.25;
  const westLoad  = industryDemand * 0.55 + resDemand * 0.25;

  // Capacitor bank provides reactive support — boosts voltage at North zone
  const capBoost = capacitorSupport > 0 ? (capacitorSupport / S_BASE) * 0.015 : 0;
  const vNorth = parseFloat(Math.max(0.60, vHV - (northLoad / S_BASE) * R_north * RF + capBoost).toFixed(4));
  const vEast  = parseFloat(Math.max(0.60, vHV - (eastLoad  / S_BASE) * R_east  * RF).toFixed(4));
  const vWest  = parseFloat(Math.max(0.60, vHV - (westLoad  / S_BASE) * R_west  * RF).toFixed(4));

  const northPhase = computePhaseImbalance(northLoad / 80, timeOfDay) * phaseBalancer;
  const eastPhase  = computePhaseImbalance(eastLoad  / 80, timeOfDay);
  const westPhase  = computePhaseImbalance(westLoad  / 80, timeOfDay);

  // Self-healing: if North collapses, ring tie carries load from East
  const northFaulted = vNorth < 0.88;
  const selfHealingActive = northFaulted;
  const vNorthHealed = selfHealingActive
    ? parseFloat(Math.max(0.88, vEast - 0.02).toFixed(4))
    : vNorth;

  // ─── Layer 3: RMUs ────────────────────────────────────────────────────────
  const rmuNorthFaultCurrent = computeFaultCurrent(northLoad / 40, northFaulted);
  const rmuEastFaultCurrent  = computeFaultCurrent(eastLoad  / 40, false);
  const rmuNorthIsolated = northFaulted;
  const rmuNorthLatency  = parseFloat((8 + Math.random() * 18).toFixed(1));
  const rmuEastLatency   = parseFloat((5 + Math.random() * 12).toFixed(1));

  // ─── Layer 3 → 4: Voltage at distribution transformers ───────────────────
  const R_rmuN = lines.find(l => l.id === 'north-rmu-n')?.resistance ?? 0.06;
  const R_rmuE = lines.find(l => l.id === 'east-rmu-e')?.resistance  ?? 0.06;
  const R_alphaLine = lines.find(l => l.id === 'rmu-n-alpha')?.resistance ?? 0.07;
  const R_betaLine  = lines.find(l => l.id === 'rmu-e-beta')?.resistance  ?? 0.07;

  const vRmuNorth = parseFloat(Math.max(0.60, vNorthHealed - (northLoad / S_BASE) * R_rmuN * RF).toFixed(4));
  const vRmuEast  = parseFloat(Math.max(0.60, vEast        - (eastLoad  / S_BASE) * R_rmuE  * RF).toFixed(4));

  const vAlpha = parseFloat(Math.max(0.60, vRmuNorth - (resDemand  / S_BASE) * R_alphaLine * RF).toFixed(4));
  const vBeta  = parseFloat(Math.max(0.60, vRmuEast  - (hospDemand / S_BASE) * R_betaLine  * RF).toFixed(4));

  // ─── Layer 4: Edge devices ────────────────────────────────────────────────
  const R_alphaLV = lines.find(l => l.id === 'alpha-res')?.resistance  ?? 0.10;
  const R_betaLV  = lines.find(l => l.id === 'beta-hosp')?.resistance  ?? 0.08;

  const vResidential = parseFloat(Math.max(0.60, vAlpha - (resDemand  / S_BASE) * R_alphaLV * RF).toFixed(4));
  const vHospital    = parseFloat(Math.max(0.60, vBeta  - (hospDemand / S_BASE) * R_betaLV  * RF).toFixed(4));

  // Net metering: negative when solar exports exceed consumption
  const solarExportMW = Math.max(0, solarMW - (resDemand * 0.4));
  const netMeteringKW = solarExportMW > 0.5
    ? -(solarExportMW * 1000 * 0.6)
    : smRes.baseDemand * 1000 * 0.7;
  const harmonicRes  = Math.max(0, computeHarmonics(2.1, evMW, timeOfDay) - harmonicFilter);
  const harmonicHosp = computeHarmonics(5.8, 0.18, timeOfDay);

  // Load saturation — parallel transformer halves the effective load
  const alphaLoadSat = parseFloat(Math.min(150, (resDemand / 20) * 100 * parallelTX).toFixed(1));
  const betaLoadSat  = parseFloat(Math.min(150, (hospDemand / 14) * 100).toFixed(1));

  // Lifespan decay
  const dtAlpha = nodes.distTransformer_alpha;
  const dtBeta  = nodes.distTransformer_beta;
  const newAlphaLifespan = decayLifespan(dtAlpha.estimated_lifespan_remaining_days, alphaLoadSat);
  const newBetaLifespan  = decayLifespan(dtBeta.estimated_lifespan_remaining_days, betaLoadSat);

  // Heavy industry apparent power S = √(P²+Q²)
  const industryS = Math.sqrt(industryDemand ** 2 + industryQ ** 2);

  //  // Fault detection (suppress during tick 1 warmup) ─────────────────────────
  const allVoltages = [vHV, vNorthHealed, vEast, vWest, vAlpha, vBeta, vResidential, vHospital];
  const faultActive = tick > 1 && (allVoltages.some(v => v < 0.88) || cyberFlag);
  let faultDetails = null;
  if (faultActive) {
    const minV = Math.min(...allVoltages);
    faultDetails = {
      type: cyberFlag ? 'cyber-intrusion' : northFaulted ? 'voltage-collapse' : 'overload',
      minVoltage: minV.toFixed(3),
      selfHealingEngaged: selfHealingActive,
      industryLoad: industryDemand.toFixed(1),
      totalLoad: totalLoad.toFixed(1),
      surgeActive: surgeEventActive,
    };
  }

  const voltageAvg = allVoltages.reduce((a, b) => a + b, 0) / allVoltages.length;

  // ─── Build updated nodes ───────────────────────────────────────────────────
  const newNodes = {
    ...nodes,

    // Layer 1
    coalPlant: {
      ...coal,
      generator_rpm: coalRPM,
      active_power_mw: parseFloat(coalMW.toFixed(2)),
      reactive_power_mvar: parseFloat(coalQ.toFixed(2)),
      spinning_reserve_mw: parseFloat((coal.maxCapacity - coalMW).toFixed(1)),
      voltage: 1.0,
      status: coalMW > coal.maxCapacity * 0.95 ? 'stressed' : 'optimal',
    },
    solarFarm: {
      ...sf,
      active_power_mw: parseFloat(solarMW.toFixed(2)),
      reactive_power_mvar: 0,
      solarOutput: solarMW,
      voltage: 1.0,
      status: 'optimal',
    },
    gasStabilizer: {
      ...gas,
      active_power_mw: parseFloat(gasMW.toFixed(2)),
      reactive_power_mvar: parseFloat((gasMW * 0.15).toFixed(2)),
      isStandby: gasMW < 1,
      voltage: 1.0,
      status: gasMW > 0 ? 'stressed' : 'optimal',
    },

    // Layer 2
    hvSubstation: {
      ...hvSub,
      transformer_oil_temp_c: oilTemp,
      tap_changer_position: tapPos,
      outgoing_voltage_kv: outgoingKV,
      cyber_intrusion_flag: cyberFlag,
      voltage: vHV,
      activePower: parseFloat(hvLoad.toFixed(2)),
      reactivePower: parseFloat((industryQ + hospDemand * 0.3).toFixed(2)),
      status: cyberFlag ? 'failed' : voltageStatus(vHV),
    },
    heavyIndustry: {
      ...hi,
      activePower: parseFloat(industryDemand.toFixed(2)),
      reactivePower: parseFloat(industryQ.toFixed(2)),
      voltage: parseFloat(Math.max(0.60, vWest - 0.02).toFixed(4)),
      status: voltageStatus(Math.max(0.60, vWest - 0.02)),
    },

    // Layer 3
    zoneSub_north: {
      ...nodes.zoneSub_north,
      feeder_breaker_status: selfHealingActive ? 'TRIPPED' : 'CLOSED',
      phase_imbalance_percent: northPhase,
      activePower: parseFloat(northLoad.toFixed(2)),
      voltage: vNorthHealed,
      status: selfHealingActive ? 'stressed' : voltageStatus(vNorthHealed),
    },
    zoneSub_east: {
      ...nodes.zoneSub_east,
      feeder_breaker_status: 'CLOSED',
      phase_imbalance_percent: eastPhase,
      activePower: parseFloat(eastLoad.toFixed(2)),
      voltage: vEast,
      status: voltageStatus(vEast),
    },
    zoneSub_west: {
      ...nodes.zoneSub_west,
      feeder_breaker_status: 'CLOSED',
      phase_imbalance_percent: westPhase,
      activePower: parseFloat(westLoad.toFixed(2)),
      voltage: vWest,
      status: voltageStatus(vWest),
    },
    rmu_north: {
      ...nodes.rmu_north,
      fault_current_detected_amps: rmuNorthFaultCurrent,
      isolation_switch_state: rmuNorthIsolated,
      telemetry_latency_ms: rmuNorthLatency,
      voltage: vRmuNorth,
      status: rmuNorthIsolated ? 'stressed' : voltageStatus(vRmuNorth),
    },
    rmu_east: {
      ...nodes.rmu_east,
      fault_current_detected_amps: rmuEastFaultCurrent,
      isolation_switch_state: false,
      telemetry_latency_ms: rmuEastLatency,
      voltage: vRmuEast,
      status: voltageStatus(vRmuEast),
    },

    // Layer 4
    distTransformer_alpha: {
      ...dtAlpha,
      load_saturation_percent: alphaLoadSat,
      estimated_lifespan_remaining_days: Math.floor(newAlphaLifespan),
      voltage: vAlpha,
      activePower: parseFloat(resDemand.toFixed(2)),
      status: alphaLoadSat > 100 ? 'stressed' : voltageStatus(vAlpha),
    },
    distTransformer_beta: {
      ...dtBeta,
      load_saturation_percent: betaLoadSat,
      estimated_lifespan_remaining_days: Math.floor(newBetaLifespan),
      voltage: vBeta,
      activePower: parseFloat(hospDemand.toFixed(2)),
      status: betaLoadSat > 100 ? 'stressed' : voltageStatus(vBeta),
    },
    smartMeter_residential: {
      ...smRes,
      net_metering_kw: parseFloat(netMeteringKW.toFixed(0)),
      ev_charging_draw_kw: parseFloat((evMW * 1000).toFixed(0)),
      harmonic_distortion_percent: harmonicRes,
      voltage: vResidential,
      activePower: parseFloat(resDemand.toFixed(2)),
      status: voltageStatus(vResidential),
    },
    smartMeter_hospital: {
      ...smHosp,
      net_metering_kw: smHosp.net_metering_kw,
      ev_charging_draw_kw: 180,
      harmonic_distortion_percent: harmonicHosp,
      voltage: vHospital,
      activePower: parseFloat(hospDemand.toFixed(2)),
      status: voltageStatus(vHospital),
    },
  };

  // ─── Build updated lines ──────────────────────────────────────────────────
  const lineFlowMap = {
    'hv-coal-sub':   { flow: coalMW,       dir: 1,   P: coalMW,        Q: coalQ,        isHV: true },
    'hv-solar-sub':  { flow: solarMW,      dir: solarMW > 0 ? -1 : 0, P: solarMW, Q: 0, isHV: true },
    'hv-gas-sub':    { flow: gasMW,        dir: gasMW > 0 ? 1 : 0,    P: gasMW,   Q: gasMW * 0.15, isHV: true },
    'sub-zone-north':{ flow: northLoad,    dir: 1 },
    'sub-zone-east': { flow: eastLoad,     dir: 1 },
    'sub-zone-west': { flow: westLoad,     dir: 1 },
    'sub-industry':  { flow: industryDemand, dir: 1 },
    'north-rmu-n':   { flow: northLoad,    dir: 1 },
    'east-rmu-e':    { flow: eastLoad,     dir: 1 },
    'ring-tie':      { flow: selfHealingActive ? northLoad * 0.6 : 0, dir: selfHealingActive ? -1 : 0 },
    'rmu-ring-tie':  { flow: selfHealingActive ? northLoad * 0.4 : 0, dir: selfHealingActive ? -1 : 0 },
    'rmu-n-alpha':   { flow: resDemand,    dir: 1 },
    'rmu-e-beta':    { flow: hospDemand,   dir: 1 },
    'alpha-res':     { flow: resDemand,    dir: 1 },
    'beta-hosp':     { flow: hospDemand,   dir: 1 },
  };

  const newLines = lines.map(line => {
    const lf = lineFlowMap[line.id] || { flow: 0, dir: 1 };
    const flow = lf.flow;
    const P = lf.P ?? flow;
    const Q = lf.Q ?? flow * 0.18;
    const apparentPower = lf.isHV ? Math.sqrt(P ** 2 + Q ** 2) : undefined;
    const ratio = Math.min(2.0, flow / line.thermalLimit);
    const conductorTemp = line.conductor_temp_celsius !== undefined
      ? computeConductorTemp(ratio, 40)
      : undefined;
    const lineSag = conductorTemp !== undefined
      ? computeLineSag(conductorTemp)
      : undefined;
    return {
      ...line,
      currentFlow: parseFloat(flow.toFixed(2)),
      loadRatio: parseFloat(ratio.toFixed(3)),
      status: lineStatus(ratio),
      powerFlowDirection: lf.dir,
      ...(apparentPower !== undefined && { apparent_power_mva: parseFloat(apparentPower.toFixed(2)) }),
      ...(conductorTemp !== undefined && { conductor_temp_celsius: parseFloat(conductorTemp.toFixed(1)) }),
      ...(lineSag !== undefined && { line_sag_meters: lineSag }),
    };
  });

  return {
    nodes: newNodes,
    lines: newLines,
    tick: tick + 1,
    totalLoad: parseFloat(totalLoad.toFixed(2)),
    totalGeneration: parseFloat(totalGeneration.toFixed(2)),
    gridFrequency,
    coalRPM,
    faultActive,
    faultDetails,
    voltageAvg: parseFloat(voltageAvg.toFixed(4)),
    selfHealingActive,
    selfHealingLog: selfHealingActive
      ? `Ring tie active: East Zone re-energizing North sector at ${(vNorthHealed * 100).toFixed(1)}% V`
      : null,
    cyberIntrusionActive: cyberFlag,
  };
}
