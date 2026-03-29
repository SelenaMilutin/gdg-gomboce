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
import LandingPage from './components/LandingPage';

import { db, doc, updateDoc } from './firebase';

export default function App() {
  const { user, role, isAuthReady, updateProfile, demoRole, setDemoRole } = useApp();
  const [showLanding, setShowLanding] = useState(true);

  const handleSelectRole = async (selectedRole: 'senior' | 'caregiver') => {
    if (user) {
      try {
        await updateProfile({ role: selectedRole });
      } catch (e) {
        console.error("Error setting role:", e);
      }
    } else {
      setDemoRole(selectedRole);
    }
    setShowLanding(false);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-[#5AB9B1] border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-bold text-[#2D3748]">EasyMind is waking up...</h1>
      </div>
    );
  }

  if (showLanding || (user && !role)) {
    return <LandingPage onSelectRole={handleSelectRole} />;
  }

  return (
    <>
      <AuthOverlay onBackToLanding={() => setShowLanding(true)} />
      <AnimatePresence mode="wait">
        {(!user && demoRole === 'caregiver') || (user && role === 'caregiver') ? (
          <motion.div key="caregiver" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CaregiverDashboard />
          </motion.div>
        ) : (
          <motion.div key="senior" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SeniorView />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
