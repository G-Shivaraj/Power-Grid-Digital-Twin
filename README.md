# ⚡ AI Agent-Driven Smart Grid Digital Twin

### Real-Time Simulation, Autonomous Diagnostics & Closed-Loop Remediation for City-Scale Power Infrastructure

---

## Overview

This project implements a **fully autonomous AI Agent-Driven Digital Twin** for a 5-Layer City Power Grid. The system combines a high-fidelity physics simulation engine with a real-time **AI Operations Agent** that continuously monitors grid telemetry, autonomously detects anomalies across 14+ grid assets, performs structured root-cause diagnosis via Large Language Model (LLM) reasoning, and executes closed-loop remediation actions — deploying physical countermeasures directly into the live simulation without human intervention.

The AI Agent operates on the **OODA (Observe → Orient → Decide → Act)** decision loop at 10Hz, closing the gap between fault detection and corrective action in under 2 seconds. This makes the system a true **agentic Digital Twin** — not just a passive visualization, but an intelligent entity that perceives, reasons, and acts on the physical model it mirrors.

---

## 🤖 AI Agent Architecture — Closed-Loop OODA Cycle

The core differentiator of this Digital Twin is the **autonomous AI Agent** that runs a continuous sense-reason-act feedback loop against the physics simulation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI AGENT — OODA DECISION LOOP                       │
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │ OBSERVE  │───►│   ORIENT     │───►│   DECIDE     │───►│   ACT     │  │
│  │          │    │              │    │              │    │           │  │
│  │ 10Hz     │    │ Case Engine  │    │ LLM Advisor  │    │ Execute   │  │
│  │ Telemetry│    │ Detection    │    │ Structured   │    │ Deploy to │  │
│  │ Stream   │    │ (5 Failure   │    │ JSON Response│    │ Live Sim  │  │
│  │          │    │  Patterns)   │    │ (Diagnosis + │    │ (Mutate   │  │
│  │ Voltage  │    │              │    │  Action IDs) │    │  Physics) │  │
│  │ Current  │    │ Threshold +  │    │              │    │           │  │
│  │ Temp     │    │ Multi-Signal │    │ GPT-4o/Gemini│    │ Spawn     │  │
│  │ Freq     │    │ Correlation  │    │ via OpenRouter│   │ Nodes,    │  │
│  │ Fault A  │    │              │    │              │    │ Lines,    │  │
│  └──────────┘    └──────────────┘    └──────────────┘    │ Effects   │  │
│       ▲                                                  └─────┬─────┘  │
│       │                          ┌──────────────┐              │        │
│       └──────────────────────────│   VERIFY     │◄─────────────┘        │
│                                  │ Auto-resolve │                       │
│                                  │ when physics │                       │
│                                  │ normalizes   │                       │
│                                  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Capabilities

| Agent Phase | Technical Implementation | Key Detail |
|---|---|---|
| **Observe** | 10Hz physics tick loop ingests full grid state — per-node voltage (pu), fault current (A), conductor temperature (°C), transformer oil temperature, load saturation (%), grid frequency (Hz), phase imbalance, and harmonic distortion. | Every tick produces a complete telemetry snapshot across all 14 entities. |
| **Orient** | Case Detection Engine evaluates 5 independent anomaly patterns using multi-signal correlation — combining threshold breaches, boolean flags, and cross-entity state (e.g., surge + frequency deviation + load overshoot). | Detection is physics-aware, not simple threshold alerting. Each case has cooldown timers to prevent alert storms. |
| **Decide** | Full grid telemetry is serialized into a structured prompt and sent to an LLM (GPT-4o-mini / Gemini via OpenRouter). The LLM returns a **structured JSON response** with `diagnosis`, `urgency`, `recommendedActionIds[]`, and `expectedImprovement`. | The agent constrains the LLM to choose from a pre-validated action catalog — no hallucinated solutions. |
| **Act** | Each recommended action has a concrete `execute()` function that **directly mutates the running simulation** — dynamically spawning new grid assets (transformers, BESS, RTUs, bypass switches), creating new power lines, and applying physics effects. | This is true closed-loop remediation: the AI doesn't just suggest — it deploys. |
| **Verify** | The same detection loop continuously re-evaluates. When the fault condition clears post-remediation, the agent auto-resolves the case and logs a `✅ RESOLVED` confirmation. | Full autonomic self-healing without operator intervention. |

