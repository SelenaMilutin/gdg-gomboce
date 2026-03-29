import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { signInWithGoogle, logout } from '../firebase';
import { LogIn, LogOut, User as UserIcon, Loader2, LayoutGrid, RefreshCw } from 'lucide-react';
import { db, updateDoc, doc } from '../firebase';

export default function AuthOverlay({ onBackToLanding }: { onBackToLanding: () => void }) {
  const { user, isAuthReady, role, setDemoRole } = useApp();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleResetRole = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      setDemoRole(null);
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { role: null });
      }
      onBackToLanding();
    } finally {
      setIsResetting(false);
    }
  };

  if (!isAuthReady) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
      <button 
        onClick={handleResetRole}
        disabled={isResetting}
        className="p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-[#E2E8F0] text-[#718096] hover:text-[#5AB9B1] transition-all transform hover:scale-105 disabled:opacity-50"
        title="Switch Role / Back to Start"
      >
        {isResetting ? <Loader2 className="animate-spin" size={20} /> : <LayoutGrid size={20} />}
      </button>

      {user ? (
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-[#E2E8F0]">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#5AB9B1] flex items-center justify-center text-white">
              <UserIcon size={16} />
            </div>
          )}
          <button 
            onClick={logout}
            className="p-2 text-[#718096] hover:text-[#E53E3E] transition-colors"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      ) : (
        <button 
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="flex items-center gap-2 bg-[#5AB9B1] text-white px-4 py-2 rounded-full shadow-lg hover:bg-[#4A9D96] transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSigningIn ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <LogIn size={20} />
          )}
          <span className="font-bold text-sm">
            {isSigningIn ? 'Connecting...' : 'Sync Data'}
          </span>
        </button>
      )}
    </div>
  );
}
