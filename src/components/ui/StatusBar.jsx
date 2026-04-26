import React from 'react';
import { useGridStore } from '../../store/gridStore';
import { Activity, Zap, Sun, AlertTriangle, CheckCircle, Radio } from 'lucide-react';

function Metric({ icon: Icon, label, value, unit, color = 'text-grid-text' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-lg border border-grid-border">
      <Icon size={14} className="text-grid-muted flex-shrink-0" />
      <span className="text-xs text-grid-muted">{label}</span>
      <span className={`text-xs font-bold font-mono ml-auto ${color}`}>{value}</span>
      {unit && <span className="text-xs text-grid-muted">{unit}</span>}
    </div>
  );
}

export default function StatusBar() {
  const simulation = useGridStore(s => s.simulation);
  const nodes = useGridStore(s => s.nodes);
  const factory = useGridStore(s => s.factory);
  const solarNode = nodes.solarFarm;

  const faultActive = simulation.faultActive;
  const freqDiff = Math.abs(simulation.gridFrequency - 50).toFixed(3);
  const freqColor = parseFloat(freqDiff) > 0.5 ? 'text-red-600' : parseFloat(freqDiff) > 0.2 ? 'text-amber-600' : 'text-green-600';

  const overallStatus = faultActive ? 'FAULT' : 'NOMINAL';
  const statusColor = faultActive ? 'bg-red-500' : 'bg-green-500';
  const timeStr = `${String(Math.floor(simulation.timeOfDay)).padStart(2, '0')}:${String(Math.round((simulation.timeOfDay % 1) * 60)).padStart(2, '0')}`;

  return (
    <header className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b border-grid-border bg-white/80 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 bg-gradient-to-br from-sky-500 to-blue-700 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold text-grid-text tracking-tight">Smart Grid DT</span>
      </div>

      <div className="h-5 w-px bg-grid-border" />

      {/* Metrics row */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        <Metric icon={Activity} label="Frequency" value={simulation.gridFrequency?.toFixed(3)} unit="Hz" color={freqColor} />
        <Metric icon={Zap} label="Generation" value={simulation.totalGeneration?.toFixed(1)} unit="MW" color="text-green-700" />
        <Metric icon={Zap} label="Load" value={simulation.totalLoad?.toFixed(1)} unit="MW" color={simulation.totalLoad > 40 ? 'text-red-600' : 'text-grid-text'} />
        <Metric icon={Sun} label="Solar" value={solarNode.solarOutput?.toFixed(1)} unit="MW" color="text-amber-600" />
        <Metric icon={Radio} label="Sim Time" value={timeStr} color="text-sky-600" />
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold ${faultActive ? 'bg-red-500 alarm-pulse' : 'bg-green-500'}`}>
        {faultActive ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
        {overallStatus}
      </div>
    </header>
  );
}
