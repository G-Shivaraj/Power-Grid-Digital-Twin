import React from 'react';
import StatusBar from './StatusBar';
import ControlPanel from './ControlPanel';
import AIAdvisorPanel from './AIAdvisorPanel';
import GridCanvas from '../canvas/GridCanvas';
import { useGridStore } from '../../store/gridStore';

export default function Layout({ children }) {
  const isFullscreen = useGridStore(s => s.isFullscreen);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-grid-bg font-sans">
      {/* Top status bar */}
      <StatusBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {!isFullscreen && (
          <aside className="w-72 flex-shrink-0 flex flex-col gap-3 p-3 overflow-y-auto border-r border-grid-border bg-white/60 backdrop-blur-sm">
            <ControlPanel />
          </aside>
        )}

        {/* Center canvas */}
        <main className="flex-1 relative overflow-hidden">
          <GridCanvas />
        </main>

        {/* Right panel */}
        {!isFullscreen && (
          <aside className="w-80 flex-shrink-0 flex flex-col border-l border-grid-border bg-white/60 backdrop-blur-sm">
            <AIAdvisorPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
