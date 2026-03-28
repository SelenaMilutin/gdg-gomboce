/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, Calendar, Sparkles, Bell, 
  CheckCircle2, AlertCircle, PhoneCall, Info,
  Plus, ChevronRight, MessageSquare, MapPin, Trash2
} from 'lucide-react';
import { callGemini, AGENT_PROMPTS } from '../services/aiService';
import { db, deleteDoc, doc, handleFirestoreError, OperationType, addDoc, collection } from '../firebase';

export default function CaregiverDashboard() {
  const [activeTab, setActiveTab] = useState<'log' | 'routine' | 'ai' | 'location'>('log');
  const { seniorProfile, activityLog } = useApp();

  const unreadAlerts = activityLog.filter(l => l.outcome === 'Emergency' || l.outcome === 'No Response').length;

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-24 font-sans text-[#2D3748]">
      {/* Header */}
      <header className="bg-white p-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#5AB9B1] rounded-full flex items-center justify-center text-white font-bold text-xl">
              {seniorProfile.name[0]}
            </div>
            <div>
              <h1 className="font-bold text-lg">{seniorProfile.name}</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-[#718096]">Last active 12 min ago</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <Bell className="text-[#4A5568]" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'log' && <ActivityLog key="log" />}
          {activeTab === 'routine' && <RoutineCalendar key="routine" />}
          {activeTab === 'ai' && <AISummaryTab key="ai" />}
          {activeTab === 'location' && <LocationTab key="location" />}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-6 py-3 flex justify-between items-center z-20">
        <NavButton 
          active={activeTab === 'log'} 
          onClick={() => setActiveTab('log')} 
          icon={<Activity size={24} />} 
          label="Activity" 
        />
        <NavButton 
          active={activeTab === 'routine'} 
          onClick={() => setActiveTab('routine')} 
          icon={<Calendar size={24} />} 
          label="Routine" 
        />
        <NavButton 
          active={activeTab === 'location'} 
          onClick={() => setActiveTab('location')} 
          icon={<MapPin size={24} />} 
          label="Location" 
        />
        <NavButton 
          active={activeTab === 'ai'} 
          onClick={() => setActiveTab('ai')} 
          icon={<Sparkles size={24} />} 
          label="AI Insights" 
        />
      </nav>
    </div>
  );
}

function LocationTab() {
  const { currentLocation, seniorProfile } = useApp();

  if (!currentLocation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#718096]">
        <MapPin size={48} className="mb-4 opacity-20" />
        <p>Location data not available</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0]">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-[#5AB9B1]" />
          Current Location
        </h2>
        
        <div className="aspect-video bg-[#EDF2F7] rounded-2xl relative overflow-hidden flex items-center justify-center">
          {/* Simple Map Visualization */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#CBD5E0 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="relative z-10 flex flex-col items-center">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-12 h-12 bg-[#5AB9B1] rounded-full flex items-center justify-center text-white shadow-lg"
            >
              <MapPin size={24} />
            </motion.div>
            <div className="mt-4 bg-white px-4 py-2 rounded-full shadow-md text-sm font-bold">
              {seniorProfile.name.split(' ')[0]} is here
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center p-4 bg-[#F7FAFC] rounded-2xl border border-[#EDF2F7]">
            <span className="text-sm text-[#718096]">Coordinates</span>
            <span className="text-sm font-mono font-bold">
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between items-center p-4 bg-[#F7FAFC] rounded-2xl border border-[#EDF2F7]">
            <span className="text-sm text-[#718096]">Last Updated</span>
            <span className="text-sm font-bold">
              {currentLocation.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <button 
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${currentLocation.latitude},${currentLocation.longitude}`)}
          className="w-full mt-6 bg-[#5AB9B1] text-white font-bold py-4 rounded-xl hover:bg-[#4A9D96] transition-colors flex items-center justify-center gap-2"
        >
          Open in Google Maps
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex gap-4">
        <AlertCircle className="text-amber-500 shrink-0" size={24} />
        <div>
          <h4 className="font-bold text-amber-800 text-sm mb-1">Safety Tip</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            Location is updated every minute. If you notice unusual movement or the location hasn't updated in a while, consider calling {seniorProfile.name.split(' ')[0]} or their emergency contact.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-[#5AB9B1]' : 'text-[#A0AEC0]'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ActivityLog() {
  const { activityLog } = useApp();
  const [filter, setFilter] = useState('All');

  const filteredLog = activityLog.filter(l => {
    if (filter === 'All') return true;
    if (filter === 'Completed') return l.outcome === 'Completed';
    if (filter === 'Missed') return l.outcome === 'No Response';
    if (filter === 'Emergencies') return l.outcome === 'Emergency';
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', 'Completed', 'Missed', 'Emergencies'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-[#5AB9B1] text-white' : 'bg-white text-[#718096] border border-[#E2E8F0]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredLog.map(entry => (
          <LogEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </motion.div>
  );
}

const LogEntry: React.FC<{ entry: any }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    switch (entry.outcome) {
      case 'Completed': return <CheckCircle2 className="text-green-500" size={20} />;
      case 'No Response': return <AlertCircle className="text-amber-500" size={20} />;
      case 'Emergency': return <PhoneCall className="text-red-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const getBadgeClass = () => {
    switch (entry.outcome) {
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'No Response': return 'bg-amber-100 text-amber-700';
      case 'Emergency': return 'bg-red-100 text-red-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div 
      onClick={() => setExpanded(!expanded)}
      className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] cursor-pointer hover:border-[#5AB9B1] transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="font-bold text-sm">{entry.type}</span>
        </div>
        <span className="text-[10px] text-[#A0AEC0] font-mono">
          {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getBadgeClass()}`}>
          {entry.outcome}
        </span>
        <ChevronRight size={16} className={`text-[#CBD5E0] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-4 pt-4 border-t border-[#EDF2F7] text-sm text-[#4A5568]"
        >
          <p className="italic text-[#718096] mb-2">Agent Message:</p>
          <p>{entry.message}</p>
        </motion.div>
      )}
    </div>
  );
};

function RoutineCalendar() {
  const { reminders, user } = useApp();
  const [view, setView] = useState<'Day' | 'Week'>('Day');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Routine</h2>
        <div className="bg-white rounded-lg p-1 border border-[#E2E8F0] flex gap-1">
          <button 
            onClick={() => setView('Day')}
            className={`px-3 py-1 text-xs font-bold rounded ${view === 'Day' ? 'bg-[#5AB9B1] text-white' : 'text-[#718096]'}`}
          >
            Day
          </button>
          <button 
            onClick={() => setView('Week')}
            className={`px-3 py-1 text-xs font-bold rounded ${view === 'Week' ? 'bg-[#5AB9B1] text-white' : 'text-[#718096]'}`}
          >
            Week
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {reminders.sort((a, b) => a.time.localeCompare(b.time)).map(r => (
          <div key={r.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex items-center gap-4 group">
            <span className="text-3xl">{r.icon}</span>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{r.title}</h3>
              <p className="text-xs text-[#718096]">{r.repeat}</p>
            </div>
            <div className="text-right flex items-center gap-4">
              <span className="font-mono font-bold text-[#5AB9B1]">{r.time}</span>
              <button 
                onClick={async () => {
                  if (confirm(`Delete ${r.title}?`)) {
                    try {
                      await deleteDoc(doc(db, 'reminders', r.id));
                    } catch (e) {
                      handleFirestoreError(e, OperationType.DELETE, `reminders/${r.id}`);
                    }
                  }
                }}
                className="p-2 text-[#CBD5E0] hover:text-[#E53E3E] transition-colors"
                title="Delete Reminder"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-28 right-6 w-14 h-14 bg-[#5AB9B1] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Plus size={28} />
      </button>

      <AnimatePresence>
        {isAddModalOpen && (
          <AddReminderModal onClose={() => setIsAddModalOpen(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddReminderModal({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    time: '08:00',
    icon: '💊',
    repeat: 'Daily',
    agent: 'medication',
    note: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sync data first to add reminders.');
      return;
    }
    try {
      await addDoc(collection(db, 'reminders'), {
        ...formData,
        userId: user.uid,
        completed: false
      });
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reminders');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] p-8"
      >
        <h2 className="text-2xl font-bold mb-6">Add Reminder</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#718096] uppercase mb-1">Title</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full p-3 rounded-xl border border-[#E2E8F0] outline-none focus:ring-2 focus:ring-[#5AB9B1]"
              placeholder="e.g., Morning Meds"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#718096] uppercase mb-1">Time</label>
              <input 
                type="time" 
                required
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full p-3 rounded-xl border border-[#E2E8F0] outline-none focus:ring-2 focus:ring-[#5AB9B1]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#718096] uppercase mb-1">Icon</label>
              <select 
                value={formData.icon}
                onChange={e => setFormData({...formData, icon: e.target.value})}
                className="w-full p-3 rounded-xl border border-[#E2E8F0] outline-none focus:ring-2 focus:ring-[#5AB9B1]"
              >
                <option>💊</option>
                <option>🍽️</option>
                <option>🐱</option>
                <option>🚶</option>
                <option>💧</option>
                <option>🍎</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 font-bold text-[#718096] hover:bg-[#F7FAFC] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-[#5AB9B1] text-white font-bold rounded-xl hover:bg-[#4A9D96] transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function AISummaryTab() {
  const { activityLog, seniorProfile } = useApp();
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      const logContext = activityLog.slice(0, 5).map(l => `${l.timestamp.toLocaleTimeString()}: ${l.type} - ${l.outcome}`).join('\n');
      const response = await callGemini(AGENT_PROMPTS.SUMMARY.replace('{{log}}', logContext), "Summarize the day so far.");
      setSummary(response);
      setLoading(false);
    };
    fetchSummary();
  }, [activityLog]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setLoading(true);
    const logContext = activityLog.map(l => `${l.timestamp.toLocaleTimeString()}: ${l.type} - ${l.outcome}`).join('\n');
    const response = await callGemini(
      `You are the EasyMind Caregiver Assistant. Use this log to answer questions: ${logContext}`,
      chatInput
    );
    setChatResponse(response);
    setChatInput('');
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-gradient-to-br from-[#5AB9B1] to-[#319795] p-6 rounded-[32px] text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} />
          <h2 className="font-bold uppercase tracking-widest text-xs">Daily Digest</h2>
        </div>
        {loading && !summary ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-white/20 rounded w-3/4"></div>
            <div className="h-4 bg-white/20 rounded w-1/2"></div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed opacity-90">{summary}</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0]">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-[#5AB9B1]" />
          Ask about {seniorProfile.name.split(' ')[0]}
        </h3>
        
        {chatResponse && (
          <div className="mb-4 p-4 bg-[#F7FAFC] rounded-2xl text-sm border border-[#EDF2F7]">
            {chatResponse}
          </div>
        )}

        <form onSubmit={handleChat} className="relative">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="How has she been today?"
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-[#E2E8F0] outline-none focus:ring-2 focus:ring-[#5AB9B1] text-sm"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#5AB9B1]"
          >
            <ChevronRight size={20} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
