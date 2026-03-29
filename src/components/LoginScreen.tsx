/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LoginScreen.tsx
 *
 * Full-page auth + role selection flow.
 * Replaces the old AuthOverlay entirely — mount this at the app root level.
 *
 * Imports only from:
 *   '../context/AppContext'  (useApp)
 *   '../firebase'            (signInWithGoogle — already exported from firebase.ts)
 *   'firebase/auth'          (User type only, no runtime use)
 *   'motion/react'
 *   'lucide-react'
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, UserRound, ShieldCheck, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { signInWithGoogle } from '../firebase';
import { UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { user, isAuthReady, userProfile, updateProfile, setDemoRole } = useApp();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [pickingRole, setPickingRole] = useState<UserRole>(null);

  if (!isAuthReady) {
    return (
      <FullScreenLoader />
    );
  }

  // ── Authenticated user who hasn't chosen a role yet → show role picker ────
  if (user && !user.isAnonymous && userProfile !== undefined && !userProfile?.role) {
    return (
      <Shell>
        <RolePicker
          onPick={async (r) => {
            setPickingRole(r);
            await updateProfile({ role: r });
            setPickingRole(null);
          }}
          isLoading={pickingRole}
        />
      </Shell>
    );
  }

  // ── Sign in with Google ───────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      // App.tsx will re-route once auth state updates.
      // If it's a brand-new user with no profile, App.tsx keeps rendering
      // LoginScreen which will then show the RolePicker above.
    } catch (e) {
      console.error('Sign-in error:', e);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Shell>
      <Landing
        onGoogleSignIn={handleGoogleSignIn}
        onDemoSenior={() => setDemoRole('senior')}
        onDemoCaregiver={() => setDemoRole('caregiver')}
        isSigningIn={isSigningIn}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell — shared background + centering wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#5AB9B1]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-[#F6AD55]/10 blur-3xl" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10 max-w-md mx-auto w-full">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────
function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
      <Loader2 className="animate-spin text-[#5AB9B1]" size={40} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing step
// ─────────────────────────────────────────────────────────────────────────────
function Landing({
  onGoogleSignIn,
  onDemoSenior,
  onDemoCaregiver,
  isSigningIn,
}: {
  onGoogleSignIn: () => void;
  onDemoSenior: () => void;
  onDemoCaregiver: () => void;
  isSigningIn: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full text-center"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-24 h-24 bg-[#5AB9B1] rounded-[28px] flex items-center justify-center mb-8 shadow-2xl shadow-[#5AB9B1]/30 mx-auto"
      >
        <Heart className="text-white" size={48} fill="white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-5xl font-black text-[#2D3748] mb-3">
          Easy<span className="text-[#5AB9B1]">Mind</span>
        </h1>
        <p className="text-xl text-[#718096] mb-12 leading-relaxed">
          Gentle reminders and peaceful care,<br />every step of the way.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full space-y-4"
      >
        {/* Google sign-in */}
        <button
          onClick={onGoogleSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#E2E8F0] py-4 px-6 rounded-2xl font-bold text-[#2D3748] shadow-sm hover:shadow-md hover:border-[#5AB9B1] transition-all text-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSigningIn ? <Loader2 className="animate-spin" size={22} /> : <GoogleIcon />}
          {isSigningIn ? 'Connecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 text-[#CBD5E0]">
          <hr className="flex-1 border-[#E2E8F0]" />
          <span className="text-sm font-medium text-[#A0AEC0]">or try demo</span>
          <hr className="flex-1 border-[#E2E8F0]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DemoButton
            icon="👵"
            label="As Senior"
            sub="Simplified view"
            onClick={onDemoSenior}
            borderColor="border-[#F6AD55]"
            hoverBg="hover:bg-[#FEF3C7]"
          />
          <DemoButton
            icon="🧑‍⚕️"
            label="As Caregiver"
            sub="Dashboard view"
            onClick={onDemoCaregiver}
            borderColor="border-[#63B3ED]"
            hoverBg="hover:bg-[#EBF8FF]"
          />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-xs text-[#A0AEC0] px-4"
      >
        By continuing you agree to our Terms of Service and Privacy Policy.
      </motion.p>
    </motion.div>
  );
}

function DemoButton({
  icon, label, sub, onClick, borderColor, hoverBg,
}: {
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
  borderColor: string;
  hoverBg: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 bg-white border-2 ${borderColor} ${hoverBg} py-5 px-4 rounded-2xl transition-all hover:shadow-sm`}
    >
      <span className="text-3xl">{icon}</span>
      <span className="font-bold text-sm text-[#2D3748]">{label}</span>
      <span className="text-xs text-[#718096]">{sub}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role picker (for newly signed-in users)
// ─────────────────────────────────────────────────────────────────────────────
function RolePicker({
  onPick,
  isLoading,
}: {
  onPick: (role: NonNullable<UserRole>) => void;
  isLoading: UserRole;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full"
    >
      <div className="w-16 h-16 bg-[#EDF2F7] rounded-[20px] flex items-center justify-center mb-8 mx-auto">
        <Sparkles className="text-[#5AB9B1]" size={32} />
      </div>

      <h2 className="text-4xl font-black text-[#2D3748] mb-3 text-center">Who are you?</h2>
      <p className="text-[#718096] mb-12 text-center text-lg">
        Choose your role. You can always change it later.
      </p>

      <div className="w-full space-y-4">
        <RoleCard
          icon={<UserRound size={36} className="text-[#F6AD55]" />}
          bg="bg-[#FEF3C7]"
          border="border-[#F6AD55]"
          title="I'm a Senior"
          description="Get reminders, talk to my assistant, and call my family with one tap."
          loading={isLoading === 'senior'}
          onClick={() => onPick('senior')}
        />
        <RoleCard
          icon={<ShieldCheck size={36} className="text-[#5AB9B1]" />}
          bg="bg-[#E6FFFA]"
          border="border-[#5AB9B1]"
          title="I'm a Caregiver"
          description="Monitor activity, manage routines, and stay connected with my loved one."
          loading={isLoading === 'caregiver'}
          onClick={() => onPick('caregiver')}
        />
      </div>
    </motion.div>
  );
}

function RoleCard({
  icon, bg, border, title, description, loading, onClick,
}: {
  icon: React.ReactNode;
  bg: string;
  border: string;
  title: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-5 bg-white border-2 ${border} p-6 rounded-[28px] shadow-sm hover:shadow-md transition-all text-left disabled:opacity-60`}
    >
      <div className={`${bg} w-16 h-16 rounded-2xl flex items-center justify-center shrink-0`}>
        {loading ? <Loader2 className="animate-spin text-[#718096]" size={28} /> : icon}
      </div>
      <div className="flex-1">
        <h3 className="font-black text-xl text-[#2D3748] mb-1">{title}</h3>
        <p className="text-sm text-[#718096] leading-snug">{description}</p>
      </div>
      <ChevronRight className="text-[#CBD5E0] shrink-0" size={20} />
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Google icon SVG
// ─────────────────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.1 13 17.6 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.7-.2-3.3-.5-4.8H24v9.1h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.7 37.4 46.5 31.4 46.5 24.5z"/>
      <path fill="#FBBC05" d="M10.4 28.7A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.2-7.7 2.2-6.4 0-11.9-3.5-14.6-8.6l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}