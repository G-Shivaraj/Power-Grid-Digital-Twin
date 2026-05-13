import React from 'react';
import { BarChart2, Thermometer, Zap, Radio, Shield } from 'lucide-react';

function MetricRow({ label, value, unit, color = 'text-grid-text', bg = 'bg-slate-50' }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-md ${bg}`}>
      <span className="text-xs text-grid-muted">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>
        {value} <span className="font-normal text-grid-muted">{unit}</span>
      </span>
    </div>
  );
}

function VoltageBar({ voltage }) {
  const pct = Math.max(0, Math.min(105, (voltage ?? 1) * 100));
  const color = voltage >= 0.95 ? 'bg-green-500' : voltage >= 0.88 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = voltage >= 0.95 ? 'text-green-600' : voltage >= 0.88 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-grid-muted">Bus Voltage (pu)</span>
        <span className={`font-mono font-bold ${textColor}`}>{voltage?.toFixed(4)} pu</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-2.5 rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-0.5 text-slate-300">
        <span>0.0</span><span className="text-red-400">0.88</span><span className="text-amber-400">0.95</span><span>1.05</span>
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, color = 'text-grid-accent' }) {
  return (
    <div className={`flex items-center gap-1.5 mt-3 mb-1.5 ${color}`}>
      <Icon size={12} />
      <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
    </div>
  );
}

export default function ExplainabilityPanel({ node, nodeId }) {
  if (!node) return null;

  const type = node.type;
  const apparentPower = Math.sqrt((node.activePower ?? 0) ** 2 + (node.reactivePower ?? 0) ** 2).toFixed(2);
  const powerFactor = node.reactivePower > 0
    ? Math.cos(Math.atan2(node.reactivePower, node.activePower)).toFixed(3)
    : '1.000';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 size={13} className="text-grid-accent" />
        <span className="text-xs font-bold text-grid-muted uppercase tracking-wider">Live Telemetry</span>
        <span className="ml-auto text-xs font-mono text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
          Layer {node.layer}
        </span>
      </div>

      <VoltageBar voltage={node.voltage ?? 1.0} />

      <div className="mt-2 space-y-1">

        {/* ── Layer 1: Thermal Generators ── */}
        {type === 'thermal-generator' && (
          <>
            <SectionHead icon={Zap} title="Generator Telemetry" />
            <MetricRow label="Generator RPM" value={node.generator_rpm?.toFixed(1)} unit="RPM"
              color={Math.abs((node.generator_rpm ?? 3000) - 3000) < 15 ? 'text-green-700' : 'text-red-600'} />
            <MetricRow label="Active Power Out" value={node.active_power_mw?.toFixed(2)} unit="MW" color="text-green-700" />
            <MetricRow label="Reactive Power" value={node.reactive_power_mvar?.toFixed(2)} unit="MVAR" />
            <MetricRow label="Apparent Power" value={Math.sqrt((node.active_power_mw ?? 0) ** 2 + (node.reactive_power_mvar ?? 0) ** 2).toFixed(2)} unit="MVA" />
            <MetricRow label="Spinning Reserve" value={node.spinning_reserve_mw?.toFixed(1)} unit="MW" color="text-sky-700" />
            <MetricRow label="Ramp Rate" value={node.ramp_up_rate_mw_per_min} unit="MW/min" />
            {node.isStandby !== undefined && (
              <MetricRow label="Mode" value={node.isStandby ? 'HOT STANDBY' : 'DISPATCHED'} unit=""
                color={node.isStandby ? 'text-slate-500' : 'text-orange-600'} bg={node.isStandby ? 'bg-slate-50' : 'bg-orange-50'} />
            )}
          </>
        )}

        {/* ── Layer 1: Solar ── */}
        {type === 'renewable' && (
          <>
            <SectionHead icon={Zap} title="Solar Generation" color="text-amber-600" />
            <MetricRow label="Active Power" value={node.active_power_mw?.toFixed(2)} unit="MW" color="text-amber-700" />
            <MetricRow label="Reactive Power" value={node.reactive_power_mvar?.toFixed(2)} unit="MVAR" />
            <MetricRow label="Max Capacity" value={node.maxSolarOutput} unit="MW" />
            <MetricRow label="Irradiance Level" value={node.maxSolarOutput > 0 ? ((node.solarOutput / node.maxSolarOutput) * 100).toFixed(1) : '0.0'} unit="%" color="text-amber-600" />
            <MetricRow label="Output %" value={node.solarOutputPercent} unit="%" />
          </>
        )}

        {/* ── Layer 2: Primary HV Substation ── */}
        {type === 'primary-substation' && (
          <>
            <SectionHead icon={Thermometer} title="Transformer Health" color="text-orange-600" />
            <MetricRow label="Oil Temperature" value={node.transformer_oil_temp_c?.toFixed(2)} unit="°C"
              color={node.transformer_oil_temp_c > 80 ? 'text-red-600' : node.transformer_oil_temp_c > 65 ? 'text-amber-600' : 'text-green-700'} />
            <MetricRow label="Tap Changer Pos" value={node.tap_changer_position >= 0 ? `+${node.tap_changer_position}` : node.tap_changer_position} unit="" />
            <MetricRow label="Incoming Voltage" value={node.incoming_voltage_kv} unit="kV" />
            <MetricRow label="Outgoing Voltage" value={node.outgoing_voltage_kv?.toFixed(2)} unit="kV" />
            <MetricRow label="Total Load" value={node.activePower?.toFixed(2)} unit="MW" color="text-blue-700" />
            <MetricRow label="Reactive Load" value={node.reactivePower?.toFixed(2)} unit="MVAR" />
            <SectionHead icon={Shield} title="SCADA Security" color="text-red-600" />
            <MetricRow label="Cyber Intrusion" value={node.cyber_intrusion_flag ? '⚠ DETECTED' : '✓ CLEAR'} unit=""
              color={node.cyber_intrusion_flag ? 'text-red-700' : 'text-green-700'}
              bg={node.cyber_intrusion_flag ? 'bg-red-50' : 'bg-green-50'} />
          </>
        )}

        {/* ── Layer 2: Heavy Industry ── */}
        {type === 'heavy-load' && (
          <>
            <SectionHead icon={Zap} title="Industrial Load" color="text-red-600" />
            <MetricRow label="Machinery Load" value={node.heavy_machinery_load_kw?.toLocaleString()} unit="kW" color="text-red-700" />
            <MetricRow label="Active Power" value={node.activePower?.toFixed(2)} unit="MW" color="text-red-700" />
            <MetricRow label="Reactive Power" value={node.reactivePower?.toFixed(2)} unit="MVAR" color="text-purple-700" />
            <MetricRow label="Apparent Power S" value={apparentPower} unit="MVA" />
            <MetricRow label="Power Factor cos(θ)" value={node.power_factor_ratio?.toFixed(3)} unit=""
              color={node.power_factor_ratio < 0.8 ? 'text-red-600' : node.power_factor_ratio < 0.9 ? 'text-amber-600' : 'text-green-700'} />
          </>
        )}

        {/* ── Layer 3: Zone Substation ── */}
        {type === 'zone-substation' && (
          <>
            <SectionHead icon={Zap} title="Zone Distribution" />
            <MetricRow label="Feeder Breaker" value={node.feeder_breaker_status} unit=""
              color={node.feeder_breaker_status === 'CLOSED' ? 'text-green-700' : node.feeder_breaker_status === 'TRIPPED' ? 'text-red-700' : 'text-slate-500'}
              bg={node.feeder_breaker_status === 'TRIPPED' ? 'bg-red-50' : 'bg-slate-50'} />
            <MetricRow label="Phase Imbalance" value={node.phase_imbalance_percent?.toFixed(2)} unit="%"
              color={node.phase_imbalance_percent > 3 ? 'text-red-600' : node.phase_imbalance_percent > 1.5 ? 'text-amber-600' : 'text-green-700'} />
            <MetricRow label="Active Power" value={node.activePower?.toFixed(2)} unit="MW" color="text-blue-700" />
          </>
        )}

        {/* ── Layer 3: RMU ── */}
        {type === 'rmu' && (
          <>
            <SectionHead icon={Radio} title="Ring Main Unit" color="text-sky-600" />
            <MetricRow label="Fault Current" value={node.fault_current_detected_amps?.toFixed(0)} unit="A"
              color={node.fault_current_detected_amps > 1500 ? 'text-red-700' : 'text-green-700'}
              bg={node.fault_current_detected_amps > 1500 ? 'bg-red-50' : 'bg-green-50'} />
            <MetricRow label="Isolation Switch" value={node.isolation_switch_state ? 'ISOLATED' : 'CLOSED'} unit=""
              color={node.isolation_switch_state ? 'text-red-700' : 'text-green-700'} />
            <MetricRow label="Telemetry Latency" value={node.telemetry_latency_ms?.toFixed(1)} unit="ms"
              color={node.telemetry_latency_ms > 50 ? 'text-amber-600' : 'text-green-700'} />
          </>
        )}

        {/* ── Layer 4: Distribution Transformer ── */}
        {type === 'dist-transformer' && (
          <>
            <SectionHead icon={Thermometer} title="Transformer Health" color="text-orange-600" />
            <MetricRow label="Ambient Temp" value={node.ambient_temp_celsius?.toFixed(1)} unit="°C" />
            <MetricRow label="Load Saturation" value={node.load_saturation_percent?.toFixed(1)} unit="%"
              color={node.load_saturation_percent > 100 ? 'text-red-700' : node.load_saturation_percent > 80 ? 'text-amber-600' : 'text-green-700'}
              bg={node.load_saturation_percent > 100 ? 'bg-red-50' : 'bg-slate-50'} />
            <MetricRow label="Lifespan Remaining" value={node.estimated_lifespan_remaining_days?.toLocaleString()} unit="days"
              color={node.estimated_lifespan_remaining_days < 365 ? 'text-red-700' : node.estimated_lifespan_remaining_days < 1095 ? 'text-amber-600' : 'text-green-700'} />
            <MetricRow label="Active Power" value={node.activePower?.toFixed(2)} unit="MW" />
          </>
        )}

        {/* ── Layer 4: Smart Meter ── */}
        {type === 'smart-meter' && (
          <>
            <SectionHead icon={Zap} title="Prosumer Telemetry" color="text-indigo-600" />
            <MetricRow label="Net Metering" value={node.net_metering_kw?.toFixed(0)} unit="kW"
              color={node.net_metering_kw < 0 ? 'text-amber-700' : 'text-blue-700'}
              bg={node.net_metering_kw < 0 ? 'bg-amber-50' : 'bg-blue-50'} />
            <MetricRow label="EV Charging Draw" value={node.ev_charging_draw_kw?.toFixed(0)} unit="kW"
              color={node.ev_charging_draw_kw > 100 ? 'text-cyan-700' : 'text-slate-500'} />
            <MetricRow label="Harmonic Distortion" value={node.harmonic_distortion_percent?.toFixed(2)} unit="% THD"
              color={node.harmonic_distortion_percent > 5 ? 'text-red-700' : node.harmonic_distortion_percent > 3 ? 'text-amber-600' : 'text-green-700'}
              bg={node.harmonic_distortion_percent > 5 ? 'bg-red-50' : 'bg-slate-50'} />
            <MetricRow label="Base Demand" value={node.baseDemand} unit="MW" />
            <MetricRow label="Active Consumption" value={node.activePower?.toFixed(2)} unit="MW" color="text-blue-700" />
          </>
        )}
      </div>
    </div>
  );
}
