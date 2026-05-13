/**
 * useLLMAdvisor — OpenRouter (gpt-4o-mini) integration
 * Updated for 5-Layer City Power Grid Digital Twin.
 * Mock falls back gracefully when no API key is configured.
 *
 * To enable real LLM: set VITE_OPENROUTER_API_KEY in a .env file.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are an expert Power Systems Engineer and AI Operations Advisor for a 5-Layer City Smart Grid Digital Twin.
The grid has 14 entities across 5 layers:
- Layer 1: Coal Plant, Solar Farm, Gas Peaker (Bulk Generation)
- Layer 2: HV Primary Substation (220kV/33kV), Heavy Industry Complex
- Layer 3: Zone Substations (33kV/11kV), Ring Main Units (self-healing)
- Layer 4: Distribution Transformers (11kV/400V), Smart Meters (Prosumers)

When analyzing a fault or cyber event, structure your response in exactly two parts:
1. **Fault Analysis** — 2-3 sentences explaining what happened (reference voltage levels, RMU isolation, harmonic distortion, oil temperatures, RPM deviations).
2. **Recommendation** — One specific operational fix with technical specs.

Be precise and technical. Reference specific node names, voltages, and layer designations from the telemetry data.`;
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildFaultPrompt(gridState) {
  const { nodes, lines, simulation } = gridState;

  const nodesSummary = Object.values(nodes).map(n => ({
    id: n.id,
    label: n.label,
    layer: n.layer,
    type: n.type,
    voltage_pu: n.voltage?.toFixed(3),
    status: n.status,
    ...(n.generator_rpm !== undefined && { generator_rpm: n.generator_rpm?.toFixed(0) }),
    ...(n.transformer_oil_temp_c !== undefined && { oil_temp_c: n.transformer_oil_temp_c?.toFixed(1) }),
    ...(n.cyber_intrusion_flag !== undefined && { cyber_intrusion: n.cyber_intrusion_flag }),
    ...(n.feeder_breaker_status !== undefined && { breaker: n.feeder_breaker_status }),
    ...(n.isolation_switch_state !== undefined && { rmu_isolated: n.isolation_switch_state }),
    ...(n.fault_current_detected_amps !== undefined && { fault_amps: n.fault_current_detected_amps }),
    ...(n.load_saturation_percent !== undefined && { load_sat_pct: n.load_saturation_percent?.toFixed(1) }),
    ...(n.net_metering_kw !== undefined && { net_metering_kw: n.net_metering_kw }),
    ...(n.harmonic_distortion_percent !== undefined && { thd_pct: n.harmonic_distortion_percent?.toFixed(2) }),
  }));

  const data = {
    timestamp: new Date().toISOString(),
    gridFrequency_Hz: simulation.gridFrequency?.toFixed(4),
    totalLoad_MW: simulation.totalLoad?.toFixed(1),
    totalGeneration_MW: simulation.totalGeneration?.toFixed(1),
    selfHealingActive: simulation.selfHealingActive,
    selfHealingLog: simulation.selfHealingLog,
    cyberIntrusionActive: simulation.cyberIntrusionActive,
    surgeEventActive: simulation.surgeEventActive,
    faultDetails: simulation.faultDetails,
    nodes: nodesSummary,
    criticalLines: lines
      .filter(l => l.status !== 'optimal')
      .map(l => ({ id: l.id, from: l.from, to: l.to, flow: l.currentFlow, limit: l.thermalLimit, ratio: l.loadRatio?.toFixed(2), status: l.status })),
  };

  return `CITY GRID FAULT DETECTED. Analyze the following 5-layer grid telemetry and provide diagnosis and recommendation:\n\n${JSON.stringify(data, null, 2)}`;
}

function buildCyberPrompt(gridState) {
  const { nodes, simulation } = gridState;
  const hvSub = nodes.hvSubstation;
  return `CYBER INTRUSION DETECTED at HV Primary Substation SCADA. Analyze the following telemetry:\n\n${JSON.stringify({
    hvSubstation: {
      cyber_intrusion_flag: hvSub?.cyber_intrusion_flag,
      transformer_oil_temp_c: hvSub?.transformer_oil_temp_c?.toFixed(1),
      tap_changer_position: hvSub?.tap_changer_position,
      outgoing_voltage_kv: hvSub?.outgoing_voltage_kv,
      voltage_pu: hvSub?.voltage?.toFixed(3),
    },
    gridFrequency_Hz: simulation.gridFrequency?.toFixed(4),
    totalLoad_MW: simulation.totalLoad?.toFixed(1),
    tick: simulation.tick,
  }, null, 2)}`;
}

// ── Mock responses ────────────────────────────────────────────────────────────
function getMockFaultResponse(gridState) {
  const { simulation, nodes } = gridState;
  const fd = simulation.faultDetails || {};
  const selfHealing = simulation.selfHealingActive;
  const minV = fd.minVoltage ?? '0.851';
  const rmu = nodes.rmu_north;
  const faultA = rmu?.fault_current_detected_amps?.toFixed(0) ?? '2840';

  if (selfHealing) {
    return {
      explanation: `**Fault Analysis:** A voltage collapse on the Northern zone (${minV} pu) triggered automatic self-healing. RMU North-A detected a fault current of ${faultA}A and has isolated the faulted 11kV segment. The ring tie between Zone Sub North and Zone Sub East is now active, re-energizing the affected area from the eastern supply path. The self-healing response time was under 150ms, demonstrating ANSI C37.90 compliant protection coordination.`,
      recommendation: `**Recommendation:** Dispatch maintenance crew to inspect the 11kV feeder between Zone Sub North and RMU North-A for physical conductor damage or insulation failure. After repair, re-close RMU North-A isolation switch to restore normal radial topology and release the ring tie. Verify Distribution Transformer α load saturation returns below 85% before reclosing.`,
    };
  }

  return {
    explanation: `**Fault Analysis:** Grid voltage has collapsed to ${minV} pu at the worst-case bus, ${fd.surgeActive ? 'triggered by an Industrial Surge Event pushing the Heavy Industry Complex to 165% of rated load' : 'due to excessive reactive power demand on the 33kV sub-transmission network'}. The Coal Plant RPM has deviated from 3000 RPM, indicating the governor is fighting load-gen imbalance. Zone substations report phase imbalance above 2% indicating uneven load distribution across three phases.`,
    recommendation: `**Recommendation:** ${fd.surgeActive ? 'Curtail the industrial surge load immediately and activate the Gas Peaker Plant spinning reserve (60MW available at 25 MW/min ramp rate)' : 'Activate the Gas Peaker spinning reserve to increase generation headroom and reduce load-gen imbalance'}. Also verify tap changer position at HV Primary Substation — raise by 2 tap positions (+0.8% voltage boost) to compensate for the voltage depression.`,
  };
}

function getMockCyberResponse() {
  return {
    explanation: `**Cyber Threat Analysis:** Unauthorized telemetry injection detected on the SCADA channel at the HV Primary Substation. The intrusion signature matches a Man-in-the-Middle (MitM) attack pattern targeting Modbus/DNP3 protocol packets. The attacker may be attempting to spoof tap changer position readings to induce an artificial under-voltage condition, masking a deliberate load shedding event. The IEC 62351 encryption layer has flagged 3 anomalous measurement frames in the last 500ms.`,
    recommendation: `**Recommendation:** Immediately isolate the SCADA communication channel to the HV Substation and switch to manual tap changer control. Deploy backup RTU encryption certificates and activate the cyber incident response protocol per NERC CIP-007. Alert the Operations Control Center and notify grid security team. Do NOT operate the tap changer remotely until the communication channel is re-authenticated.`,
  };
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function callLLMAdvisor(gridState, mode = 'fault') {
  const useMock = !API_KEY;

  if (useMock) {
    await new Promise(r => setTimeout(r, 1800));
    if (mode === 'cyber') return getMockCyberResponse();
    return getMockFaultResponse(gridState);
  }

  // ── Real OpenRouter call ──────────────────────────────────────────────────
  const userContent = mode === 'cyber'
    ? buildCyberPrompt(gridState)
    : buildFaultPrompt(gridState);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user',   content: userContent },
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Smart City Grid Digital Twin',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 600 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  const recMatch = text.match(/\*\*Recommendation[:\s]/i);
  if (recMatch) {
    const idx = text.indexOf(recMatch[0]);
    return {
      explanation: text.slice(0, idx).trim(),
      recommendation: text.slice(idx).trim(),
    };
  }
  return { explanation: text, recommendation: null };
}
