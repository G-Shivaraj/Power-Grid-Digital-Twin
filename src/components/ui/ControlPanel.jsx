import React from 'react';
import { useGridStore } from '../../store/gridStore';
import { Settings, Play, Pause, Clock, RefreshCw, Zap, Shield, AlertTriangle, Sun, Layers, Trash2 } from 'lucide-react';
import ExplainabilityPanel from './ExplainabilityPanel';
import PowerFlowChart from './charts/PowerFlowChart';

function SectionTitle({ icon: Icon, title, color = 'text-grid-accent' }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className={color} />
      <span className="text-xs font-bold text-grid-muted uppercase tracking-wider">{title}</span>
    </div>
  );
}

function ScenarioButton({ label, active, onClick, color = 'red', icon: Icon }) {
  const activeClass = {
    red:    'bg-red-100 text-red-700 border-red-300 shadow-inner',
    amber:  'bg-amber-100 text-amber-700 border-amber-300 shadow-inner',
    purple: 'bg-purple-100 text-purple-700 border-purple-300 shadow-inner',
  }[color];
  const idleClass = {
    red:    'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  }[color];

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${active ? activeClass : idleClass}`}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${active ? 'bg-white/60' : 'bg-transparent'}`}>
        {active ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

export default function ControlPanel() {
  const simulation    = useGridStore(s => s.simulation);
  const selectedNodeId= useGridStore(s => s.selectedNodeId);
  const nodes         = useGridStore(s => s.nodes);
  const setTimeOfDay  = useGridStore(s => s.setTimeOfDay);
  const toggleAutoAdvance   = useGridStore(s => s.toggleAutoAdvance);
  const toggleSimulation    = useGridStore(s => s.toggleSimulation);
  const resetGrid           = useGridStore(s => s.resetGrid);
  const toggleSurgeEvent    = useGridStore(s => s.toggleSurgeEvent);
  const triggerCyberIntrusion = useGridStore(s => s.triggerCyberIntrusion);
  const clearCyberIntrusion = useGridStore(s => s.clearCyberIntrusion);
  const triggerRMUFault     = useGridStore(s => s.triggerRMUFault);
  const clearFault          = useGridStore(s => s.clearFault);
  const updateNodeParameter = useGridStore(s => s.updateNodeParameter);
  const dynamicNodes = useGridStore(s => s.dynamicNodes);
  const removeDynamicNode = useGridStore(s => s.removeDynamicNode);

  const selectedNode = selectedNodeId ? (nodes[selectedNodeId] || dynamicNodes[selectedNodeId]) : null;
  const timeStr = `${String(Math.floor(simulation.timeOfDay)).padStart(2, '0')}:${String(Math.round((simulation.timeOfDay % 1) * 60)).padStart(2, '0')}`;

  const cyberActive = simulation.cyberIntrusionActive || nodes.hvSubstation?.cyber_intrusion_flag;

  return (
    <div className="flex flex-col gap-3">

      {/* Simulation Controls */}
      <div className="panel p-3">
        <SectionTitle icon={Settings} title="Simulation" />
        <div className="flex gap-2">
          <button
            onClick={toggleSimulation}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              simulation.isRunning ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {simulation.isRunning ? <Pause size={12} /> : <Play size={12} />}
            {simulation.isRunning ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={resetGrid}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={12} />Reset
          </button>
        </div>

        {/* Time of day */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1 text-grid-muted"><Clock size={11} /> Sim Time</span>
            <span className="font-mono font-semibold text-sky-600">{timeStr}</span>
          </div>
          <input
            type="range" min={0} max={24} step={0.25}
            value={simulation.timeOfDay}
            onChange={e => setTimeOfDay(e.target.value)}
            className="w-full accent-sky-500"
            disabled={simulation.autoAdvanceTime && simulation.isRunning}
          />
          <button
            onClick={toggleAutoAdvance}
            className={`w-full text-xs py-1 rounded-md font-medium transition-colors ${
              simulation.autoAdvanceTime ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {simulation.autoAdvanceTime ? '⏱ Auto-advancing' : '⏸ Manual time'}
          </button>
        </div>
      </div>

      {/* Scenario Injection Panel */}
      <div className="panel p-3">
        <SectionTitle icon={AlertTriangle} title="Scenario Injection" color="text-red-500" />
        <div className="space-y-2">
          <ScenarioButton
            label="Industrial Surge Event"
            active={simulation.surgeEventActive}
            onClick={toggleSurgeEvent}
            color="red"
            icon={Zap}
          />
          <ScenarioButton
            label="Cyber Intrusion (SCADA)"
            active={cyberActive}
            onClick={cyberActive ? clearCyberIntrusion : triggerCyberIntrusion}
            color="purple"
            icon={Shield}
          />
          <ScenarioButton
            label="RMU Fault (Feeder Isolation)"
            active={simulation.faultActive}
            onClick={simulation.faultActive ? clearFault : triggerRMUFault}
            color="orange"
            icon={AlertTriangle}
          />
        </div>
        {simulation.selfHealingActive && (
          <div className="mt-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-800 font-semibold">🔄 Self-Healing Active</p>
            <p className="text-xs text-green-700 mt-0.5">{simulation.selfHealingLog}</p>
          </div>
        )}
      </div>

      {/* Solar output control */}
      <div className="panel p-3">
        <SectionTitle icon={Sun} title="Solar Farm Control" color="text-amber-500" />
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-grid-muted">Output Limit</span>
            <span className="font-mono font-semibold text-amber-600">{nodes.solarFarm?.solarOutputPercent ?? 100}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={nodes.solarFarm?.solarOutputPercent ?? 100}
            onChange={e => updateNodeParameter('solarFarm', 'solarOutputPercent', Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
      </div>

      {/* Residential demand control */}
      <div className="panel p-3">
        <SectionTitle icon={Zap} title="Demand Control" />
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-grid-muted">Residential Base</span>
              <span className="font-mono font-semibold text-blue-600">{nodes.smartMeter_residential?.baseDemand} MW</span>
            </div>
            <input
              type="range" min={5} max={35} step={0.5}
              value={nodes.smartMeter_residential?.baseDemand ?? 18}
              onChange={e => updateNodeParameter('smartMeter_residential', 'baseDemand', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-grid-muted">Hospital Base</span>
              <span className="font-mono font-semibold text-blue-600">{nodes.smartMeter_hospital?.baseDemand} MW</span>
            </div>
            <input
              type="range" min={4} max={22} step={0.5}
              value={nodes.smartMeter_hospital?.baseDemand ?? 12}
              onChange={e => updateNodeParameter('smartMeter_hospital', 'baseDemand', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-grid-muted">Industry cos(θ)</span>
              <span className="font-mono font-semibold text-orange-600">
                {nodes.heavyIndustry?.power_factor_ratio?.toFixed(2)}
              </span>
            </div>
            <input
              type="range" min={0.5} max={1.0} step={0.01}
              value={nodes.heavyIndustry?.power_factor_ratio ?? 0.82}
              onChange={e => updateNodeParameter('heavyIndustry', 'power_factor_ratio', Number(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Components */}
      {Object.keys(dynamicNodes).length > 0 && (
        <div className="panel p-3 border-indigo-200 bg-indigo-50/30">
          <SectionTitle icon={Layers} title="Deployed Solutions" />
          <div className="space-y-1.5 mt-1">
            {Object.values(dynamicNodes).map(node => (
              <div key={node.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-indigo-100 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700">{node.label}</span>
                  <span className="text-[9px] text-slate-500">{node.type}</span>
                </div>
                <button 
                  onClick={() => removeDynamicNode(node.id)}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Component"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected node telemetry */}
      {selectedNode && (
        <>
          <div className="panel p-3 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-grid-text">{selectedNode.label}</span>
              <span className={`status-badge status-${selectedNode.status}`}>{selectedNode.status}</span>
            </div>
            {selectedNode.description && (
              <p className="text-xs text-grid-muted mb-2 leading-relaxed">{selectedNode.description}</p>
            )}
          </div>
          <div className="panel p-3 animate-fade-in">
            <ExplainabilityPanel node={selectedNode} nodeId={selectedNodeId} />
          </div>
        </>
      )}

      {/* Chart */}
      <div className="panel p-3">
        <PowerFlowChart />
      </div>
    </div>
  );
}
