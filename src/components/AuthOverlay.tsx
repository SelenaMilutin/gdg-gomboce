import React from 'react';
import { useApp } from '../context/AppContext';
import { signInWithGoogle, logout } from '../firebase';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export default function AuthOverlay() {
  const { user, isAuthReady } = useApp();

  if (!isAuthReady) return null;

  return (
    <div className="fixed top-4 right-4 z-[100]">
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
          onClick={signInWithGoogle}
          className="flex items-center gap-2 bg-[#5AB9B1] text-white px-4 py-2 rounded-full shadow-lg hover:bg-[#4A9D96] transition-all transform hover:scale-105"
        >
          <LogIn size={20} />
          <span className="font-bold text-sm">Sync Data</span>
        </button>
      )}
    </div>
  );
}
