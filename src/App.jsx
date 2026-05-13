import React, { useEffect, useRef } from 'react';
import Layout from './components/ui/Layout';
import { useGridStore } from './store/gridStore';
import { runPhysicsTick } from './engine/physicsEngine';
import { callLLMAdvisor } from './hooks/useLLMAdvisor';

const TICK_RATE_MS = 100;          // 10 Hz physics
const STARTUP_DELAY_MS = 800;
const TIME_ADVANCE_PER_TICK = 0.01; // hours per tick → full day in ~40s

export default function App() {
  const faultTriggeredRef  = useRef(false);
  const cyberTriggeredRef  = useRef(false);
  const selfHealingLoggedRef = useRef(false);

  useEffect(() => {
    let started = false;
    const startTimer = setTimeout(() => { started = true; }, STARTUP_DELAY_MS);

    const interval = setInterval(() => {
      if (!started) return;
      const state = useGridStore.getState();
      const { simulation } = state;
      if (!simulation.isRunning) return;

      // Advance simulation time
      let newTimeOfDay = simulation.timeOfDay;
      if (simulation.autoAdvanceTime) {
        newTimeOfDay = (simulation.timeOfDay + TIME_ADVANCE_PER_TICK) % 24;
      }

      // Run physics
      const result = runPhysicsTick({
        ...state,
        simulation: { ...simulation, timeOfDay: newTimeOfDay },
      });

      // Apply result to store
      state.applyPhysicsResult({ ...result, timeOfDay: newTimeOfDay });

      // ── Fault detection → AI trigger ──────────────────────────────────────
      if (result.faultActive && !faultTriggeredRef.current && !result.cyberIntrusionActive) {
        faultTriggeredRef.current = true;
        triggerAIAnalysis('fault', result);
      }

      // ── Cyber intrusion → AI trigger ──────────────────────────────────────
      if (result.cyberIntrusionActive && !cyberTriggeredRef.current) {
        cyberTriggeredRef.current = true;
        triggerAIAnalysis('cyber', result);
      }

      // ── Self-healing engaged → log event ──────────────────────────────────
      if (result.selfHealingActive && !selfHealingLoggedRef.current) {
        selfHealingLoggedRef.current = true;
        useGridStore.getState().addAIMessage({
          type: 'system',
          text: `🔄 SELF-HEALING ENGAGED\n\n${result.selfHealingLog}\n\nRing Main Units have automatically isolated the faulted segment and re-energized the affected zone via the ring tie path.`,
        });
      }

      // Reset triggers when conditions clear
      if (!result.faultActive) {
        faultTriggeredRef.current = false;
        selfHealingLoggedRef.current = false;
      }
      if (!result.cyberIntrusionActive) {
        cyberTriggeredRef.current = false;
      }
    }, TICK_RATE_MS);

    return () => { clearTimeout(startTimer); clearInterval(interval); };
  }, []);

  return <Layout />;
}

// ── AI analysis (async, non-blocking) ────────────────────────────────────────
async function triggerAIAnalysis(mode, result) {
  const store = useGridStore.getState();
  store.setAIAnalyzing(true);

  if (mode === 'fault') {
    store.addAIMessage({
      type: 'fault',
      text: `🚨 FAULT DETECTED\n\nGrid anomaly at tick ${store.simulation.tick}. Minimum voltage: ${result.faultDetails?.minVoltage ?? '?'} pu. Type: ${result.faultDetails?.type ?? 'unknown'}.\n\nTransmitting telemetry to AI Advisor...`,
    });
  } else if (mode === 'cyber') {
    store.addAIMessage({
      type: 'fault',
      text: `🛡 CYBER INTRUSION DETECTED\n\nSCADA system at HV Primary Substation reports unauthorized telemetry at tick ${store.simulation.tick}.\n\nAI Advisor analyzing threat vector...`,
    });
  }

  try {
    const currentState = useGridStore.getState();
    const response = await callLLMAdvisor(currentState, mode);
    useGridStore.getState().setAIAnalyzing(false);
    useGridStore.getState().addAIMessage({
      type: mode === 'fault' ? 'ai' : 'system',
      text: response.explanation,
    });
    if (response.recommendation) {
      useGridStore.getState().setAIRecommendation(response.recommendation);
    }
  } catch (err) {
    useGridStore.getState().setAIAnalyzing(false);
    useGridStore.getState().addAIMessage({
      type: 'fault',
      text: `⚠ AI Advisor error: ${err.message}\n\nFallback: Review zone substation breaker status and verify RMU isolation logic.`,
    });
  }
}
