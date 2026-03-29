/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Bell, Phone, CheckCircle2, XCircle, AlertTriangle, Copy, Check, User } from 'lucide-react';
import { callGemini, AGENT_PROMPTS, routeRequest, generateSpeech } from '../services/aiService';

const FALLBACK_PROFILE = {
  name: "Milica Jovanović",
  primaryCaregiver: "Ana Jovanović",
  emergencyPhone: "+381601234567"
};

export default function SeniorView() {
  const { userProfile, reminders, addLogEntry, activeReminder, setActiveReminder, setCurrentLocation } = useApp();
  const [time, setTime] = useState(new Date());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [showRemindersList, setShowRemindersList] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fallback profile for demo mode (when not logged in)
  const profile = userProfile || FALLBACK_PROFILE;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Geolocation update logic
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.warn('Geolocation is not available in this browser.');
      return;
    }

    let isPermissionDenied = false;
    let locationInterval: number | undefined;

    const updateLocation = () => {
      if (isPermissionDenied) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            lastUpdated: new Date()
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            isPermissionDenied = true;
            if (locationInterval !== undefined) {
              clearInterval(locationInterval);
            }
            console.warn('Location permission denied. Location updates disabled.');
            return;
          }

          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true }
      );
    };

    updateLocation();
    locationInterval = window.setInterval(updateLocation, 60000); // Update every minute

    return () => {
      if (locationInterval !== undefined) {
        clearInterval(locationInterval);
      }
    };
  }, [setCurrentLocation]);

  // Demo simulation: Fire a medication reminder after 15 seconds
  useEffect(() => {
    const demoTimer = setTimeout(() => {
      const medReminder = reminders.find(r => r.agent === 'medication');
      if (medReminder) setActiveReminder(medReminder);
    }, 15000);
    return () => clearTimeout(demoTimer);
  }, [reminders, setActiveReminder]);

  // Background Orchestrator check every 30 seconds
  useEffect(() => {
    const orchestratorInterval = setInterval(async () => {
      console.log('Orchestrator interval tick');
      try {
        const { agent, payload } = await routeRequest(profile as any, reminders, []);
        if (agent === 'daily_task' || agent === 'medication') {
          addLogEntry({
            agent: agent,
            type: agent === 'medication' ? 'Medication Adherence Check' : 'Daily Routine Check',
            outcome: 'Info',
            message: payload.message
          });
        } else {
          console.log("Orchestrator routed to chat agent with message:", payload.message);
        }
      } catch (error) {
        console.error('Orchestrator interval failed:', error);
      }
    }, 30000);
    return () => clearInterval(orchestratorInterval);
  }, [profile, reminders, addLogEntry]);

  const handleDone = (reminder: any) => {
    addLogEntry({
      agent: reminder.agent,
      type: reminder.title,
      outcome: 'Completed',
      message: `Completed at ${new Date().toLocaleTimeString()}`
    });
    setActiveReminder(null);
  };

  const copyToClipboard = () => {
    if (userProfile?.uid) {
      navigator.clipboard.writeText(userProfile.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D3748] font-sans selection:bg-[#5AB9B1]/30">
      {/* Header */}
      <header className="p-8 pt-12 text-center relative">
        {userProfile && (
          <button 
            onClick={() => setShowProfile(true)}
            className="absolute top-8 right-8 p-3 bg-white shadow-md rounded-full text-[#5AB9B1]"
          >
            <User size={24} />
          </button>
        )}
        <div className="text-[80px] font-black leading-none mb-2 tabular-nums">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-3xl text-[#718096] font-medium mb-6">
          {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="text-5xl font-bold">Hello, {profile?.name?.split(' ')[0] || 'Senior'} 👋</h1>
      </header>

      {/* Main Actions */}
      <main className="p-6 grid grid-cols-1 gap-8 max-w-2xl mx-auto">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(true)}
          className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-[#5AB9B1] flex items-center gap-8 text-left"
        >
          <div className="w-24 h-24 bg-[#E6FFFA] rounded-full flex items-center justify-center">
            <Mic className="text-[#319795] w-12 h-12" />
          </div>
          <div>
            <span className="text-4xl font-black block">Talk to Memora</span>
            <span className="text-xl text-[#718096]">I'm here to listen</span>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowRemindersList(true)}
          className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-[#F6AD55] flex items-center gap-8 text-left"
        >
          <div className="w-24 h-24 bg-[#FEF3C7] rounded-full flex items-center justify-center">
            <Bell className="text-[#D97706] w-12 h-12" />
          </div>
          <div>
            <span className="text-4xl font-black block">My Reminders</span>
            <span className="text-xl text-[#718096]">See what's next</span>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => window.location.href = `tel:${profile.emergencyPhone}`}
          className="bg-white p-10 rounded-[40px] shadow-xl border-4 border-[#63B3ED] flex items-center gap-8 text-left"
        >
          <div className="w-24 h-24 bg-[#EBF8FF] rounded-full flex items-center justify-center">
            <Phone className="text-[#3182CE] w-12 h-12" />
          </div>
          <div>
            <span className="text-4xl font-black block">Call {profile?.primaryCaregiver?.split(' ')[0] || 'Caregiver'}</span>
            <span className="text-xl text-[#718096]">I need to talk</span>
          </div>
        </motion.button>
      </main>

      {/* Emergency Button */}
      <button
        onClick={() => setIsEmergencyOpen(true)}
        className="fixed bottom-8 right-8 w-24 h-24 bg-[#E53E3E] text-white rounded-full shadow-2xl flex items-center justify-center animate-pulse z-40"
      >
        <AlertTriangle size={48} />
      </button>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {activeReminder && (
          <motion.div key={`reminder-${activeReminder.id || activeReminder.title || 'active'}`}>
            <ReminderTakeover 
              reminder={activeReminder} 
              onDone={() => handleDone(activeReminder)} 
            />
          </motion.div>
        )}
        {isChatOpen && (
          <motion.div key="chat-modal">
            <ChatAgentModal onClose={() => setIsChatOpen(false)} />
          </motion.div>
        )}
        {showRemindersList && (
          <motion.div key="reminders-list">
            <RemindersList onClose={() => setShowRemindersList(false)} />
          </motion.div>
        )}
        {isEmergencyOpen && (
          <motion.div key="emergency-overlay">
            <EmergencyOverlay 
              onClose={() => setIsEmergencyOpen(false)} 
              onConfirm={() => {
                addLogEntry({ agent: 'orchestrator', type: 'Emergency', outcome: 'Emergency', message: 'Emergency button pressed' });
                setIsEmergencyOpen(false);
              }}
            />
          </motion.div>
        )}
        {showProfile && userProfile && (
          <motion.div
            key="profile-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-black">My Profile</h3>
                <button onClick={() => setShowProfile(false)} className="p-2 bg-[#F7FAFC] rounded-full"><XCircle size={32} /></button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-[#718096] uppercase tracking-wider">My Name</label>
                  <p className="text-2xl font-bold">{userProfile.name}</p>
                </div>
                
                <div className="p-6 bg-[#F7FAFC] rounded-3xl border-2 border-dashed border-[#CBD5E0]">
                  <label className="text-sm font-bold text-[#718096] uppercase tracking-wider block mb-2">My ID (Share with Caregiver)</label>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 bg-white p-3 rounded-xl text-lg font-mono border border-[#E2E8F0] break-all">
                      {userProfile.uid}
                    </code>
                    <button 
                      onClick={copyToClipboard}
                      className={`p-4 rounded-2xl transition-colors ${copied ? 'bg-[#48BB78] text-white' : 'bg-[#5AB9B1] text-white'}`}
                    >
                      {copied ? <Check size={24} /> : <Copy size={24} />}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#718096]">Your caregiver needs this ID to link to your profile.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReminderTakeover({ reminder, onDone }: { reminder: any, onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="text-[120px] mb-8">{reminder.icon}</div>
      <h2 className="text-6xl font-black mb-6 text-[#2D3748]">{reminder.title}</h2>
      {reminder.note && (
        <p className="text-3xl text-[#718096] mb-12 max-w-xl">{reminder.note}</p>
      )}
      <button
        onClick={onDone}
        className="w-full max-w-md bg-[#5AB9B1] text-white text-5xl font-black py-10 rounded-[40px] shadow-2xl flex items-center justify-center gap-4 hover:bg-[#4A9D96] transition-colors"
      >
        <CheckCircle2 size={64} />
        Done
      </button>
    </motion.div>
  );
}

function ChatAgentModal({ onClose }: { onClose: () => void }) {
  const { userProfile, chatHistory, setChatHistory } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  const profile = userProfile || {
    name: "Milica Jovanović",
    primaryCaregiver: "Ana Jovanović",
    emergencyPhone: "+381601234567"
  };

  const playPCM = async (base64Data: string) => {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = audioContext.createBuffer(1, bytes.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < bytes.length; i++) {
        channelData[i] = bytes[i] / 32768;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (e) {
      console.error("Error playing PCM:", e);
    }
  };

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      // Set to Serbian (sr-RS) to target Serbian seniors, but could be dynamic
      recognitionRef.current.lang = 'sr-RS';

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        handleSend(text);
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSend = async (text: string) => {
    setIsProcessing(true);
    const systemPrompt = AGENT_PROMPTS.CHAT.replace('{{caregiver}}', profile.primaryCaregiver || 'Caregiver');
    const response = await callGemini(systemPrompt, text, chatHistory);
    
    setAiResponse(response);
    setChatHistory([...chatHistory, { role: 'user', content: text }, { role: 'assistant', content: response }]);
    setIsProcessing(false);

    // Speak response using Google TTS
    const base64Audio = await generateSpeech(response);
    if (base64Audio) {
      playPCM(base64Audio);
    } else {
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(response);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-50 bg-white flex flex-col p-8"
    >
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-black">Talking to Memora</h2>
        <button onClick={onClose} className="p-4 bg-[#F7FAFC] rounded-full"><XCircle size={48} /></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-12">
        {aiResponse ? (
          <div className="space-y-8">
            <p className="text-2xl text-[#718096] italic">" {transcript} "</p>
            <p className="text-5xl font-bold text-[#2D3748] leading-tight">{aiResponse}</p>
          </div>
        ) : (
          <p className="text-4xl text-[#718096]">Tap the microphone and speak to me</p>
        )}

        {isProcessing && (
          <div className="flex gap-2">
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 bg-[#5AB9B1] rounded-full" />
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-4 h-4 bg-[#5AB9B1] rounded-full" />
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-4 h-4 bg-[#5AB9B1] rounded-full" />
          </div>
        )}

        <motion.button
          animate={isListening ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          onClick={startListening}
          disabled={isListening || isProcessing}
          className={`w-48 h-48 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isListening ? 'bg-[#E53E3E]' : 'bg-[#5AB9B1]'}`}
        >
          <Mic size={80} className="text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function RemindersList({ onClose }: { onClose: () => void }) {
  const { reminders } = useApp();
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-50 bg-[#FDFBF7] flex flex-col p-8"
    >
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-black">My Reminders</h2>
        <button onClick={onClose} className="p-4 bg-white shadow rounded-full"><XCircle size={48} /></button>
      </div>

      <div className="space-y-6 overflow-y-auto pb-20">
        {reminders.map((r, index) => (
          <div key={r.id || `${r.title || 'reminder'}-${r.time || 'time'}-${index}`} className="bg-white p-8 rounded-[32px] shadow-md border-2 border-[#E9E2D5] flex items-center gap-6">
            <span className="text-6xl">{r.icon}</span>
            <div className="flex-1">
              <span className="text-3xl font-bold block">{r.title}</span>
              <span className="text-xl text-[#718096]">{r.time}</span>
            </div>
            <CheckCircle2 className="text-[#CBD5E0] w-12 h-12" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function EmergencyOverlay({ onClose, onConfirm }: { onClose: () => void, onConfirm: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-[#E53E3E]/95 flex flex-col items-center justify-center p-8 text-center text-white"
    >
      <AlertTriangle size={120} className="mb-8" />
      <h2 className="text-6xl font-black mb-12">Call for help?</h2>
      <div className="flex flex-col w-full max-w-md gap-6">
        <button
          onClick={onConfirm}
          className="bg-white text-[#E53E3E] text-5xl font-black py-10 rounded-[40px] shadow-2xl"
        >
          YES
        </button>
        <button
          onClick={onClose}
          className="text-white text-3xl font-bold py-6"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
