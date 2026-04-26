/**
 * useLLMAdvisor — OpenRouter (gpt-4o-mini) integration hook
 * Mock falls back gracefully when no API key is configured.
 *
 * To enable real LLM: set VITE_OPENROUTER_API_KEY in a .env file.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are an expert Power Systems Engineer and AI Operations Advisor for a Smart Grid Digital Twin.
Your role is to analyze real-time grid telemetry data provided as JSON, diagnose faults, explain them in plain English,
and recommend specific, actionable hardware or operational interventions.

When analyzing a fault, structure your response in exactly two parts:
1. **Fault Analysis** — 2-3 sentences explaining what happened mathematically (voltage levels, reactive power deficit, line overload).
2. **Recommendation** — One specific hardware or operational fix with technical specs (e.g., "Deploy a 5 MVAR Shunt Capacitor Bank at Node 7").

Be precise and technical but understandable to a non-engineer operations manager. Mention specific node names, voltages, and power values from the data.`;
}

function buildFaultPrompt(gridState) {
  const { nodes, lines, factory, simulation, capacitor } = gridState;
  const faultDetails = simulation.faultDetails;

  const nodesSummary = Object.values(nodes).map(n => ({
    id: n.id, label: n.label, voltage_pu: n.voltage?.toFixed(3),
    activePower_MW: n.activePower?.toFixed(1),
    reactivePower_MVAR: n.reactivePower?.toFixed(1),
    status: n.status,
  }));

  const linesSummary = lines.map(l => ({
    id: l.id, from: l.from, to: l.to,
    currentFlow_MW: l.currentFlow?.toFixed(1),
    thermalLimit_MW: l.thermalLimit,
    loadRatio: l.loadRatio?.toFixed(2),
    status: l.status,
  }));

  const data = {
    timestamp: new Date().toISOString(),
    gridFrequency_Hz: simulation.gridFrequency?.toFixed(2),
    totalLoad_MW: simulation.totalLoad?.toFixed(1),
    totalGeneration_MW: simulation.totalGeneration?.toFixed(1),
    faultDetails,
    factory: factory ? {
      industrialLoad_MW: factory.industrialLoad,
      powerFactor: factory.powerFactor,
      reactiveDemand_MVAR: (factory.industrialLoad * Math.tan(Math.acos(factory.powerFactor))).toFixed(1),
      voltage_pu: factory.voltage?.toFixed(3),
    } : null,
    capacitorDeployed: !!capacitor,
    nodes: nodesSummary,
    lines: linesSummary,
  };

  return `GRID FAULT DETECTED. Analyze the following real-time telemetry and provide your diagnosis and recommendation:\n\n${JSON.stringify(data, null, 2)}`;
}

function buildStabilizationPrompt(gridState) {
  return `The 5 MVAR Shunt Capacitor Bank has been deployed. Confirm grid stabilization based on this updated telemetry and provide a brief status report:\n\n${JSON.stringify({
    nodes: Object.values(gridState.nodes).map(n => ({ id: n.id, label: n.label, voltage_pu: n.voltage?.toFixed(3), status: n.status })),
    simulation: {
      gridFrequency_Hz: gridState.simulation.gridFrequency?.toFixed(2),
      totalLoad_MW: gridState.simulation.totalLoad?.toFixed(1),
      faultActive: gridState.simulation.faultActive,
    },
  }, null, 2)}`;
}

// ── Mock responses ────────────────────────────────────────────────────────────
function getMockFaultResponse(gridState) {
  const { factory, simulation } = gridState;
  const fd = simulation.faultDetails || {};
  const factoryLoad = factory?.industrialLoad ?? 35;
  const reactiveDeficit = fd.reactiveDeficit ?? '26.2';
  const worstV = fd.worstVoltage ?? '0.821';

  return {
    explanation: `**Fault Analysis:** The newly connected Industrial Factory is drawing ${factoryLoad} MW at a power factor of ${factory?.powerFactor ?? 0.75}, generating a reactive power demand of ${reactiveDeficit} MVAR that the grid cannot supply locally. This has caused a severe voltage collapse at ${fd.primaryFaultNodeId ? fd.primaryFaultNodeId.replace(/([A-Z])/g, ' $1') : 'District Beta'}, dropping to ${worstV} per unit — well below the 0.95 pu acceptable threshold. The transmission lines feeding this zone are operating at ${fd.worstLoadRatio ? (fd.worstLoadRatio * 100).toFixed(0) : '142'}% of their thermal limit, triggering overload alarms across ${fd.overloadedLineCount ?? 2} circuits.`,
    recommendation: `**Recommendation:** Deploy a **5 MVAR Shunt Capacitor Bank** at the Point of Common Coupling near the factory connection point. This will provide local reactive power compensation, reducing the reactive power import over the transmission lines and restoring bus voltages to within the 0.95–1.05 pu operating band. Additionally, consider requesting the substation operator to raise the tap position by one step (+1.25% voltage boost) to provide additional voltage support during peak industrial demand.`,
  };
}

function getMockStabilizationResponse() {
  return {
    explanation: `**Grid Stabilized ✓** The 5 MVAR Shunt Capacitor Bank deployment has been successful. All bus voltages have recovered to within normal operating limits (0.97–1.01 pu range). The reactive power deficit has been reduced from the critical level to a manageable surplus, and transmission line loading has dropped back below the 75% thermal limit on all circuits. Grid frequency has stabilized at 50.0 Hz. The Digital Twin confirms the physical grid intervention has resolved the fault condition — all residential districts are fully restored.`,
    recommendation: null,
  };
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export async function callLLMAdvisor(gridState, mode = 'fault') {
  const useMock = !API_KEY;

  if (useMock) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1800));
    if (mode === 'stabilization') return getMockStabilizationResponse();
    return getMockFaultResponse(gridState);
  }

  // ── Real OpenRouter call ────────────────────────────────────────────────
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: mode === 'stabilization'
        ? buildStabilizationPrompt(gridState)
        : buildFaultPrompt(gridState),
    },
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Smart Grid Digital Twin',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 600 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  // Split on **Recommendation:** if present
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
