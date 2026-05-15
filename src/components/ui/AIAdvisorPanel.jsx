import React, { useRef, useEffect } from 'react';
import { useGridStore } from '../../store/gridStore';
import { Bot, CheckCircle, AlertTriangle, Loader, Cpu, PlayCircle } from 'lucide-react';
import { ALL_CASES } from '../../engine/caseDefinitions';

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
  const { aiAdvisor, simulation, activeCases, pendingActions, appliedActions, applyAction, clearAIMessages } = useGridStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiAdvisor.messages, aiAdvisor.isAnalyzing, pendingActions]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-inner">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 tracking-tight">AI Operations Advisor</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Powered by gpt-4o-mini</p>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${activeCases.length > 0 ? 'bg-red-500 alarm-pulse' : aiAdvisor.isAnalyzing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {aiAdvisor.messages.length === 0 && !aiAdvisor.isAnalyzing && activeCases.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8 opacity-60">
            <Bot size={32} className="text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-slate-500">System Nominal</p>
              <p className="text-xs text-slate-400 mt-1">Monitoring grid telemetry for anomalies.</p>
            </div>
          </div>
        )}

        {/* Standard messages log */}
        {aiAdvisor.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Case Analysis indicator */}
        {aiAdvisor.isAnalyzing && (
          <div className="chat-message chat-message-ai border-l-2 border-l-indigo-400">
            <div className="flex items-center gap-2">
              <Loader size={14} className="text-indigo-500 animate-spin" />
              <span className="text-xs font-medium text-slate-600">Synthesizing telemetry & generating solutions...</span>
            </div>
          </div>
        )}

        {/* Actionable Recommendations */}
        {pendingActions.map((actionGroup, idx) => {
          const caseDef = ALL_CASES.find(c => c.id === actionGroup.caseId);
          if (!caseDef) return null;
          
          return (
            <div key={`pending-${idx}`} className="bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden animate-slide-up">
              <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex items-center gap-2">
                <Cpu size={14} className="text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900">Recommended Actions for: {caseDef.title}</span>
              </div>
              <div className="p-2 space-y-2">
                {actionGroup.actions.map(actionId => {
                  const actionDef = caseDef.availableActions.find(a => a.id === actionId);
                  if (!actionDef) return null;

                  const isApplied = appliedActions.some(a => a.id === actionId);

                  return (
                    <button
                      key={actionId}
                      onClick={() => applyAction(actionDef, actionGroup.caseId)}
                      disabled={isApplied}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                        isApplied 
                          ? 'bg-emerald-50 border-emerald-200 opacity-80 cursor-not-allowed' 
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm active:scale-[0.98]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">{actionDef.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`font-bold ${isApplied ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {actionDef.label}
                            </span>
                            {isApplied && <CheckCircle size={12} className="text-emerald-500" />}
                          </div>
                          <p className={`leading-snug ${isApplied ? 'text-emerald-600/80' : 'text-slate-500'}`}>
                            {actionDef.description}
                          </p>
                          {!isApplied && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex gap-1 text-[10px] text-slate-400 font-medium">
                              <span className="text-indigo-400">↳ Expected:</span>
                              <span>{actionDef.expectedOutcome}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer controls */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 bg-white">
        {aiAdvisor.messages.length > 0 && (
          <button
            onClick={clearAIMessages}
            className="w-full py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Clear Session History
          </button>
        )}
      </div>
    </div>
  );
}
