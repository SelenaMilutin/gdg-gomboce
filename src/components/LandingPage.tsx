/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Heart, Shield, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onSelectRole: (role: 'senior' | 'caregiver') => void;
}

export default function LandingPage({ onSelectRole }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FDFBF7] relative">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm px-6 py-2 rounded-full shadow-md border border-[#E2E8F0]">
        <span className="text-2xl font-black tracking-tighter text-[#2D3748]">Easy<span className="text-[#5AB9B1]">Mind</span></span>
      </div>
      {/* Senior Side */}
      <motion.div 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-12 text-center border-b md:border-b-0 md:border-r border-[#E2E8F0] group hover:bg-[#5AB9B1]/5 transition-colors"
      >
        <div className="w-24 h-24 bg-[#5AB9B1] rounded-full flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform">
          <Heart className="text-white" size={48} />
        </div>
        <h1 className="text-5xl font-black mb-6 text-[#2D3748]">I am a Senior</h1>
        <p className="text-xl text-[#718096] max-w-sm mb-12 leading-relaxed">
          A simple, warm companion to help you stay independent, connected, and safe.
        </p>
        <button 
          onClick={() => onSelectRole('senior')}
          className="flex items-center gap-3 px-10 py-5 bg-[#5AB9B1] text-white rounded-full font-bold text-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all"
        >
          Enter Senior View <ArrowRight size={24} />
        </button>
      </motion.div>

      {/* Caregiver Side */}
      <motion.div 
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#1A202C] group hover:bg-[#2D3748] transition-colors"
      >
        <div className="w-24 h-24 bg-[#E53E3E] rounded-full flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform">
          <Shield className="text-white" size={48} />
        </div>
        <h1 className="text-5xl font-black mb-6 text-white">I am a Caregiver</h1>
        <p className="text-xl text-gray-400 max-w-sm mb-12 leading-relaxed">
          Peace of mind with real-time updates, activity logs, and AI insights for your loved ones.
        </p>
        <button 
          onClick={() => onSelectRole('caregiver')}
          className="flex items-center gap-3 px-10 py-5 bg-[#E53E3E] text-white rounded-full font-bold text-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all"
        >
          Enter Caregiver Dashboard <ArrowRight size={24} />
        </button>
      </motion.div>
    </div>
  );
}
