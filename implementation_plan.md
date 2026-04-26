# Smart Grid Digital Twin — Implementation Plan

## Overview

A fully browser-based, industry-grade Digital Twin of an electric microgrid built with **React + Vite**, **React Three Fiber (R3F)** for 3D rendering, **Zustand** for state/physics, and **Tailwind CSS** for UI. The app simulates real-time power-flow physics, supports drag-and-drop load placement, provides an Explainability Dashboard, and includes an LLM-powered AI Advisor that closes the simulation loop.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Application                          │
│                                                                     │
│  ┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │  3D Canvas    │   │  Physics Engine  │   │  AI Advisor UI   │   │
│  │  (R3F/Drei)  │◄──│  (Zustand Store) │──►│  (Chat Panel)    │   │
│  │               │   │                  │   │                  │   │
│  │  - Substation │   │  - Power Flow    │   │  - LLM Hook      │   │
│  │  - Solar Farm │   │  - Voltage Calc  │   │  - Mock/Real API │   │
│  │  - Residences │   │  - Fault Detect  │   │  - Deploy Button │   │
│  │  - Lines      │   │  - Tick Loop     │   │                  │   │
│  └───────────────┘   └──────────────────┘   └──────────────────┘   │
│                                                                     │
│  ┌────────────────────┐   ┌──────────────────────────────────────┐  │
│  │  Explainability    │   │  Control Panel / Sliders            │  │
│  │  Dashboard         │   │  Drag-and-Drop Load Factory         │  │
│  └────────────────────┘   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Concern | Technology |
|---|---|
| Build Tool | Vite |
| UI Framework | React 18 |
| 3D Rendering | React Three Fiber + @react-three/drei |
| State + Physics | Zustand |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| 3D Drag-Drop | @use-gesture/react or R3F pointer events |
| LLM | Pluggable hook (mock by default, OpenAI/Gemini ready) |

---

## Proposed File Structure

