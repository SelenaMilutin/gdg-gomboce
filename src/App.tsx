/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — root component and auth router
 *
 * Routing table:
 *  isAuthReady = false              → FullScreenLoader (Firebase restoring state)
 *  no user                          → LoginScreen
 *  anonymous user, no demoRole      → LoginScreen (shows demo buttons)
 *  anonymous user, demoRole='senior'     → SeniorView
 *  anonymous user, demoRole='caregiver'  → CaregiverDashboard
 *  real user, userProfile = null    → LoginScreen (RolePicker for new accounts)
 *  real user, userProfile.role = null   → LoginScreen (RolePicker)
 *  real user, role = 'senior'       → SeniorView
 *  real user, role = 'caregiver'    → CaregiverDashboard
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import SeniorView from './components/SeniorView';
import CaregiverDashboard from './components/CaregiverDashboard';
import { Loader2 } from 'lucide-react';

function Router() {
  const { isAuthReady, user, role, userProfile } = useApp();

  // Firebase hasn't resolved auth state yet
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="animate-spin text-[#5AB9B1]" size={40} />
      </div>
    );
  }

  // No Firebase session at all. Still allow local demo role routing.
  if (!user) {
    if (role === 'senior') return <SeniorView />;
    if (role === 'caregiver') return <CaregiverDashboard />;
    return <LoginScreen />;
  }

  const isAnon = user.isAnonymous;

  if (isAnon) {
    // Demo mode — role chosen on landing screen
    if (role === 'senior')    return <SeniorView />;
    if (role === 'caregiver') return <CaregiverDashboard />;
    return <LoginScreen />;  // no demo role yet → show landing
  }

  // Real authenticated user — wait for profile to load from Firestore
  // userProfile === null means onSnapshot returned no document (new user)
  // userProfile === undefined would mean still loading — we treat null as "ready, no doc"
  if (userProfile === null || !userProfile?.role) {
    // New user or role not yet set → LoginScreen renders RolePicker
    return <LoginScreen />;
  }

  if (userProfile.role === 'senior')    return <SeniorView />;
  if (userProfile.role === 'caregiver') return <CaregiverDashboard />;

  // Unrecognised role — fallback to login
  return <LoginScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}