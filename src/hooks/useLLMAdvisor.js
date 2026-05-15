/**
 * useLLMAdvisor.js — Case-aware LLM integration via OpenRouter
 * Returns structured JSON: { diagnosis, recommendedActionIds[], urgency, expectedImprovement }
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are an expert Power Systems Engineer and AI Operations Advisor for a 5-Layer City Smart Grid Digital Twin.

Grid layers:
- Layer 1: Coal Plant, Solar Farm, Gas Peaker (Bulk Generation)
- Layer 2: HV Primary Substation (220kV/33kV), Heavy Industry Complex
- Layer 3: Zone Substations (33kV/11kV), Ring Main Units (self-healing)
- Layer 4: Distribution Transformers (11kV/400V), Smart Meters (Prosumers)

You MUST respond ONLY with valid JSON matching this schema exactly:
{
  "diagnosis": "2-3 sentences explaining root cause with technical specifics (voltage pu, current A, temperature °C, frequency Hz)",
  "urgency": "immediate|soon|monitor",
  "recommendedActionIds": ["action_id_1", "action_id_2"],
  "expectedImprovement": "One sentence describing measurable metric improvement after solution applied"
}

Be precise. Reference specific node names, voltages, and measurements from the telemetry.`;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildCasePrompt(gridState, caseObj) {
  const { nodes, lines, simulation } = gridState;
  const telemetry = {
    gridFrequency_Hz: simulation.gridFrequency?.toFixed(4),
    totalLoad_MW: simulation.totalLoad?.toFixed(1),
    totalGeneration_MW: simulation.totalGeneration?.toFixed(1),
    selfHealingActive: simulation.selfHealingActive,
    cyberIntrusionActive: simulation.cyberIntrusionActive,
    surgeEventActive: simulation.surgeEventActive,
    keyNodes: Object.values(nodes).map(n => ({
      id: n.id, label: n.label, layer: n.layer,
      voltage_pu: n.voltage?.toFixed(3), status: n.status,
      ...(n.generator_rpm !== undefined && { generator_rpm: n.generator_rpm?.toFixed(0) }),
      ...(n.transformer_oil_temp_c !== undefined && { oil_temp_c: n.transformer_oil_temp_c?.toFixed(1) }),
      ...(n.cyber_intrusion_flag !== undefined && { cyber_intrusion: n.cyber_intrusion_flag }),
      ...(n.feeder_breaker_status !== undefined && { breaker: n.feeder_breaker_status }),
      ...(n.isolation_switch_state !== undefined && { rmu_isolated: n.isolation_switch_state }),
      ...(n.fault_current_detected_amps !== undefined && { fault_amps: n.fault_current_detected_amps }),
      ...(n.load_saturation_percent !== undefined && { load_sat_pct: n.load_saturation_percent?.toFixed(1) }),
      ...(n.harmonic_distortion_percent !== undefined && { thd_pct: n.harmonic_distortion_percent?.toFixed(2) }),
      ...(n.phase_imbalance_percent !== undefined && { phase_imbalance_pct: n.phase_imbalance_percent?.toFixed(2) }),
    })),
    stressedLines: lines.filter(l => l.status !== 'optimal').map(l => ({
      id: l.id, from: l.from, to: l.to,
      flow: l.currentFlow?.toFixed(1), limit: l.thermalLimit,
      ratio: l.loadRatio?.toFixed(2), status: l.status,
    })),
  };

  const actionIds = caseObj.availableActions.map(a => a.id).join(', ');
  return `${caseObj.promptTemplate(gridState)}

Available action IDs to choose from: [${actionIds}]

Full grid telemetry:
${JSON.stringify(telemetry, null, 2)}`;
}

// ── Mock responses (one per case) ─────────────────────────────────────────────
const MOCK_RESPONSES = {
  transformer_overload: {
    diagnosis: 'Distribution Transformer α has reached critical load saturation above 95%, driven by peak residential demand. Continued overloading will accelerate thermal degradation. The 11kV/400V transformer is operating beyond its rated thermal limit.',
    urgency: 'immediate',
    recommendedActionIds: ['deploy_parallel_transformer'],
    expectedImprovement: 'Load saturation on Transformer α drops safely below threshold and lifespan decay rate normalises.',
  },
  industrial_surge: {
    diagnosis: 'Heavy Industry Complex is drawing 165% of rated load during surge event, causing grid frequency to deviate below 49.85 Hz. The arc furnace reactive power demand (MVAR) has depressed the 33kV bus voltage.',
    urgency: 'immediate',
    recommendedActionIds: ['deploy_load_limiter'],
    expectedImprovement: 'Industry load returns to rated levels via a hard cap, and frequency recovers to 50.0 Hz range.',
  },
  solar_ramp: {
    diagnosis: 'North Solar Farm output has dropped below 40% of maximum capacity, creating a renewable generation shortfall. The Coal Plant is ramping to compensate but spinning reserve headroom is being consumed.',
    urgency: 'soon',
    recommendedActionIds: ['deploy_bess'],
    expectedImprovement: 'Generation gap bridged instantly by BESS discharge, restoring frequency stability.',
  },
  cyber_intrusion: {
    diagnosis: 'Unauthorized SCADA telemetry injection detected at HV Primary Substation matching a Man-in-the-Middle attack on DNP3 protocol. IEC 62351 encryption layer has flagged anomalous measurement frames.',
    urgency: 'immediate',
    recommendedActionIds: ['deploy_backup_rtu'],
    expectedImprovement: 'Cyber intrusion flag cleared, SCADA channel secured with encrypted backup RTU.',
  },
  rmu_fault: {
    diagnosis: 'RMU North-A has detected a fault current exceeding 2000A on the 11kV northern feeder, triggering automatic isolation. The self-healing ring tie has activated to re-energise affected customers.',
    urgency: 'immediate',
    recommendedActionIds: ['deploy_bypass_switch'],
    expectedImprovement: 'Normal radial topology restored pending physical repair via physical bypass switch.',
  },
};

// ── Main export ────────────────────────────────────────────────────────────────
export async function callLLMAdvisor(gridState, caseObj) {
  // Forced offline fallback for a flawless, token-free demo
  const useMock = true;

  if (useMock) {
    await new Promise(r => setTimeout(r, 1400 + Math.random() * 600));
    return MOCK_RESPONSES[caseObj.id] ?? MOCK_RESPONSES.transformer_overload;
  }

  // ── Real OpenRouter call ──────────────────────────────────────────────────
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildCasePrompt(gridState, caseObj) },
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Smart City Grid Digital Twin',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 500, response_format: { type: 'json_object' } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';

  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('LLM response was not valid JSON');
  }
}

// ── Legacy compatibility (used by App.jsx old flow) ───────────────────────────
export async function callLLMAdvisorLegacy(gridState, mode = 'fault') {
  const useMock = !API_KEY;
  if (useMock) {
    await new Promise(r => setTimeout(r, 1800));
    if (mode === 'cyber') {
      return {
        explanation: MOCK_RESPONSES.cyber_intrusion.diagnosis,
        recommendation: `**Recommendation:** ${MOCK_RESPONSES.cyber_intrusion.expectedImprovement}`,
      };
    }
    return {
      explanation: MOCK_RESPONSES.voltage_collapse.diagnosis,
      recommendation: `**Recommendation:** ${MOCK_RESPONSES.voltage_collapse.expectedImprovement}`,
    };
  }
  return { explanation: 'AI Advisor running in case-aware mode.', recommendation: null };
}
