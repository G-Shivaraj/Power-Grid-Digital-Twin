import React from 'react';
import { BarChart2 } from 'lucide-react';

function MetricRow({ label, value, unit, color = 'text-grid-text', bg = 'bg-slate-50' }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-md ${bg}`}>
      <span className="text-xs text-grid-muted">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>{value} <span className="font-normal text-grid-muted">{unit}</span></span>
    </div>
  );
}

function VoltageBar({ voltage }) {
  const pct = Math.max(0, Math.min(100, voltage * 100));
  const color = voltage >= 0.95 ? 'bg-green-500' : voltage >= 0.88 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-grid-muted">Voltage (pu)</span>
        <span className={`font-mono font-bold ${voltage >= 0.95 ? 'text-green-600' : voltage >= 0.88 ? 'text-amber-600' : 'text-red-600'}`}>
          {voltage?.toFixed(4)} pu
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-0.5 text-slate-300">
        <span>0.0</span>
        <span className="text-amber-400">0.88</span>
        <span className="text-green-400">0.95</span>
        <span>1.05</span>
      </div>
    </div>
  );
}

export default function ExplainabilityPanel({ node, nodeId }) {
  if (!node) return null;

  const isLoad = ['load', 'heavy-load'].includes(node.type);
  const isSource = ['source', 'renewable'].includes(node.type);
  const isCompensator = node.type === 'compensator';

  // Derived quantities
  const powerFactor = node.reactivePower > 0
    ? Math.cos(Math.atan2(node.reactivePower, node.activePower)).toFixed(3)
    : '1.000';
  const apparentPower = Math.sqrt((node.activePower ?? 0) ** 2 + (node.reactivePower ?? 0) ** 2).toFixed(2);
  const current = node.voltage > 0.01
    ? (Math.sqrt((node.activePower ?? 0) ** 2 + (node.reactivePower ?? 0) ** 2) / (node.voltage * 33)).toFixed(2)
    : '—';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 size={13} className="text-grid-accent" />
        <span className="text-xs font-bold text-grid-muted uppercase tracking-wider">Live Telemetry</span>
      </div>

      <VoltageBar voltage={node.voltage ?? 1.0} />

      <div className="mt-2 space-y-1">
        {isSource && (
          <>
            <MetricRow label="Active Power Out" value={node.activePower?.toFixed(2)} unit="MW" color="text-green-700" />
            <MetricRow label="Reactive Power" value={node.reactivePower?.toFixed(2)} unit="MVAR" />
            <MetricRow label="Apparent Power" value={apparentPower} unit="MVA" />
            {nodeId === 'solarFarm' && (
              <MetricRow label="Solar Irradiance" value={((node.solarOutput / node.maxSolarOutput) * 100).toFixed(1)} unit="%" color="text-amber-600" />
            )}
            {nodeId === 'substation' && (
              <MetricRow label="Bus Current" value={current} unit="kA" />
            )}
          </>
        )}

        {isLoad && (
          <>
            <MetricRow label="Active Demand" value={node.activePower?.toFixed(2)} unit="MW" color="text-blue-700" />
            <MetricRow label="Reactive Demand" value={node.reactivePower?.toFixed(2)} unit="MVAR" color="text-purple-700" />
            <MetricRow label="Apparent Power" value={apparentPower} unit="MVA" />
            <MetricRow label="Power Factor" value={powerFactor} unit="pu" color={parseFloat(powerFactor) < 0.85 ? 'text-red-600' : 'text-green-600'} />
            <MetricRow label="Est. Current" value={current} unit="kA" />
            {nodeId === 'factory' && (
              <MetricRow label="Load Category" value="Industrial" unit="" color="text-red-700" bg="bg-red-50" />
            )}
          </>
        )}

        {isCompensator && (
          <>
            <MetricRow label="Q Support" value={`+${node.reactivePowerSupport}`} unit="MVAR" color="text-sky-700" />
            <MetricRow label="Type" value="Shunt Capacitor" unit="" />
            <MetricRow label="Status" value="Online" unit="" color="text-green-600" bg="bg-green-50" />
          </>
        )}
      </div>
    </div>
  );
}