### LLM Integration — Pluggable AI Backend

The AI reasoning layer (`useLLMAdvisor.js`) supports a **pluggable architecture** for LLM providers:

- **Production Mode**: Calls OpenRouter API (supports GPT-4o-mini, Gemini, Claude, etc.) with structured JSON output enforcement (`response_format: json_object`).
- **Offline/Demo Mode**: Falls back to deterministic expert-calibrated responses for reliable demonstrations without API dependencies.
- **Custom Prompt Engineering**: Each failure case generates a domain-specific prompt template enriched with live telemetry data — node-level voltages, fault currents, oil temperatures, breaker states, and stressed line ratios.

---

## 🏛️ 5-Layer City Power Grid — Physical Topology

The Digital Twin models a complete city-scale power grid with **14+ distinct physical entities** across 5 hierarchical layers, connected via **15+ transmission and distribution lines** operating at 4 voltage levels (220kV / 33kV / 11kV / 400V):

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          5-LAYER CITY DIGITAL TWIN                                │
│                                                                                   │
│  [Layer 1: Bulk Generation]  ──► Metro Coal (220MW) │ Solar Farm (45MW) │ Gas (80MW)│
│                                       │  220kV HV Transmission Corridor           │
│                                       ▼                                           │
│  [Layer 2: City Gateways]    ──► Primary HV Substation (220kV→33kV OLTC)          │
│                                  Heavy Industry Complex (33kV Direct Tap)         │
│                                       │  33kV Sub-Transmission                    │
│                                       ▼                                           │
│  [Layer 3: Urban Veins]      ──► Zone Subs (North/East/West) ↔ RMUs (Ring Tie)   │
│                                  Self-Healing Ring-Bus Topology                   │
│                                       │  11kV Distribution Feeders                │
│                                       ▼                                           │
│  [Layer 4: Intelligent Edge] ──► Dist Transformers (11kV→400V)                    │
│                                  Smart Meters │ Prosumers │ Hospital (Critical)   │
│                                                                                   │
│  [Layer 5: Data & AI]        ──► 10Hz Physics Engine │ AI Agent │ Telemetry Stream│
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Entity Roster & Telemetry Attributes

| Layer | Entity | Key Telemetry Attributes |
|---|---|---|
| **L1 — Bulk Generation** | Metro Coal Plant (220MW) | `generator_rpm`, `active_power_mw`, `reactive_power_mvar`, `spinning_reserve_mw`, `ramp_up_rate_mw_per_min` |
| **L1 — Bulk Generation** | North Solar Farm (45MW PV) | `solarOutput`, `solarOutputPercent`, MPPT-based irradiance curve (sinusoidal 06:00–19:00) |
| **L1 — Reserve** | Gas Peaker Plant (80MW) | Fast-ramp reserve (25 MW/min), hot standby with 60MW spinning reserve |
| **L2 — City Gateway** | Primary HV Substation | `transformer_oil_temp_c`, `tap_changer_position`, `incoming_voltage_kv` (220kV), `outgoing_voltage_kv` (33kV), `cyber_intrusion_flag` |
| **L2 — Heavy Load** | Heavy Industry Complex | `heavy_machinery_load_kw` (28MW rated), `power_factor_ratio` (0.82), arc furnace reactive power |
| **L3 — Distribution** | Zone Substations (×3) | `feeder_breaker_status` (CLOSED/TRIPPED), `phase_imbalance_percent` |
| **L3 — Protection** | Ring Main Units (×2) | `fault_current_detected_amps`, `isolation_switch_state`, `telemetry_latency_ms`, self-healing ring tie |
| **L4 — Edge** | Distribution Transformers (α/β) | `ambient_temp_celsius`, `load_saturation_percent`, `estimated_lifespan_remaining_days` (thermal degradation model) |
| **L4 — Consumers** | Smart Meters / Hospital | `net_metering_kw`, `ev_charging_draw_kw` (time-of-day curve 17:00–22:00), `harmonic_distortion_percent` |

