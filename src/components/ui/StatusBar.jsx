import React from 'react';
import { useGridStore } from '../../store/gridStore';
import { Activity, Zap, Sun, AlertTriangle, CheckCircle, Radio, Maximize2, Minimize2, Shield, RefreshCw } from 'lucide-react';

function Metric({ icon: Icon, label, value, unit, color = 'text-grid-text' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-lg border border-grid-border flex-shrink-0">
      <Icon size={13} className="text-grid-muted flex-shrink-0" />
      <span className="text-xs text-grid-muted whitespace-nowrap">{label}</span>
      <span className={`text-xs font-bold font-mono ml-auto ${color}`}>{value}</span>
      {unit && <span className="text-xs text-grid-muted">{unit}</span>}
    </div>
  );
}

export default function StatusBar() {
  const simulation   = useGridStore(s => s.simulation);
  const nodes        = useGridStore(s => s.nodes);
  const isFullscreen = useGridStore(s => s.isFullscreen);
  const toggleFullscreen = useGridStore(s => s.toggleFullscreen);
  const activeCases  = useGridStore(s => s.activeCases);

  const faultActive = simulation.faultActive || activeCases.length > 0;
  const selfHealing = simulation.selfHealingActive;
  const cyberActive = simulation.cyberIntrusionActive || nodes.hvSubstation?.cyber_intrusion_flag || activeCases.some(c => c.id === 'cyber_intrusion');

  const freqDiff   = Math.abs((simulation.gridFrequency ?? 50) - 50);
  const freqColor  = freqDiff > 0.5 ? 'text-red-600' : freqDiff > 0.2 ? 'text-amber-600' : 'text-green-600';

  const coalRPM    = nodes.coalPlant?.generator_rpm ?? 3000;
  const rpmDiff    = Math.abs(coalRPM - 3000);
  const rpmColor   = rpmDiff > 50 ? 'text-red-600' : rpmDiff > 20 ? 'text-amber-600' : 'text-green-600';

  const solarMW    = nodes.solarFarm?.solarOutput ?? 0;
  const oilTemp    = nodes.hvSubstation?.transformer_oil_temp_c ?? 52;
  const oilColor   = oilTemp > 80 ? 'text-red-600' : oilTemp > 65 ? 'text-amber-600' : 'text-green-700';

  const timeStr = `${String(Math.floor(simulation.timeOfDay)).padStart(2, '0')}:${String(Math.round((simulation.timeOfDay % 1) * 60)).padStart(2, '0')}`;

  const overallStatus = cyberActive ? 'CYBER ATTACK' : faultActive ? `${activeCases.length} ACTIVE CASE${activeCases.length > 1 ? 'S' : ''}` : selfHealing ? 'SELF-HEALING' : 'NOMINAL';
  const statusClass   = cyberActive
    ? 'bg-purple-600 alarm-pulse'
    : faultActive
      ? 'bg-red-500 alarm-pulse'
      : selfHealing
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <header className="h-12 flex-shrink-0 flex items-center gap-2 px-4 border-b border-grid-border bg-white/80 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-1 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-sky-500 to-blue-700 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold text-grid-text tracking-tight whitespace-nowrap">City Grid DT</span>
      </div>

      <div className="h-5 w-px bg-grid-border flex-shrink-0" />

      {/* Metrics */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
        <Metric icon={Activity} label="Frequency" value={simulation.gridFrequency?.toFixed(3)} unit="Hz" color={freqColor} />
        <Metric icon={Activity} label="Coal RPM" value={coalRPM?.toFixed(0)} unit="rpm" color={rpmColor} />
        <Metric icon={Zap}      label="Generation" value={simulation.totalGeneration?.toFixed(1)} unit="MW" color="text-green-700" />
        <Metric icon={Zap}      label="Load" value={simulation.totalLoad?.toFixed(1)} unit="MW" color={simulation.totalLoad > 200 ? 'text-red-600' : 'text-grid-text'} />
        <Metric icon={Sun}      label="Solar" value={solarMW?.toFixed(1)} unit="MW" color="text-amber-600" />
        <Metric icon={Radio}    label="Oil Temp" value={oilTemp?.toFixed(1)} unit="°C" color={oilColor} />
        <Metric icon={Radio}    label="Sim Time" value={timeStr} color="text-sky-600" />
        {selfHealing && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200 flex-shrink-0">
            <RefreshCw size={12} className="text-amber-600 animate-spin" />
            <span className="text-xs font-bold text-amber-700 whitespace-nowrap">Ring Tie Active</span>
          </div>
        )}
        {cyberActive && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200 flex-shrink-0">
            <Shield size={12} className="text-purple-600" />
            <span className="text-xs font-bold text-purple-700 whitespace-nowrap">SCADA Breach</span>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold flex-shrink-0 ${statusClass}`}>
        {cyberActive ? <Shield size={12} /> : faultActive ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
        {overallStatus}
      </div>

      <div className="h-5 w-px bg-grid-border ml-1 flex-shrink-0" />

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        className="p-1.5 text-grid-muted hover:text-grid-text hover:bg-black/5 rounded transition-colors flex-shrink-0"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </header>
  );
}
