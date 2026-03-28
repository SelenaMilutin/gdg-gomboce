/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Shield, LogIn } from 'lucide-react';
import SeniorView from './components/SeniorView';
import CaregiverDashboard from './components/CaregiverDashboard';
import AuthOverlay from './components/AuthOverlay';

export default function App() {
  const { role, isAuthReady } = useApp();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-[#5AB9B1] border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-bold text-[#2D3748]">EasyMind is waking up...</h1>
      </div>
    );
  }

  return (
    <>
      <AuthOverlay />
      <AnimatePresence mode="wait">
        {role === 'senior' ? (
          <motion.div key="senior" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SeniorView />
          </motion.div>
        ) : (
          <motion.div key="caregiver" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CaregiverDashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
