'use client';

import { useState } from 'react';
import { Copy, Check, Code, Paintbrush, X } from 'lucide-react';
import { api, Agent } from '@/lib/api';

interface WidgetEmbedModalProps {
  agent: Agent;
  onClose: () => void;
  onUpdate: () => void;
}

export default function WidgetEmbedModal({ agent, onClose, onUpdate }: WidgetEmbedModalProps) {
  const [copied, setCopied] = useState(false);
  const [color, setColor] = useState(agent.primary_color || '#3B82F6');
  const [welcomeMsg, setWelcomeMsg] = useState(agent.welcome_message || '');
  const [saving, setSaving] = useState(false);

  const embedScript = `<!-- Universal AI Agent Chatbot Embed -->
<script 
  src="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/widget.js" 
  data-agent-id="${agent.id}" 
  async>
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCustomization = async () => {
    setSaving(true);
    try {
      await api.updateAgent(agent.id, {
        primary_color: color,
        welcome_message: welcomeMsg,
      });
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Code className="w-4 h-4" /> Embeddable Chat Widget
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Deploy Chatbot on Any Website</h2>
          <p className="text-xs text-slate-400 mt-1">
            Copy and paste this lightweight script snippet before the closing <code className="text-slate-300 font-mono">&lt;/body&gt;</code> tag on your HTML website.
          </p>
        </div>

        {/* Code Box */}
        <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-blue-300 overflow-x-auto">
          <pre>{embedScript}</pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        {/* Branding Customization */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Paintbrush className="w-4 h-4 text-purple-400" /> Widget Customization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">Primary Brand Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-950 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">Welcome Greeting</label>
              <input
                type="text"
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          <button
            onClick={handleSaveCustomization}
            disabled={saving}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-colors"
          >
            {saving ? 'Saving Preferences...' : 'Save Widget Branding'}
          </button>
        </div>
      </div>
    </div>
  );
}
