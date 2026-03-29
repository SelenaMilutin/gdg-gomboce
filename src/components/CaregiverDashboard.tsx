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
  Plus, ChevronRight, MessageSquare, MapPin, Trash2, Loader2
} from 'lucide-react';
import { callGemini, generateCaregiverRecap } from '../services/aiService';
import { db, deleteDoc, doc, handleFirestoreError, OperationType, addDoc, collection } from '../firebase';
import LocationMap from './LocationMap';

export default function CaregiverDashboard() {
  const [activeTab, setActiveTab] = useState<'log' | 'routine' | 'ai' | 'location'>('log');
  const { userProfile, linkedSeniorProfile, activityLog, updateProfile, user, setDemoRole, setUserProfile } = useApp();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleSwitchSenior = async () => {
    setIsUnlinking(true);
    try {
      if (!user) {
        setDemoRole('caregiver');
        setUserProfile({
          uid: 'demo-user-id',
          name: 'Demo User',
          role: 'caregiver',
          linkedSeniorId: undefined
        });
      } else {
        await updateProfile({ linkedSeniorId: undefined });
      }
    } finally {
      setIsUnlinking(false);
    }
  };

  if (!userProfile?.linkedSeniorId || !linkedSeniorProfile) {
    return <LinkSeniorUI />;
  }

  const unreadAlerts = activityLog.filter(l => l.outcome === 'Emergency' || l.outcome === 'No Response').length;

  return (
    <div className="min-h-screen bg-[#F7FAFC] pb-24 font-sans text-[#2D3748]">
      {/* Header */}
      <header className="bg-white p-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSwitchSenior}
              disabled={isUnlinking}
              className="p-2 text-[#718096] hover:text-[#5AB9B1] transition-colors"
              title="Switch Senior"
            >
              {isUnlinking ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight className="rotate-180" size={20} />}
            </button>
            <div className="w-12 h-12 bg-[#5AB9B1] rounded-full flex items-center justify-center text-white font-bold text-xl">
              {linkedSeniorProfile?.name?.[0] || 'S'}
            </div>
            <div>
              <h1 className="font-bold text-lg">{linkedSeniorProfile?.name || 'Senior Profile'}</h1>
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
  const { currentLocation, linkedSeniorProfile } = useApp();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0]">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <MapPin size={24} className="text-[#5AB9B1]" />
          {linkedSeniorProfile?.name?.split(' ')[0] || 'Senior'}'s Location
        </h2>
        
        <LocationMap 
          location={currentLocation} 
          isLive={false}
          onRefresh={() => {
            // TODO: Trigger location refresh from Firebase
            console.log('Refresh location');
          }}
        />
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex gap-4">
        <AlertCircle className="text-amber-500 shrink-0" size={24} />
        <div>
          <h4 className="font-bold text-amber-800 text-sm mb-1">How It Works</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            Location updates every minute while the senior is using their device. The map shows their current location relative to the center. Click "Open in Maps" to see real-world directions.
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
        {filteredLog.map((entry, index) => (
          <LogEntry key={entry.id || `${entry.type || 'log'}-${entry.timestamp?.toString?.() || index}`} entry={entry} />
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
  const { reminders, addReminder, deleteReminder } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Routine</h2>
      </div>

      <div className="space-y-4">
        {reminders.sort((a, b) => a.time.localeCompare(b.time)).map((r, index) => (
          <div key={r.id || `${r.title || 'reminder'}-${r.time || 'time'}-${index}`} className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex items-center gap-4 group">
            <span className="text-3xl">{r.icon}</span>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{r.title}</h3>
              <p className="text-xs text-[#718096]">{r.repeat}</p>
            </div>
            <div className="text-right flex items-center gap-4">
              <span className="font-mono font-bold text-[#5AB9B1]">{r.time}</span>
              <button 
                onClick={async () => {
                  await deleteReminder(r.id);
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
  const { addReminder } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    time: '08:00',
    icon: '💊',
    repeat: 'Daily' as const,
    agent: 'medication' as const,
    note: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addReminder(formData);
    onClose();
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
              <label className="block text-xs font-bold text-[#718096] uppercase mb-1">Repeat</label>
              <select 
                value={formData.repeat}
                onChange={e => setFormData({...formData, repeat: e.target.value as any})}
                className="w-full p-3 rounded-xl border border-[#E2E8F0] outline-none focus:ring-2 focus:ring-[#5AB9B1]"
              >
                <option value="Daily">Every Day</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Once">Once</option>
              </select>
            </div>
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
  const { activityLog, linkedSeniorProfile } = useApp();
  const [summary, setSummary] = useState<{ recap: string; conclusion: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');

  const normalizeAiText = (raw: string) => {
    return raw
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^\s*[\-*]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      const response = await generateCaregiverRecap(activityLog);
      setSummary(response);
      setLoading(false);
    };

    fetchSummary();
  }, [activityLog]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setLoading(true);
    const logContext = activityLog.length
      ? activityLog
          .slice(0, 20)
          .map(
            l =>
              `${l.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${l.type} | ${l.outcome} | ${l.message || 'No message'}`
          )
          .join('\n')
      : 'No activity events are available in database for this senior yet.';

    const response = await callGemini(
      `You are the EasyMind Caregiver Assistant.
Use only the activity log context below (pulled from the app database) to answer.
Do not ask the caregiver to provide logs manually.
If context is empty, state that clearly and give one practical next step.
Format as clean plain text with short sections. Do not use markdown symbols like **, #, or *.

Activity log context:
${logContext}`,
      chatInput
    );
    setChatResponse(normalizeAiText(response));
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
          <p className="text-sm leading-relaxed opacity-90">
            {summary ? `${summary.recap} Conclusion: ${summary.conclusion}` : ''}
          </p>
        )}
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0]">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-[#5AB9B1]" />
          Ask about {linkedSeniorProfile?.name?.split(' ')[0] || 'Senior'}
        </h3>
        
        {chatResponse && (
          <div className="mb-4 p-4 bg-[#F7FAFC] rounded-2xl text-sm border border-[#EDF2F7] whitespace-pre-line leading-relaxed">
            {chatResponse}
          </div>
        )}

        <form onSubmit={handleChat} className="relative">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`How has ${linkedSeniorProfile?.name?.split(' ')[0] || 'Senior'} been today?`}
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

function LinkSeniorUI() {
  const { linkSenior, seniorsList, user, setDemoRole, setUserProfile } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleLink = async (senior: any) => {
    setLoading(senior.uid);
    setError('');
    try {
      if (!user) {
        // Demo mode: update local profile to link to this senior
        setDemoRole('caregiver');
        setUserProfile({
          uid: 'demo-user-id',
          name: 'Demo User',
          role: 'caregiver',
          linkedSeniorId: senior.uid
        });
      } else {
        await linkSenior(senior.uid);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link senior');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex flex-col items-center justify-center p-6">
       {/* TODO: REMOVE BEFORE PROD */}
    {import.meta.env.DEV && user && (
      <button
        onClick={() => import('../firebase').then(f => f.logout())}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 9999,
          background: 'red', color: 'white', padding: '4px 12px',
          borderRadius: 6, fontSize: 12, cursor: 'pointer'
        }}
      >
        DEV LOGOUT
      </button>
    )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#5AB9B1] rounded-full flex items-center justify-center text-white mb-6 mx-auto shadow-lg">
            <Plus size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-2">Connect to a Senior</h2>
          <p className="text-[#718096]">Select a senior profile to start monitoring and providing care.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seniorsList.length > 0 ? (
            seniorsList.map((senior, index) => (
              <motion.div 
                key={senior.uid || `${senior.name || 'senior'}-${index}`}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-[#EDF2F7] rounded-full flex items-center justify-center text-[#4A5568] font-bold">
                      {senior.name?.[0] || 'S'}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{senior.name}</h3>
                      <p className="text-xs text-[#718096]">Age: {senior.age || 'N/A'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#4A5568] line-clamp-2 mb-6">
                    {senior.notes || 'No additional notes provided.'}
                  </p>
                </div>
                
                <button 
                  onClick={() => handleLink(senior)}
                  disabled={loading !== null}
                  className="w-full bg-[#5AB9B1] text-white font-bold py-3 rounded-xl hover:bg-[#4A9D96] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading === senior.uid ? <Loader2 className="animate-spin" size={20} /> : 'Connect'}
                </button>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 bg-white rounded-[32px] border border-dashed border-[#CBD5E0]">
              <p className="text-[#718096]">No senior profiles found.</p>
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-center mt-6 font-bold">{error}</p>}
      </motion.div>
    </div>
  );
}