```
d:/Smart-Grid-Digital-Twin/
├── public/
│   └── models/           ← user drops .glb files here
│       ├── substation.glb
│       ├── solar-farm.glb
│       ├── residential.glb
│       └── factory.glb
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css           ← Tailwind directives + custom CSS vars
│   │
│   ├── store/
│   │   └── gridStore.js    ← Zustand store (all physics state)
│   │
│   ├── engine/
│   │   └── physicsEngine.js  ← Power flow math (DC load flow)
│   │
│   ├── hooks/
│   │   └── useLLMAdvisor.js  ← LLM integration hook (mock/real)
│   │
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── GridCanvas.jsx         ← R3F Canvas root
│   │   │   ├── GridEnvironment.jsx    ← Lighting, ground, grid lines
│   │   │   ├── nodes/
│   │   │   │   ├── SubstationNode.jsx
│   │   │   │   ├── SolarFarmNode.jsx
│   │   │   │   ├── ResidentialNode.jsx
│   │   │   │   ├── FactoryNode.jsx
│   │   │   │   └── CapacitorNode.jsx  ← Deployed by AI recommendation
│   │   │   ├── PowerLine.jsx          ← Animated tube with particles
│   │   │   └── DragOverlay.jsx        ← Ghost mesh while dragging factory
│   │   │
│   │   ├── ui/
│   │   │   ├── Layout.jsx             ← App shell with 3 columns
│   │   │   ├── ControlPanel.jsx       ← Left sidebar: parameters
│   │   │   ├── ExplainabilityPanel.jsx ← Click node → show math
│   │   │   ├── AIAdvisorPanel.jsx     ← Right sidebar: LLM chat
│   │   │   ├── StatusBar.jsx          ← Top bar: global grid health
│   │   │   ├── LoadPalette.jsx        ← Drag-from UI: factory icon
│   │   │   └── charts/
│   │   │       ├── PowerFlowChart.jsx
│   │   │       └── VoltageChart.jsx
│   │   │
│   │   └── shared/
│   │       ├── NodeLabel.jsx
│   │       └── AlarmPulse.jsx
│   │
│   └── utils/
│       └── gridMath.js    ← helper math (per-unit conversions, etc.)
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Component 1 — 3D Digital Twin Environment

### GridCanvas.jsx
- R3F `<Canvas>` with orthographic camera set to isometric view angle
- `<Suspense>` wrapping all GLTF loaders with `<FallbackPrimitive>` as fallback
- `<OrbitControls>` (limited to pan + limited rotate), `<Environment>` preset

### Node Components (Substation, SolarFarm, Residential, Factory, Capacitor)
Each node:
1. Attempts `useGLTF('/models/<name>.glb')` inside a `<Suspense>` boundary
2. On error/missing file → renders a stylized primitive (box, cylinder, etc.) in matching color
3. Changes color via `emissive` prop based on Zustand `node.status` (`optimal` → green, `stressed` → yellow, `failed` → red)
4. Pulses (scale animation via `useFrame`) when status = `failed`
5. On click → dispatches `selectNode(id)` to Zustand

### PowerLine.jsx
- Uses `<CatmullRomCurve3>` + `<TubeGeometry>` to draw lines between nodes
- Shader-based glow effect on the tube (emissive material)
- Particle system: N small sphere meshes placed along the curve, animated via `useFrame` to travel the line
- Direction of travel controlled by `line.powerFlowDirection` from store
- Color controlled by `line.loadRatio` (0→1 maps green→yellow→red)
- Bidirectional: Solar Farm can push particles toward Substation when `solarOutput > localDemand`

---

## Component 2 — Physics Engine (Zustand Store)

### gridStore.js — State Shape

```js
{
  nodes: {
    substation: { id, type, position, voltage, activePower, reactivePower, status, maxCapacity },
    solarFarm:  { id, type, position, voltage, solarOutput, status },
    residential1: { id, type, position, baseDemand, actualDemand, voltage, status },
    residential2: { ... },
    factory: null,      // null until user drops it
    capacitor: null,    // null until AI deploys it
  },
  lines: [
    { id, from, to, resistance, reactance, currentFlow, loadRatio, status, powerFlowDirection },
    ...
  ],
  simulation: {
    tick: 0,
    timeOfDay: 0,     // 0–24, drives solar curve
    isRunning: true,
    faultActive: false,
    faultNodeId: null,
  },
  selectedNodeId: null,
  aiAdvisor: {
    messages: [],
    isAnalyzing: false,
    recommendationPending: null,
  }
}
```

### physicsEngine.js — DC Load Flow Simplified

Each tick (configurable, ~10 Hz):
1. Compute `solarOutput = maxSolar * sin(π * timeOfDay/12)` (peaks at noon)
2. Compute `totalLoad = Σ(node.baseDemand)` for all active loads
3. If `factory` node exists, add its `industrialLoad` to total
4. Compute `netGeneration = substationCapacity + solarOutput`
5. Distribute power via simplified line resistance model:
   - `voltageAtNode = nominalVoltage - (load * lineResistance)`
6. Compute `loadRatio` per line: `currentFlow / thermalLimit`
7. Set `node.status`:
   - `optimal` if voltage ≥ 0.95 pu
   - `stressed` if 0.90 ≤ voltage < 0.95 pu
   - `failed` if voltage < 0.90 pu
8. If factory present and any node fails → dispatch `triggerFault()`
9. If capacitor deployed → add reactive power support → voltage recovery calculation

---

## Component 3 — Interactive "What-If" Testing

### Sliders (ControlPanel.jsx)
- Click node → sidebar shows relevant sliders
- Solar Farm: "Solar Output %" slider → updates `solarFarm.solarOutput` in store
- Residential: "Base Demand (MW)" slider → updates `node.baseDemand`
- Substation: "Voltage Setpoint" slider

### Drag-and-Drop Factory (LoadPalette.jsx + DragOverlay.jsx)
- `LoadPalette`: Shows a draggable Factory icon card in the left panel
- Implementation approach:
  1. User clicks "Add Factory" button (drag-drop in 3D is complex; use click-to-place for reliability)
  2. Canvas enters "placement mode" — cursor shows ghost factory mesh that follows mouse via raycasting against a ground plane
  3. User clicks → factory placed at that world position → `placeFactory(position)` dispatched
  4. Physics engine recalculates immediately → voltage drops → fault triggered

---

## Component 4 — LLM-Powered AI Advisor

### useLLMAdvisor.js hook
```js
async function analyzeGridFault(gridState) {
  const prompt = buildPrompt(gridState);  // uses real Zustand snapshot
  // MOCK: returns canned response after 1.5s delay
  // REAL: fetch('https://api.openai.com/v1/chat/completions', { body: { prompt } })
  return { explanation, recommendation, recommendationAction };
}
```

Prompt construction uses actual JSON dump of nodes/lines/fault state.

### AIAdvisorPanel.jsx
- Chat-style UI with message bubbles
- When fault detected → auto-message with spinner → AI response appears
- Response includes: Fault analysis + Recommendation text + **"Deploy AI Recommendation"** button
- On deploy → `deployCapacitor()` dispatched to store

---

## Component 5 — The Twin Effect (Closing the Loop)

### deployCapacitor() action in gridStore.js
1. Sets `nodes.capacitor = { position: [x,y,z], reactivePowerSupport: 5 }` (at Node 7 / near factory)
2. CapacitorNode.jsx animates into existence (scale 0 → 1 spring animation)
3. Physics engine on next tick: includes capacitor's Q support in voltage calculation
4. Voltage recovers → statuses update → colors change back to green
5. AI advisor sends final "Grid Stabilized" confirmation message

---

## UI Design System

- **Color Palette:** Light mode, clean industrial aesthetic
  - Background: `#F0F4F8` (cool gray)
  - Panels: `#FFFFFF` with subtle shadow
  - Accent: `#0EA5E9` (sky blue — primary), `#F59E0B` (amber — warning), `#EF4444` (red — fault)
  - Status: `#22C55E` (green), `#F59E0B` (yellow), `#EF4444` (red)