---

## ⚙️ Physics Simulation Engine

The physics engine runs at **10Hz** (100ms tick rate) and evaluates the following real-time models:

### Core Equations

| Model | Equation | Application |
|---|---|---|
| **Apparent Power** | `S = √(P² + Q²)` [MVA] | Transmission line loading |
| **Power Factor** | `cos(θ) = P / S` | Industrial reactive power analysis |
| **Voltage Drop** | `ΔV ≈ (P·R + Q·X) / V²` [per-unit] | Per-node voltage cascade across layers |
| **Conductor Temperature** | `T = T_ambient + I²·R_thermal` | Joule heating model for HV lines |
| **Thermal Line Sag** | `sag ∝ α × ΔT × span` (α = 23×10⁻⁶ /°C Al) | Real-time sag computation for transmission corridors |
| **Transformer Oil Temp** | `T_oil = T_ambient + k·(load_ratio²) × 90°C` with thermal lag | Thermal degradation tracking with exponential decay |
| **Grid Frequency** | `f = (RPM × poles) / 120` | Generation–load imbalance → frequency deviation |
| **Solar Irradiance** | `P = P_max × sin(π(t−6)/13) × (slider/100)` | Bell-curve PV generation (06:00–19:00) |
| **EV Charging Demand** | `P_ev = sin(π(t−17)/5) × 1.2 MW` | Evening demand spike (17:00–22:00) |
| **Transformer Lifespan** | `days -= Δ × (sat/100)²` when sat > 95% | Accelerated aging under overload |

### Self-Healing Ring-Bus Logic

When a fault is detected on an 11kV feeder:
1. **RMU fault current** exceeds threshold → `isolation_switch_state` trips to `true`
2. **Faulted feeder breaker** transitions `CLOSED → TRIPPED`
3. **Ring tie switch** (normally open) **auto-closes** → re-energizes affected zone via alternate path
4. AI Agent logs the entire self-healing sequence in real-time

---

## 🚨 5 Core Failure Scenarios — AI Agent Response Catalog

Each scenario is a **physics-driven, multi-signal anomaly pattern** that the AI Agent detects, diagnoses, and remediates autonomously:

| # | Scenario | Severity | Detection Signals | AI Agent Remediation |
|---|---|---|---|---|
| 1 | **Transformer Overload** | `CRITICAL` | `load_saturation_percent > 95%` on L4 transformers | Dynamically deploys an auxiliary 11kV/400V parallel transformer — spawns new node + power line into the live topology |
| 2 | **Industrial Surge Overload** | `CRITICAL` | Surge event active + `activePower > 35MW` + frequency deviation | Deploys electronic load limiter with 30MW hard cap on industrial feeder |
| 3 | **Solar Intermittency Ramp** | `WARNING` | Daytime (06:00–19:00) + solar output < 40% + coal ramp stress | Deploys 15MW/30MWh Battery Energy Storage System (BESS) at solar farm |
| 4 | **SCADA Cyber Intrusion** | `EMERGENCY` | `cyber_intrusion_flag = true` + tap changer anomaly | Deploys hardened backup RTU with IEC 62351 encryption, bypasses compromised SCADA channel |
| 5 | **RMU Fault & Feeder Isolation** | `CRITICAL` | `fault_current > 2000A` + RMU isolation triggered + self-healing active | Deploys physical bypass switch around faulted segment, restores radial topology |

