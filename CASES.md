# CASES — Smart Grid Digital Twin Failure Scenarios

This document catalogs the 10 real-world grid failure cases implemented in the Digital Twin's Case Engine. Each case triggers dynamically based on physics simulation conditions. The AI Advisor detects these cases, provides a technical diagnosis, and recommends structured JSON actions which can be applied directly via the UI.

---

## 1. Transformer Overload
* **Severity**: CRITICAL
* **Trigger**: Distribution Transformer α or β load saturation exceeds 95%.
* **Context**: Driven by peak residential or hospital demand. Accelerates thermal degradation and reduces transformer lifespan.
* **Solutions**:
  * `Deploy Parallel Transformer`: Installs an auxiliary 11kV/400V transformer to halve the load saturation.
  * `Shed Non-Critical Load`: Triggers 20% demand response on residential loads.

## 2. Voltage Collapse (Cascading)
* **Severity**: EMERGENCY
* **Trigger**: Any zone substation bus voltage drops below 0.85 pu.
* **Context**: Generation-load imbalance causing severe reactive power deficit and voltage sag across the 33kV layer.
* **Solutions**:
  * `Activate Gas Peaker`: Dispatches up to 60 MW spinning reserve to stabilise frequency.
  * `Deploy Capacitor Bank`: Installs a 20 MVAR capacitor bank at Zone Sub North to boost local voltage by ~0.015 pu.

## 3. Industrial Surge Overload
* **Severity**: CRITICAL
* **Trigger**: Surge Event active AND Heavy Industry load > 35 MW AND frequency deviates > 0.15 Hz.
* **Context**: Sudden uncoordinated motor start sequence at the factory complex drawing massive active and reactive power.
* **Solutions**:
  * `Curtail Industrial Load`: Instantly drops factory load by 30%.
  * `Deploy Load Limiter`: Installs a hard electronic cap at 30 MW for the industrial feeder.

## 4. Solar Intermittency Ramp
* **Severity**: WARNING
* **Trigger**: Daytime (06:00–19:00) AND Solar output drops below 40% of max capacity.
* **Context**: Cloud cover or sudden weather event causing a rapid drop in renewable generation, stressing the coal plant governor.
* **Solutions**:
  * `Activate Gas Peaker`: Dispatches gas reserve to fill the solar gap.
  * `Deploy Battery Storage (BESS)`: Installs a 15 MW / 30 MWh BESS at the solar farm to discharge and smooth the ramp rate.

## 5. SCADA Cyber Intrusion
* **Severity**: EMERGENCY
* **Trigger**: HV Substation cyber intrusion flag active.
* **Context**: Simulated Man-in-the-Middle attack spoofing telemetry (e.g. tap changer position) on the DNP3 protocol.
* **Solutions**:
  * `Isolate SCADA Channel`: Cuts remote comms and switches to manual control, clearing the intrusion flag.
  * `Deploy Backup RTU`: Spawns a hardened RTU with IEC 62351 encryption to secure the telemetry stream.

## 6. RMU Fault & Feeder Isolation
* **Severity**: CRITICAL
* **Trigger**: RMU North fault current > 2000A AND isolation switch tripped.
* **Context**: Physical fault on the 11kV feeder. Triggers the self-healing ring tie to re-energize from the East.
* **Solutions**:
  * `Confirm Ring Tie Reroute`: Operator acknowledges the automated self-healing action.
  * `Deploy Bypass Switch`: Installs a temporary physical bypass around the faulted segment pending repair crews.

## 7. Harmonic Distortion Threshold Exceeded
* **Severity**: WARNING
* **Trigger**: Residential or Hospital THD exceeds 8%.
* **Context**: High penetration of EV charging and non-linear electronics injecting harmonic currents into the LV network.
* **Solutions**:
  * `Deploy Active Harmonic Filter`: Installs a dynamic filter that injects anti-phase currents, reducing THD by 4%.
  * `Curtail EV Charging`: Shuts down EV charging load temporarily to reduce harmonic injection.

## 8. HV Transformer Oil Overheating
* **Severity**: CRITICAL
* **Trigger**: HV Substation oil temperature exceeds 78°C (limit 80°C).
* **Context**: Sustained high loading (Joule heating) combined with high ambient temperature. Risks insulation breakdown.
* **Solutions**:
  * `Reduce System Load`: System-wide 10% load shed to reduce thermal stress.
  * `Activate Forced Cooling`: Deploys supplemental cooling fans to the transformer, accelerating the thermal decay curve.

## 9. Generation-Load Imbalance
* **Severity**: CRITICAL
* **Trigger**: Gap between total generation and load > 12% AND frequency deviation > 0.25 Hz.
* **Context**: The Coal Plant cannot ramp fast enough to meet a sudden demand spike, causing frequency to drop dangerously.
* **Solutions**:
  * `Activate Spinning Reserve`: Instantly dispatches the Gas Stabilizer plant.
  * `Trigger Demand Response`: Automatically drops residential/hospital base demand by 15%.

## 10. Critical Phase Imbalance
* **Severity**: WARNING
* **Trigger**: Any zone substation phase imbalance > 4%.
* **Context**: Uneven single-phase loading on the distribution feeders (e.g. uncoordinated residential EV charging) causing negative sequence currents.
* **Solutions**:
  * `Deploy Phase Balancer`: Installs a static VAR compensator at the affected zone to redistribute phase loading, halving the imbalance.