- **Typography:** Inter (Google Fonts)
- **Panels:** 3-column layout: Control (left) | 3D Canvas (center) | AI Advisor (right)
- **Status Bar:** Top strip showing global `frequency`, `total load`, `generation`, `fault status`

---

## Verification Plan

### Automated
- `npm run build` — ensure no TS/JS compilation errors
- All node components render with fallback primitives (no .glb files needed)

### Manual Browser Tests
1. App loads → 3D scene renders with all primitive fallback nodes
2. Time-of-day slider advances → solar output changes → particles reverse direction on solar line
3. Click Solar Farm → sliders appear in control panel
4. Click "Add Factory" → placement mode → click on grid → factory appears
5. Factory placed → lines turn red → residential nodes turn red (blackout)
6. AI Advisor auto-populates with fault analysis message
7. Click "Deploy AI Recommendation" → capacitor appears → lines turn green → nodes recover
8. Charts in Explainability Panel update throughout

---

## Open Questions

> [!IMPORTANT]
> **Q1: Do you have an OpenAI or Gemini API key ready to use?**
> If yes, which provider? The `useLLMAdvisor` hook will be wired with a real `fetch` call but the mock will work out of the box.

> [!IMPORTANT]
> **Q2: Drag-and-drop vs. click-to-place for the Factory?**
> True 3D drag-and-drop (from HTML to a WebGL canvas) is complex to implement correctly. I recommend a **click-to-place** approach: click "Add Factory" → ghost mesh appears → click canvas to confirm position. This achieves the same UX goal with significantly more reliability. Is this acceptable?

> [!NOTE]
> **Q3: Existing code?**
> The previous conversation (4b06a9cd) appears to have started this project but no code was written yet. Confirming: should I scaffold from scratch in `d:/Smart-Grid-Digital-Twin`?

> [!NOTE]
> **Q4: .glb model files?**
> The fallback primitive system means we don't need models to start. I'll include placeholder instructions in the README for where to drop them once you source them.
