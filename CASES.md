# CASES — Smart Grid Digital Twin Failure Scenarios

This document catalogs the **5 Core Real-World Grid Failure Cases** optimized for a clean, non-overlapping demonstration. Each case triggers dynamically based on physics simulation conditions. The AI Advisor detects these cases, provides a technical diagnosis, and recommends exactly **one guaranteed structured solution** which can be applied directly via the UI.

---

## 1. Transformer Overload
* **Severity**: CRITICAL
* **Trigger**: Distribution Transformer load saturation exceeds 95% (e.g., maxing Residential Base Demand).
* **Context**: Driven by peak residential demand. Accelerates thermal degradation and reduces transformer lifespan.
* **Guaranteed Solution**:
  * `Deploy Parallel Transformer`: Installs an auxiliary 11kV/400V transformer to halve the load saturation, instantly relieving thermal stress.

## 2. Industrial Surge Overload
* **Severity**: CRITICAL
* **Trigger**: Surge Event button clicked (simulates factory uncoordinated motor start).
* **Context**: Sudden uncoordinated motor start sequence at the factory complex drawing massive active and reactive power.
* **Guaranteed Solution**:
  * `Deploy Load Limiter`: Installs a hard electronic cap at 30 MW for the industrial feeder, forcibly rate-limiting the surge and stabilizing frequency.

## 3. Solar Intermittency Ramp
* **Severity**: WARNING
* **Trigger**: Daytime (06:00–19:00) AND Solar output slider dropped below 40%.
* **Context**: Cloud cover or sudden weather event causing a rapid drop in renewable generation, stressing the coal plant governor.
* **Guaranteed Solution**:
  * `Deploy Battery Storage (BESS)`: Installs a 15 MW / 30 MWh BESS at the solar farm to discharge and instantly smooth the ramp rate, bridging the generation gap.

## 4. SCADA Cyber Intrusion
* **Severity**: EMERGENCY
* **Trigger**: "Simulate Cyber Attack" button clicked.
* **Context**: Simulated Man-in-the-Middle attack spoofing telemetry (e.g., tap changer position) on the DNP3 protocol at the HV Substation.
* **Guaranteed Solution**:
  * `Deploy Backup RTU`: Spawns a hardened RTU with IEC 62351 encryption to secure the telemetry stream, bypassing the compromised channel.

## 5. RMU Fault & Feeder Isolation
* **Severity**: CRITICAL
* **Trigger**: "RMU Fault (Feeder Isolation)" button clicked.
* **Context**: Physical fault on the 11kV feeder. Triggers the self-healing ring tie to re-energize the neighborhood from the East feeder.
* **Guaranteed Solution**:
  * `Deploy Bypass Switch`: Installs a temporary physical bypass around the faulted segment, safely restoring the radial topology pending repair crews.
