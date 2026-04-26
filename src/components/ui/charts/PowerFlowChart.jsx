import React from 'react';
import { useGridStore } from '../../../store/gridStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-3" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-mono font-bold">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function PowerFlowChart() {
  const history = useGridStore(s => s.history);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={13} className="text-grid-accent" />
        <span className="text-xs font-bold text-grid-muted uppercase tracking-wider">Power Flow (60s)</span>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="tick" tick={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="totalGen" stroke="#22C55E" fill="url(#genGrad)" strokeWidth={1.5} name="Gen (MW)" dot={false} />
            <Area type="monotone" dataKey="totalLoad" stroke="#3B82F6" fill="url(#loadGrad)" strokeWidth={1.5} name="Load (MW)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
