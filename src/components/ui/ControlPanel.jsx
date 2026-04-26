import React from 'react';
import { useGridStore } from '../../store/gridStore';
import { Settings, Play, Pause, Clock, RefreshCw, Factory } from 'lucide-react';
import ExplainabilityPanel from './ExplainabilityPanel';
import PowerFlowChart from './charts/PowerFlowChart';

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className="text-grid-accent" />
      <span className="text-xs font-bold text-grid-muted uppercase tracking-wider">{title}</span>
    </div>
  );
}

function NodeSliders({ node, nodeId }) {
  const updateNodeParameter = useGridStore(s => s.updateNodeParameter);

  if (!node) return null;

  const sliders = [];

  if (nodeId === 'solarFarm') {
    sliders.push(
      <div key="solar" className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-grid-muted">Solar Output %</span>
          <span className="font-mono font-semibold text-amber-600">{node.solarOutputPercent ?? 100}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={node.solarOutputPercent ?? 100}
          onChange={e => updateNodeParameter(nodeId, 'solarOutputPercent', Number(e.target.value))}
          className="w-full accent-amber-500"
        />
      </div>
    );
  }

  if (['residential1', 'residential2', 'residential3'].includes(nodeId)) {
    sliders.push(
      <div key="demand" className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-grid-muted">Base Demand</span>
          <span className="font-mono font-semibold text-blue-600">{node.baseDemand} MW</span>
        </div>
        <input
          type="range" min={2} max={20} step={0.5}
          value={node.baseDemand}
          onChange={e => updateNodeParameter(nodeId, 'baseDemand', Number(e.target.value))}
          className="w-full"
        />
      </div>
    );
  }

  if (nodeId === 'factory') {
    sliders.push(
      <div key="load" className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-grid-muted">Industrial Load</span>
          <span className="font-mono font-semibold text-red-600">{node.industrialLoad} MW</span>
        </div>
        <input
          type="range" min={5} max={60} step={1}
          value={node.industrialLoad}
          onChange={e => updateNodeParameter(nodeId, 'industrialLoad', Number(e.target.value))}
          className="w-full accent-red-500"
        />
      </div>,
      <div key="pf" className="space-y-1 mt-2">
        <div className="flex justify-between text-xs">
          <span className="text-grid-muted">Power Factor</span>
          <span className="font-mono font-semibold text-orange-600">{node.powerFactor?.toFixed(2)}</span>
        </div>
        <input
          type="range" min={0.5} max={1.0} step={0.01}
          value={node.powerFactor}
          onChange={e => updateNodeParameter(nodeId, 'powerFactor', Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    );
  }

  if (nodeId === 'substation') {
    sliders.push(
      <div key="cap" className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-grid-muted">Max Capacity</span>
          <span className="font-mono font-semibold text-sky-600">{node.maxCapacity} MVA</span>
        </div>
        <input
          type="range" min={20} max={100} step={5}
          value={node.maxCapacity}
          onChange={e => updateNodeParameter(nodeId, 'maxCapacity', Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </div>
    );
  }

  return sliders.length > 0 ? (
    <div className="space-y-3 mt-2">
      {sliders}
    </div>
  ) : (
    <p className="text-xs text-grid-muted italic mt-1">No adjustable parameters for this node.</p>
  );
}

export default function ControlPanel() {
  const simulation = useGridStore(s => s.simulation);
  const selectedNodeId = useGridStore(s => s.selectedNodeId);
  const nodes = useGridStore(s => s.nodes);
  const factory = useGridStore(s => s.factory);
  const setTimeOfDay = useGridStore(s => s.setTimeOfDay);
  const toggleAutoAdvance = useGridStore(s => s.toggleAutoAdvance);
  const toggleSimulation = useGridStore(s => s.toggleSimulation);
  const setPlacementMode = useGridStore(s => s.setPlacementMode);
  const removeFactory = useGridStore(s => s.removeFactory);
  const resetGrid = useGridStore(s => s.resetGrid);
  const placementMode = useGridStore(s => s.placementMode);

  const selectedNode = selectedNodeId === 'factory'
    ? factory
    : (selectedNodeId ? nodes[selectedNodeId] : null);

  const timeStr = `${String(Math.floor(simulation.timeOfDay)).padStart(2, '0')}:${String(Math.round((simulation.timeOfDay % 1) * 60)).padStart(2, '0')}`;

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
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={12} />
            Reset
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
            {simulation.autoAdvanceTime ? '⏱ Auto-advancing' : '⏸ Manual time control'}
          </button>
        </div>
      </div>

      {/* Load Palette */}
      <div className="panel p-3">
        <SectionTitle icon={Factory} title="Load Placement" />
        {!factory ? (
          <button
            onClick={() => setPlacementMode(true)}
            disabled={placementMode}
            className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              placementMode
                ? 'bg-red-100 text-red-600 cursor-not-allowed animate-pulse'
                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:shadow-sm'
            }`}
          >
            <Factory size={14} />
            {placementMode ? 'Click canvas to place...' : '+ Add Heavy Factory (35 MW)'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-red-700 font-semibold bg-red-50 rounded-lg px-2 py-1.5">
              <Factory size={12} />
              Factory Active — {factory.industrialLoad} MW
            </div>
            <button
              onClick={removeFactory}
              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              Remove Factory
            </button>
          </div>
        )}
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <div className="panel p-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-grid-text">{selectedNode.label}</span>
            <span className={`status-badge status-${selectedNode.status}`}>{selectedNode.status}</span>
          </div>
          {selectedNode.description && (
            <p className="text-xs text-grid-muted mb-2 leading-relaxed">{selectedNode.description}</p>
          )}
          <NodeSliders node={selectedNode} nodeId={selectedNodeId} />
        </div>
      )}

      {/* Explainability panel */}
      {selectedNode && (
        <div className="panel p-3 animate-fade-in">
          <ExplainabilityPanel node={selectedNode} nodeId={selectedNodeId} />
        </div>
      )}

      {/* Chart */}
      <div className="panel p-3">
        <PowerFlowChart />
      </div>
    </div>
  );
}
