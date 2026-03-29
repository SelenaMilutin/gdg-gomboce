import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Shield, Heart, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function RoleSelection() {
  const { updateProfile } = useApp();
  const [loading, setLoading] = useState(false);

  const handleSelectRole = async (role: 'senior' | 'caregiver') => {
    setLoading(true);
    try {
      await updateProfile({ role });
    } catch (error) {
      console.error('Error setting role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#2D3748] mb-2">Welcome to EasyMind</h2>
          <p className="text-[#718096]">Please select your role to continue</p>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => handleSelectRole('senior')}
            disabled={loading}
            className="group relative bg-white p-6 rounded-2xl shadow-md border-2 border-transparent hover:border-[#5AB9B1] transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#E6F4F1] rounded-xl text-[#5AB9B1] group-hover:bg-[#5AB9B1] group-hover:text-white transition-colors">
                <Heart size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#2D3748]">I am a Senior</h3>
                <p className="text-sm text-[#718096]">I want to manage my daily tasks and stay connected.</p>
              </div>
              <ArrowRight className="text-[#CBD5E0] group-hover:text-[#5AB9B1] transition-colors" size={20} />
            </div>
          </button>

          <button
            onClick={() => handleSelectRole('caregiver')}
            disabled={loading}
            className="group relative bg-white p-6 rounded-2xl shadow-md border-2 border-transparent hover:border-[#4A5568] transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#EDF2F7] rounded-xl text-[#4A5568] group-hover:bg-[#4A5568] group-hover:text-white transition-colors">
                <Shield size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#2D3748]">I am a Caregiver</h3>
                <p className="text-sm text-[#718096]">I want to support and monitor a senior's well-being.</p>
              </div>
              <ArrowRight className="text-[#CBD5E0] group-hover:text-[#4A5568] transition-colors" size={20} />
            </div>
          </button>
        </div>

        {loading && (
          <div className="flex justify-center">
            <Loader2 className="animate-spin text-[#5AB9B1]" size={24} />
          </div>
        )}
      </motion.div>
    </div>
  );
}