> Each remediation action **physically mutates the Digital Twin** — spawning new grid assets, creating power lines, and applying physics effects that the engine evaluates on the next tick.

---

## 🖥️ Interactive 3D Visualization & UI

- **3D Canvas**: Full WebGL rendering via React Three Fiber with orbit controls, animated power flow particles along transmission lines, and color-coded status indicators (optimal/stressed/failed).
- **Control Panel**: Real-time parameter manipulation — residential demand sliders, solar output control, time-of-day simulation, surge event triggers, and cyber attack simulation buttons.
- **AI Advisor Panel**: Live chat-style interface displaying the AI Agent's diagnostic messages, severity-coded alerts, and deployable remediation action buttons with one-click execution.
- **Explainability Dashboard**: Click any grid node to inspect its full telemetry state — voltages, temperatures, load ratios, breaker states — with the underlying physics equations displayed.
- **Status Bar**: Global grid health overview — total generation/load balance, grid frequency, active fault count, and simulation clock.

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Build System** | Vite 8 | Lightning-fast HMR development server |
| **UI Framework** | React 19 | Component-based reactive UI |
| **3D Rendering** | React Three Fiber + Three.js + Drei | WebGL-powered interactive 3D grid visualization |
| **State Management** | Zustand | Centralized reactive state store for physics + UI |
| **AI Agent Backend** | OpenRouter API (GPT-4o / Gemini) | Structured LLM reasoning with JSON schema enforcement |
| **Styling** | Tailwind CSS | Utility-first responsive design system |
| **Charts** | Recharts | Real-time telemetry data visualization |
| **Icons** | Lucide React | Consistent iconography |

---

## 📁 Project Structure

```
src/
├── App.jsx                          # Main loop: 10Hz physics tick + AI Agent OODA cycle
├── engine/
│   ├── physicsEngine.js             # AC/DC load flow, thermal models, self-healing logic
│   └── caseDefinitions.js           # 5 failure case patterns + executable remediation actions
├── store/
│   └── gridStore.js                 # Zustand store: 14 grid entities, 15 lines, simulation state
├── hooks/
│   └── useLLMAdvisor.js             # LLM integration: prompt engineering + structured JSON parsing
├── components/
│   ├── canvas/
│   │   ├── GridCanvas.jsx           # R3F Canvas: 3D scene with orbit controls + lighting
│   │   ├── PowerLine.jsx            # Animated power flow tubes with directional particles
│   │   ├── PlacementOverlay.jsx     # Dynamic asset placement for AI-deployed nodes
│   │   └── nodes/                   # Individual 3D node components (GLB model rendering)
│   └── ui/
│       ├── Layout.jsx               # 3-column responsive app shell
│       ├── ControlPanel.jsx         # Parameter sliders + event trigger buttons
│       ├── AIAdvisorPanel.jsx       # AI Agent chat interface + action deployment buttons
│       ├── ExplainabilityPanel.jsx  # Per-node telemetry inspector + physics equations
│       ├── StatusBar.jsx            # Global grid health dashboard
│       └── charts/                  # Real-time telemetry charts (Recharts)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Smart-Grid-Digital-Twin

# Install dependencies
npm install

# Configure AI Agent (optional — works offline with built-in expert responses)
# Create .env file:
VITE_OPENROUTER_API_KEY=your_openrouter_api_key

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📄 Documentation

| Document | Description |
|---|---|
| **README.md** | This file — complete system documentation |
| **CASES.md** | Detailed specification of all 5 failure scenarios, triggers, severity levels, and AI remediation strategies |
| **implementation_plan.md** | Original architectural design document — UI structure, component hierarchy, and tech stack decisions |
| **implementation_plan_2.O** | 5-Layer City Grid overhaul specification — entity roster, attribute schemas, physics equations, and telemetry pipeline |

---

## 📜 License

This project is proprietary. All rights reserved.
