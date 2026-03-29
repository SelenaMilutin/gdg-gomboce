import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, UserRound, ShieldCheck, Loader2, ChevronRight, Sparkles, User, Phone, Calendar, Check, Link, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { signInWithGoogle } from '../firebase';
import { UserRole, UserProfile } from '../types';

export default function LoginScreen() {
  const { user, isAuthReady, userProfile, updateProfile, setDemoRole } = useApp();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [step, setStep] = useState<'landing' | 'role' | 'details' | 'subscription'>('landing');
  const [tempProfile, setTempProfile] = useState<Partial<UserProfile>>({});

  if (!isAuthReady) return <FullScreenLoader />;

  const showRegistration = user && !user.isAnonymous && !userProfile?.role;

  // 1. Triggered after Google Login
  if (showRegistration && step === 'landing') setStep('role');

  const handleRolePick = (role: 'senior' | 'caregiver') => {
    setTempProfile({ ...tempProfile, role, name: user?.displayName || '', uid: user?.uid });
    setStep('details');
  };

  const handleDetailsSubmit = (details: any) => {
    // Collect both Caregiver details AND potential Senior data
    setTempProfile({ ...tempProfile, ...details });
    setStep('subscription');
  };

  const handleFinishRegistration = async () => {
    setIsSigningIn(true);
    try {
      // If a linkedSenior object exists (from Caregiver flow), we'd process it here
      // For this step, we just finish the main profile update.
      await updateProfile(tempProfile as UserProfile);
      // Backend/App logic would then need to create the Senior profile in firestore.
    } catch (e) {
      console.error("Registration failed", e);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {step === 'landing' && (
          <Landing 
            onGoogleSignIn={async () => {
              setIsSigningIn(true);
              try { await signInWithGoogle(); } finally { setIsSigningIn(false); }
            }}
            onDemoSenior={() => setDemoRole('senior')}
            onDemoCaregiver={() => setDemoRole('caregiver')}
            isSigningIn={isSigningIn}
          />
        )}

        {step === 'role' && <RolePicker onPick={handleRolePick} />}

        {step === 'details' && (
          <RegistrationForm 
            role={tempProfile.role as 'senior' | 'caregiver'} 
            onSubmit={handleDetailsSubmit} 
          />
        )}

        {step === 'subscription' && (
          <SubscriptionStep 
            onComplete={handleFinishRegistration} 
            loading={isSigningIn}
          />
        )}
      </AnimatePresence>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATED: Registration Form Step with Conditional Linking Step
// ─────────────────────────────────────────────────────────────────────────────
function RegistrationForm({ role, onSubmit }: { role: 'senior' | 'caregiver', onSubmit: (data: any) => void }) {
  // Use a simple local step state specifically for this form component
  const [formStep, setFormStep] = useState<'details' | 'link_senior'>('details');

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    emergencyPhone: '',
    medications: '',
  });

  const [seniorData, setSeniorData] = useState({
    seniorName: '',
    seniorAge: '',
    seniorMeds: '',
    linkMethod: 'create' as 'create' | 'code'
  });

  const handleDetailsContinue = () => {
    if (role === 'senior') {
      // Seniors are done, submit details
      onSubmit(formData);
    } else {
      // Caregivers need to proceed to the linking step
      setFormStep('link_senior');
    }
  };

  const handleFinalSubmit = () => {
    // If caregiver created a new senior, we format it.
    const finalData = {
      ...formData,
      ...(role === 'caregiver' && seniorData.linkMethod === 'create' ? {
        linkedSenior: {
          name: seniorData.seniorName,
          age: seniorData.seniorAge,
          medications: seniorData.seniorMeds,
          role: 'senior',
          // Backend will assign a unique ID to this "ghost" senior.
        }
      } : {})
    };
    onSubmit(finalData);
  };

  return (
    <AnimatePresence mode="wait">
      {formStep === 'details' ? (
        <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-[#2D3748]">Tell us more</h2>
            <p className="text-[#718096]">Setting up your {role} profile</p>
          </div>

          <div className="space-y-4">
            <Input icon={<User size={18}/>} placeholder="Full Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} />
            {role === 'senior' && (
              <>
                <Input icon={<Calendar size={18}/>} placeholder="Age" type="number" value={formData.age} onChange={v => setFormData({...formData, age: v})} />
                <Input icon={<Phone size={18}/>} placeholder="Emergency Contact Phone" value={formData.emergencyPhone} onChange={v => setFormData({...formData, emergencyPhone: v})} />
                <textarea 
                  className="w-full p-4 rounded-2xl border-2 border-[#E2E8F0] focus:border-[#5AB9B1] outline-none min-h-[100px]"
                  placeholder="List current medications (optional)"
                  onChange={(e) => setFormData({...formData, medications: e.target.value})}
                />
              </>
            )}
          </div>

          <button onClick={handleDetailsContinue} className="w-full bg-[#5AB9B1] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4aa8a0] transition-all">
            Continue
          </button>
        </motion.div>
      ) : (
        <SeniorLinkingStep 
          seniorData={seniorData}
          setSeniorData={setSeniorData}
          onBack={() => setFormStep('details')}
          onSubmit={handleFinalSubmit}
        />
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Senior Linking Step (Caregiver only)
// ─────────────────────────────────────────────────────────────────────────────
function SeniorLinkingStep({ seniorData, setSeniorData, onBack, onSubmit }: any) {
  const isCreate = seniorData.linkMethod === 'create';

  return (
    <motion.div key="link" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#E6FFFA] rounded-[20px] flex items-center justify-center mb-4 mx-auto">
          <Link className="text-[#5AB9B1]" size={32} />
        </div>
        <h2 className="text-3xl font-black text-[#2D3748]">Who are you caring for?</h2>
        <p className="text-[#718096]">Link an existing account or create a new profile.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <OptionButton active={isCreate} icon={<UserPlus />} label="Create Profile" onClick={() => setSeniorData({...seniorData, linkMethod: 'create'})}/>
        <OptionButton active={!isCreate} icon={<Link />} label="Enter Code" onClick={() => setSeniorData({...seniorData, linkMethod: 'code'})}/>
      </div>

      {isCreate ? (
        <div className="space-y-4">
          <Input icon={<User size={18}/>} placeholder="Senior's Full Name" value={seniorData.seniorName} onChange={v => setSeniorData({...seniorData, seniorName: v})} />
          <Input icon={<Calendar size={18}/>} placeholder="Senior's Age (Optional)" type="number" value={seniorData.seniorAge} onChange={v => setSeniorData({...seniorData, seniorAge: v})} />
          <textarea 
            className="w-full p-4 rounded-2xl border-2 border-[#E2E8F0] focus:border-[#5AB9B1] outline-none min-h-[100px]"
            placeholder="List senior's current medications (optional)"
            onChange={(e) => setSeniorData({...seniorData, seniorMeds: e.target.value})}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Input icon={<Link size={18}/>} placeholder="Enter 6-digit link code" />
          <p className="text-xs text-[#A0AEC0] text-center px-4">Ask the senior or another caregiver for their linking code.</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-[#EDF2F7] text-[#4A5568] py-4 rounded-2xl font-bold hover:bg-[#E2E8F0] transition-all">
          Back
        </button>
        <button onClick={onSubmit} className="flex-1 bg-[#5AB9B1] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#4aa8a0] transition-all">
          Finish Setup
        </button>
      </div>
    </motion.div>
  );
}

function OptionButton({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all ${active ? 'bg-[#E6FFFA] border-[#5AB9B1] shadow-inner' : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E0]'}`}>
      <div className={active ? 'text-[#5AB9B1]' : 'text-[#A0AEC0]'}>{icon}</div>
      <span className={`font-bold text-sm ${active ? 'text-[#2D3748]' : 'text-[#718096]'}`}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The rest of your components (Shell, Landing, RolePicker, SubscriptionStep, etc.) remain as before.
// ─────────────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
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

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
      <Loader2 className="animate-spin text-[#5AB9B1]" size={40} />
    </div>
  );
}

function Landing({ onGoogleSignIn, onDemoSenior, onDemoCaregiver, isSigningIn, }: { onGoogleSignIn: () => void; onDemoSenior: () => void; onDemoCaregiver: () => void; isSigningIn: boolean; }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="w-full text-center" >
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }} className="w-24 h-24 bg-[#5AB9B1] rounded-[28px] flex items-center justify-center mb-8 shadow-2xl shadow-[#5AB9B1]/30 mx-auto" >
        <Heart className="text-white" size={48} fill="white" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} >
        <h1 className="text-5xl font-black text-[#2D3748] mb-3">Easy<span className="text-[#5AB9B1]">Mind</span></h1>
        <p className="text-xl text-[#718096] mb-12 leading-relaxed">Gentle reminders and peaceful care,<br />every step of the way.</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full space-y-4" >
        <button onClick={onGoogleSignIn} disabled={isSigningIn} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#E2E8F0] py-4 px-6 rounded-2xl font-bold text-[#2D3748] shadow-sm hover:shadow-md hover:border-[#5AB9B1] transition-all text-lg disabled:opacity-60 disabled:cursor-not-allowed" >
          {isSigningIn ? <Loader2 className="animate-spin" size={22} /> : <GoogleIcon />}
          {isSigningIn ? 'Connecting…' : 'Continue with Google'}
        </button>
        <div className="flex items-center gap-3 text-[#CBD5E0]">
          <hr className="flex-1 border-[#E2E8F0]" />
          <span className="text-sm font-medium text-[#A0AEC0]">or try demo</span>
          <hr className="flex-1 border-[#E2E8F0]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DemoButton icon="👵" label="As Senior" sub="Simplified view" onClick={onDemoSenior} borderColor="border-[#F6AD55]" hoverBg="hover:bg-[#FEF3C7]" />
          <DemoButton icon="🧑‍⚕️" label="As Caregiver" sub="Dashboard view" onClick={onDemoCaregiver} borderColor="border-[#63B3ED]" hoverBg="hover:bg-[#EBF8FF]" />
        </div>
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10 text-xs text-[#A0AEC0] px-4" > By continuing you agree to our Terms of Service and Privacy Policy. </motion.p>
    </motion.div>
  );
}

function DemoButton({ icon, label, sub, onClick, borderColor, hoverBg, }: { icon: string; label: string; sub: string; onClick: () => void; borderColor: string; hoverBg: string; }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 bg-white border-2 ${borderColor} ${hoverBg} py-5 px-4 rounded-2xl transition-all hover:shadow-sm`} >
      <span className="text-3xl">{icon}</span>
      <span className="font-bold text-sm text-[#2D3748]">{label}</span>
      <span className="text-xs text-[#718096]">{sub}</span>
    </button>
  );
}

function RolePicker({ onPick }: { onPick: (role: 'senior' | 'caregiver') => void; }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="w-full" >
      <div className="w-16 h-16 bg-[#EDF2F7] rounded-[20px] flex items-center justify-center mb-8 mx-auto">
        <Sparkles className="text-[#5AB9B1]" size={32} />
      </div>
      <h2 className="text-4xl font-black text-[#2D3748] mb-3 text-center">Who are you?</h2>
      <p className="text-[#718096] mb-12 text-center text-lg">Choose your role. You can always change it later.</p>
      <div className="w-full space-y-4">
        <RoleCard icon={<UserRound size={36} className="text-[#F6AD55]" />} bg="bg-[#FEF3C7]" border="border-[#F6AD55]" title="I'm a Senior" description="Get reminders, talk to my assistant, and call my family with one tap." onClick={() => onPick('senior')} />
        <RoleCard icon={<ShieldCheck size={36} className="text-[#5AB9B1]" />} bg="bg-[#E6FFFA]" border="border-[#5AB9B1]" title="I'm a Caregiver" description="Monitor activity, manage routines, and stay connected with my loved one." onClick={() => onPick('caregiver')} />
      </div>
    </motion.div>
  );
}

function RoleCard({ icon, bg, border, title, description, onClick }: { icon: React.ReactNode; bg: string; border: string; title: string; description: string; onClick: () => void; }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className={`w-full flex items-center gap-5 bg-white border-2 ${border} p-6 rounded-[28px] shadow-sm hover:shadow-md transition-all text-left disabled:opacity-60`} >
      <div className={`${bg} w-16 h-16 rounded-2xl flex items-center justify-center shrink-0`}> {icon} </div>
      <div className="flex-1">
        <h3 className="font-black text-xl text-[#2D3748] mb-1">{title}</h3>
        <p className="text-sm text-[#718096] leading-snug">{description}</p>
      </div>
      <ChevronRight className="text-[#CBD5E0] shrink-0" size={20} />
    </motion.button>
  );
}

function SubscriptionStep({ onComplete, loading }: { onComplete: () => void, loading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{opacity: 0}} className="w-full text-center">
      <div className="w-20 h-20 bg-[#F6AD55]/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Sparkles className="text-[#F6AD55]" size={40} />
      </div>
      <h2 className="text-3xl font-black text-[#2D3748] mb-2">Choose a Plan</h2>
      <p className="text-[#718096] mb-8">Start with our most popular option</p>
      <div className="bg-white border-4 border-[#5AB9B1] p-6 rounded-[32px] relative mb-8">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#5AB9B1] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"> Recommended </div>
        <h3 className="text-xl font-bold text-[#2D3748]">Premium Care</h3>
        <div className="text-4xl font-black text-[#2D3748] my-4">$0<span className="text-lg text-[#A0AEC0] font-medium">/mo</span></div>
        <ul className="text-left space-y-3 mb-6">
          <li className="flex items-center gap-2 text-sm text-[#4A5568]"><Check size={16} className="text-[#34A853]"/> AI Health Companion</li>
          <li className="flex items-center gap-2 text-sm text-[#4A5568]"><Check size={16} className="text-[#34A853]"/> Real-time Location Tracking</li>
          <li className="flex items-center gap-2 text-sm text-[#4A5568]"><Check size={16} className="text-[#34A853]"/> Unlimited Reminders</li>
        </ul>
      </div>
      <button onClick={onComplete} disabled={loading} className="w-full bg-[#2D3748] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#1a202c] transition-all disabled:opacity-50" >
        {loading ? <Loader2 className="animate-spin mx-auto" /> : "Start 14-Day Free Trial"}
      </button>
    </motion.div>
  );
}

function Input({ icon, ...props }: any) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0AEC0]">{icon}</div>
      <input {...props} onChange={(e) => props.onChange(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-[#E2E8F0] focus:border-[#5AB9B1] outline-none transition-all" />
    </div>
  );
}

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