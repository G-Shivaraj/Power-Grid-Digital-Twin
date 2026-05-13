import React, { useRef, useEffect } from 'react';
import { useGridStore } from '../../store/gridStore';
import { Bot, Zap, CheckCircle, AlertTriangle, Loader, Cpu } from 'lucide-react';

function MessageBubble({ msg }) {
  const typeClass = {
    system: 'chat-message-system',
    ai: 'chat-message-ai',
    fault: 'chat-message-fault',
    success: 'chat-message-success',
  }[msg.type] || 'chat-message-ai';

  const Icon = {
    system: Cpu,
    ai: Bot,
    fault: AlertTriangle,
    success: CheckCircle,
  }[msg.type] || Bot;

  const iconColor = {
    system: 'text-sky-500',
    ai: 'text-slate-500',
    fault: 'text-red-500',
    success: 'text-green-500',
  }[msg.type] || 'text-slate-500';

  return (
    <div className={`chat-message ${typeClass} animate-slide-up`}>
      <div className="flex items-start gap-2">
        <Icon size={13} className={`${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 text-xs leading-relaxed whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
      <div className="text-right mt-1">
        <span className="text-xs opacity-50">
          {new Date(msg.id).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default function AIAdvisorPanel() {
  const aiAdvisor = useGridStore(s => s.aiAdvisor);
  const simulation = useGridStore(s => s.simulation);
  const clearAIMessages = useGridStore(s => s.clearAIMessages);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiAdvisor.messages, aiAdvisor.isAnalyzing]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-grid-border bg-white/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-grid-text">AI Operations Advisor</p>
              <p className="text-xs text-grid-muted">Powered by gpt-4o-mini</p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${simulation.faultActive ? 'bg-red-500 alarm-pulse' : aiAdvisor.isAnalyzing ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
      </div>

      {/* Status strip */}
      {simulation.faultActive && !aiAdvisor.isAnalyzing && aiAdvisor.messages.length === 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold animate-pulse-fast">
          <AlertTriangle size={12} />
          FAULT DETECTED — Analyzing grid state...
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {aiAdvisor.messages.length === 0 && !aiAdvisor.isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Zap size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">AI Advisor on Standby</p>
              <p className="text-xs text-slate-400 mt-1">Trigger a scenario (Surge/Cyber)<br />or wait for a grid fault event.</p>
            </div>
          </div>
        )}

        {aiAdvisor.messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {aiAdvisor.isAnalyzing && (
          <div className="chat-message chat-message-ai">
            <div className="flex items-center gap-2">
              <Loader size={13} className="text-slate-500 animate-spin" />
              <span className="text-xs text-slate-500">Analyzing grid telemetry...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action area */}
      <div className="flex-shrink-0 p-3 border-t border-grid-border bg-white/50 space-y-2">
        {/* Recommendation display */}
        {aiAdvisor.recommendation && (
          <div className="w-full py-2 px-3 bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold rounded-xl">
            <p className="font-bold text-sky-700 mb-0.5">📋 AI Recommendation:</p>
            <p className="text-xs leading-relaxed">{aiAdvisor.recommendation}</p>
          </div>
        )}

        {/* Clear button */}
        {aiAdvisor.messages.length > 0 && (
          <button
            onClick={clearAIMessages}
            className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
