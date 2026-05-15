import React, { useEffect, useRef } from 'react';
import Layout from './components/ui/Layout';
import { useGridStore } from './store/gridStore';
import { runPhysicsTick } from './engine/physicsEngine';
import { callLLMAdvisor } from './hooks/useLLMAdvisor';
import { ALL_CASES } from './engine/caseDefinitions';

const TICK_RATE_MS = 100;          // 10 Hz physics
const STARTUP_DELAY_MS = 800;
const TIME_ADVANCE_PER_TICK = 0.01; // hours per tick → full day in ~40s

export default function App() {
  const selfHealingLoggedRef = useRef(false);

  useEffect(() => {
    let started = false;
    const startTimer = setTimeout(() => { started = true; }, STARTUP_DELAY_MS);

    const interval = setInterval(() => {
      if (!started) return;
      const state = useGridStore.getState();
      const { simulation, activeCases, caseCooldowns } = state;
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
      const newState = useGridStore.getState();

      // ── Case Engine Detection Loop ───────────────────────────────────────
      for (const caseDef of ALL_CASES) {
        const isActive = activeCases.some(c => c.id === caseDef.id);
        const cooldownExp = caseCooldowns[caseDef.id] || 0;
        const inCooldown = (result.tick - cooldownExp) < (caseDef.cooldownTicks || 100);

        // Run detection logic
        const conditionMet = caseDef.detect(newState.nodes, newState.lines, newState.simulation);

        if (conditionMet && !isActive && !inCooldown) {
          // Trigger new case
          useGridStore.getState().addCase(caseDef);
          triggerAIAnalysis(caseDef);
        } else if (!conditionMet && isActive) {
          // Resolve cleared case
          useGridStore.getState().resolveCase(caseDef.id, 'Condition cleared');
          useGridStore.getState().addAIMessage({
            type: 'success',
            text: `✅ RESOLVED: ${caseDef.title} conditions have returned to normal operating parameters.`,
          });
        }
      }

      // ── Self-healing engaged → log event (legacy backup) ────────────────
      if (result.selfHealingActive && !selfHealingLoggedRef.current) {
        selfHealingLoggedRef.current = true;
        useGridStore.getState().addAIMessage({
          type: 'system',
          text: `🔄 SELF-HEALING ENGAGED\n\n${result.selfHealingLog}\n\nRing Main Units have automatically isolated the faulted segment and re-energized the affected zone via the ring tie path.`,
        });
      }
      if (!result.selfHealingActive) {
        selfHealingLoggedRef.current = false;
      }

    }, TICK_RATE_MS);

    return () => { clearTimeout(startTimer); clearInterval(interval); };
  }, []);

  return <Layout />;
}

// ── AI analysis (async, non-blocking) ────────────────────────────────────────
async function triggerAIAnalysis(caseDef) {
  const store = useGridStore.getState();
  store.setAIAnalyzing(true);

  // Initial alert
  store.addAIMessage({
    type: 'fault',
    text: `🚨 ${caseDef.title.toUpperCase()} DETECTED\n\nSeverity: ${caseDef.severity.toUpperCase()}\n\nTransmitting telemetry to AI Operations Advisor...`,
  });

  try {
    const currentState = useGridStore.getState();
    const response = await callLLMAdvisor(currentState, caseDef);
    
    useGridStore.getState().setAIAnalyzing(false);
    
    // Log the diagnosis
    useGridStore.getState().addAIMessage({
      type: 'ai',
      text: response.diagnosis,
    });

    // Queue actionable recommendations
    if (response.recommendedActionIds && response.recommendedActionIds.length > 0) {
      const currentPending = useGridStore.getState().pendingActions;
      useGridStore.getState().setPendingActions([
        ...currentPending, 
        { caseId: caseDef.id, actions: response.recommendedActionIds, urgency: response.urgency }
      ]);
    }
  } catch (err) {
    useGridStore.getState().setAIAnalyzing(false);
    useGridStore.getState().addAIMessage({
      type: 'fault',
      text: `⚠ AI Advisor error: ${err.message}\n\nFallback: Refer to standard operating procedures.`,
    });
  }
}
