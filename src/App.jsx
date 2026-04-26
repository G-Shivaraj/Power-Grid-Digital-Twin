import React, { useEffect, useRef } from 'react';
import Layout from './components/ui/Layout';
import { useGridStore } from './store/gridStore';
import { runPhysicsTick } from './engine/physicsEngine';
import { callLLMAdvisor } from './hooks/useLLMAdvisor';

const TICK_RATE_MS = 100;           // 10 Hz physics
const STARTUP_DELAY_MS = 800;       // brief delay before first tick
const TIME_ADVANCE_PER_TICK = 0.01; // hours per tick → full day in ~40s

export default function App() {
  const faultTriggeredRef = useRef(false);    // prevent repeated AI calls
  const capacitorDeployedRef = useRef(false); // prevent repeated stabilization calls

  useEffect(() => {
    let started = false;
    const startTimer = setTimeout(() => { started = true; }, STARTUP_DELAY_MS);
    const interval = setInterval(() => {
      if (!started) return;
      const state = useGridStore.getState();
      const { simulation, aiAdvisor } = state;

      if (!simulation.isRunning) return;

      // Advance time of day
      let newTimeOfDay = simulation.timeOfDay;
      if (simulation.autoAdvanceTime) {
        newTimeOfDay = (simulation.timeOfDay + TIME_ADVANCE_PER_TICK) % 24;
      }

      // Run physics
      const result = runPhysicsTick({
        ...state,
        simulation: { ...simulation, timeOfDay: newTimeOfDay },
      });

      // Apply result
      state.applyPhysicsResult({ ...result, timeOfDay: newTimeOfDay });

      // ── Fault detection → AI trigger (only when factory is present) ──────
      const hasFactory = !!state.factory;
      if (result.faultActive && hasFactory && !faultTriggeredRef.current && !aiAdvisor.capacitorDeployed) {
        faultTriggeredRef.current = true;
        triggerAIAnalysis('fault');
      }

      // ── Stabilization check → AI confirmation ────────────────────────────
      if (!result.faultActive && capacitorDeployedRef.current) {
        capacitorDeployedRef.current = false;
        triggerAIAnalysis('stabilization');
      }

      // Reset fault trigger when grid clears
      if (!result.faultActive) {
        faultTriggeredRef.current = false;
      }
    }, TICK_RATE_MS);

    return () => { clearTimeout(startTimer); clearInterval(interval); };
  }, []);

  // Watch for capacitor deploy
  useEffect(() => {
    const unsub = useGridStore.subscribe(
      s => s.capacitor,
      (capacitor, prevCapacitor) => {
        if (capacitor && !prevCapacitor) {
          capacitorDeployedRef.current = true;
          faultTriggeredRef.current = false; // allow re-trigger if new fault
        }
      }
    );
    return unsub;
  }, []);

  return <Layout />;
}

// ── AI analysis (async, non-blocking) ────────────────────────────────────────
async function triggerAIAnalysis(mode) {
  const store = useGridStore.getState();
  store.setAIAnalyzing(true);

  // Add user-facing "incoming" message
  if (mode === 'fault') {
    store.addAIMessage({
      type: 'fault',
      text: `🚨 FAULT DETECTED\n\nGrid failure at tick ${store.simulation.tick}. Voltage collapse detected — ${store.simulation.faultDetails?.failedNodeCount ?? '?'} node(s) below 0.88 pu. Sending telemetry to AI Advisor for analysis...`,
    });
  } else {
    store.addAIMessage({
      type: 'system',
      text: `🔧 CAPACITOR DEPLOYED\n\nShunt Capacitor Bank is online. Running post-deployment analysis...`,
    });
  }

  try {
    const currentState = useGridStore.getState();
    const response = await callLLMAdvisor(currentState, mode);

    useGridStore.getState().setAIAnalyzing(false);

    // Post AI message
    useGridStore.getState().addAIMessage({
      type: mode === 'fault' ? 'ai' : 'success',
      text: response.explanation,
    });

    // Set recommendation for deploy button
    if (mode === 'fault' && response.recommendation) {
      useGridStore.getState().addAIMessage({
        type: 'system',
        text: response.recommendation,
      });
      useGridStore.getState().setAIRecommendation(response.recommendation);
    }

    if (mode === 'stabilization') {
      useGridStore.getState().addAIMessage({
        type: 'success',
        text: '✅ All grid parameters nominal. Digital Twin loop complete.',
      });
    }
  } catch (err) {
    useGridStore.getState().setAIAnalyzing(false);
    useGridStore.getState().addAIMessage({
      type: 'fault',
      text: `⚠ AI Advisor error: ${err.message}\n\nFallback: Check line loadings and deploy a shunt capacitor at the fault location.`,
    });
  }
}
