/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AppContext.tsx
 *
 * Fixes vs previous version:
 *  - Removed unused `signInAnonymously` import (was imported but never called)
 *  - `setCurrentLocation` is now a plain void function (fire-and-forgets the
 *    async Firestore write) so it matches the interface and SeniorView's call-site
 *  - `addLogEntry` interface updated to return Promise<void> (matches async impl)
 *  - Removed internal `updateReminders` wrapper; `setReminders` is the raw setter
 *  - All firebase imports come exclusively from '../firebase' (no direct firebase/* imports
 *    except `User` from 'firebase/auth' which is a type only)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole, ActivityLogEntry, Reminder, ChatMessage, Location } from '../types';
import {
  auth, db,
  onAuthStateChanged, onSnapshot,
  doc, collection, query, where,
  setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  Timestamp, writeBatch,
  handleFirestoreError, OperationType,
} from '../firebase';
import { User } from 'firebase/auth'; // type-only import, no runtime mismatch

// ─────────────────────────────────────────────────────────────────────────────
// Context interface
// ─────────────────────────────────────────────────────────────────────────────
interface AppContextType {
  user: User | null;
  isAuthReady: boolean;
  role: UserRole;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  linkedSeniorProfile: UserProfile | null;
  setLinkedSeniorProfile: (profile: UserProfile | null) => void;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  linkSenior: (seniorId: string) => Promise<void>;
  reminders: Reminder[];
  addReminder: (reminder: Omit<Reminder, 'id'>) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  setReminders: (reminders: Reminder[]) => void;
  activityLog: ActivityLogEntry[];
  addLogEntry: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  activeReminder: Reminder | null;
  setActiveReminder: (reminder: Reminder | null) => void;
  /** Synchronous wrapper — Firestore write is fire-and-forgot internally */
  setCurrentLocation: (location: Location | null) => void;
  currentLocation: Location | null;
  /** Only meaningful for anonymous demo sessions */
  demoRole: UserRole;
  setDemoRole: (role: UserRole) => void;
  seniorsList: UserProfile[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SHARED_DEMO_ID = 'shared-demo-senior';

const INITIAL_SENIOR_DATA = {
  name: 'Milica Jovanović',
  age: 74,
  primaryCaregiver: 'Ana Jovanović',
  emergencyPhone: '+381601234567',
  medications: 'Amlodipine 5mg at 8:00 and 20:00. Metformin 500mg at 13:00 with food.',
  notes: 'Has a cat named Maca. Loves coffee in the morning.',
};

const INITIAL_REMINDERS: Reminder[] = [
  { id: '1', title: 'Morning Amlodipine', icon: '💊', time: '08:00', repeat: 'Daily', agent: 'medication', note: 'Take with water' },
  { id: '2', title: 'Lunch Metformin',    icon: '🍽️', time: '13:00', repeat: 'Daily', agent: 'medication', note: 'Take with food' },
  { id: '3', title: 'Feed Maca',          icon: '🐱', time: '17:30', repeat: 'Daily', agent: 'daily_task' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [linkedSeniorProfile, setLinkedSeniorProfile] = useState<UserProfile | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [currentLocation, setCurrentLocationState] = useState<Location | null>(null);
  const [demoRole, setDemoRole] = useState<UserRole>(null);
  const [seniorsList, setSeniorsList] = useState<UserProfile[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAnon = !user || user.isAnonymous;

  const role: UserRole = isAnon ? demoRole : (userProfile?.role ?? null);

  const targetUserId: string | null =
    role === 'senior'
      ? (isAnon ? SHARED_DEMO_ID : (user?.uid ?? null))
      : (userProfile?.linkedSeniorId ?? null);

  // ── Auth listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ── Bootstrap shared demo profile (idempotent) ────────────────────────────
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const initDemo = async () => {
      const ref = doc(db, 'profiles', SHARED_DEMO_ID);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: SHARED_DEMO_ID,
          role: 'senior',
          ...INITIAL_SENIOR_DATA,
          createdAt: Timestamp.now(),
        });
      }
    };
    initDemo().catch(console.error);
  }, [isAuthReady, user]);

  // ── Own profile (authenticated users only) ────────────────────────────────
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setUserProfile(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'profiles', user.uid),
      (snap) => setUserProfile(snap.exists() ? (snap.data() as UserProfile) : null),
      (e) => handleFirestoreError(e, OperationType.GET, `profiles/${user.uid}`)
    );
    return () => unsub();
  }, [user]);

  // ── Senior profile we are monitoring ─────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) { setLinkedSeniorProfile(null); return; }
    const unsub = onSnapshot(
      doc(db, 'profiles', targetUserId),
      (snap) => {
        if (snap.exists()) {
          setLinkedSeniorProfile(snap.data() as UserProfile);
        } else if (targetUserId === SHARED_DEMO_ID) {
          setLinkedSeniorProfile({ uid: SHARED_DEMO_ID, role: 'senior', ...INITIAL_SENIOR_DATA });
        } else {
          setLinkedSeniorProfile(null);
        }
      },
      (e) => handleFirestoreError(e, OperationType.GET, `profiles/${targetUserId}`)
    );
    return () => unsub();
  }, [targetUserId]);

  // ── Seniors list (caregiver browse screen) ────────────────────────────────
  useEffect(() => {
    if (role !== 'caregiver') { setSeniorsList([]); return; }
    if (isAnon) {
      setSeniorsList([
        { uid: SHARED_DEMO_ID, name: 'Milica Jovanović', role: 'senior', ...INITIAL_SENIOR_DATA },
      ]);
      return;
    }
    if (!user) return;
    const q = query(collection(db, 'profiles'), where('role', '==', 'senior'));
    const unsub = onSnapshot(
      q,
      (snap) => setSeniorsList(snap.docs.map(d => d.data() as UserProfile)),
      (e) => handleFirestoreError(e, OperationType.LIST, 'profiles')
    );
    return () => unsub();
  }, [role, user, isAnon]);

  // ── Reminders ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) { setReminders([]); return; }
    if (isAnon && targetUserId === SHARED_DEMO_ID) {
      setReminders(INITIAL_REMINDERS);
      return;
    }
    const q = query(collection(db, 'reminders'), where('userId', '==', targetUserId));
    const unsub = onSnapshot(
      q,
      (snap) => setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder))),
      (e) => handleFirestoreError(e, OperationType.LIST, 'reminders')
    );
    return () => unsub();
  }, [targetUserId, isAnon]);

  // ── Activity log ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) { setActivityLog([]); return; }
    if (isAnon && targetUserId !== SHARED_DEMO_ID) { setActivityLog([]); return; }
    const q = query(collection(db, 'activityLog'), where('userId', '==', targetUserId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs
          .map(d => {
            const dd = d.data();
            return {
              id: d.id,
              ...dd,
              timestamp: (dd.timestamp as Timestamp).toDate(),
            } as ActivityLogEntry;
          })
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivityLog(entries);
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'activityLog')
    );
    return () => unsub();
  }, [targetUserId, isAnon]);

  // ── Location (read from Firestore) ────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) { setCurrentLocationState(null); return; }
    if (isAnon && targetUserId !== SHARED_DEMO_ID) { setCurrentLocationState(null); return; }
    const unsub = onSnapshot(
      doc(db, 'locations', targetUserId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCurrentLocationState({
            latitude: d.latitude,
            longitude: d.longitude,
            lastUpdated: (d.lastUpdated as Timestamp).toDate(),
          });
        }
      },
      (e) => handleFirestoreError(e, OperationType.GET, `locations/${targetUserId}`)
    );
    return () => unsub();
  }, [targetUserId, isAnon]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const updateProfile = useCallback(async (updates: Partial<UserProfile> & { linkedSenior?: any }) => {
  if (!user || user.isAnonymous) return;

  const batch = writeBatch(db);
  const caregiverRef = doc(db, 'profiles', user.uid);
  
  const { linkedSenior, ...mainProfileUpdates } = updates;
  let finalSeniorId = mainProfileUpdates.linkedSeniorId;

  try {
    // Fetch existing doc to preserve createdAt and avoid overwriting stable fields
    const existingSnap = await getDoc(caregiverRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    // SCENARIO: Caregiver is creating a new Senior profile during registration
    if (linkedSenior && mainProfileUpdates.role === 'caregiver') {
      const newSeniorRef = doc(collection(db, 'profiles'));
      finalSeniorId = newSeniorRef.id;

      batch.set(newSeniorRef, {
        uid: finalSeniorId,
        role: 'senior',
        name: linkedSenior.name,
        age: Number(linkedSenior.age) || null,
        medications: linkedSenior.medications || '',
        primaryCaregiver: user.uid,
        createdAt: Timestamp.now(),
      });
    }

    const userProfileData = {
      uid: user.uid,
      name: user.displayName ?? 'EasyMind User',
      // Preserve existing createdAt — never overwrite it on updates
      createdAt: existingData?.createdAt ?? Timestamp.now(),
      ...mainProfileUpdates,
      linkedSeniorId: finalSeniorId ?? null,
    };

    batch.set(caregiverRef, userProfileData, { merge: true });
    await batch.commit();

    // DO NOT call setUserProfile here — the onSnapshot listener handles it.
    // Calling it manually created a new object reference on every update,
    // which triggered downstream effects and caused the login loop.

  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `profiles/${user.uid}`);
    throw e;
  }
}, [user]);

  const linkSenior = useCallback(async (seniorId: string) => {
    if (!user || user.isAnonymous || role !== 'caregiver') return;
    const snap = await getDoc(doc(db, 'profiles', seniorId));
    if (!snap.exists() || snap.data().role !== 'senior') {
      throw new Error('Senior profile not found');
    }
    await updateDoc(doc(db, 'profiles', user.uid), { linkedSeniorId: seniorId });
  }, [user, role]);

  const addReminder = useCallback(async (reminder: Omit<Reminder, 'id'>) => {
    if (!targetUserId) return;
    if (isAnon) {
      setReminders(prev => [...prev, { ...reminder, id: Date.now().toString() }]);
      return;
    }
    try {
      await addDoc(collection(db, 'reminders'), {
        ...reminder,
        userId: targetUserId,               // senior this reminder belongs to
        createdBy: user?.uid ?? 'unknown',  // who created it
        createdAt: Timestamp.now(),
        completed: false,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reminders');
    }
  }, [targetUserId, isAnon, user]);

  const deleteReminder = useCallback(async (reminderId: string) => {
    if (isAnon) {
      setReminders(prev => prev.filter(r => r.id !== reminderId));
      return;
    }
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `reminders/${reminderId}`);
    }
  }, [isAnon]);

  const addLogEntry = useCallback(async (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    if (!targetUserId || isAnon) return;
    try {
      await addDoc(collection(db, 'activityLog'), {
        ...entry,
        timestamp: Timestamp.now(),
        userId: targetUserId,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'activityLog');
    }
  }, [targetUserId, isAnon]);

  /**
   * Synchronous wrapper around the async Firestore location write.
   * Updates local state immediately; persists in the background.
   * The void return type matches the interface and all call-sites in SeniorView.
   */
  const setCurrentLocation = useCallback((location: Location | null) => {
    setCurrentLocationState(location);
    if (!location || role !== 'senior' || !targetUserId || isAnon) return;
    setDoc(doc(db, 'locations', targetUserId), {
      latitude: location.latitude,
      longitude: location.longitude,
      lastUpdated: Timestamp.fromDate(location.lastUpdated),
      userId: targetUserId,
    }).catch(e => handleFirestoreError(e, OperationType.WRITE, `locations/${targetUserId}`));
  }, [role, targetUserId, isAnon]);

  return (
    <AppContext.Provider value={{
      user, isAuthReady,
      role,
      userProfile, setUserProfile,
      linkedSeniorProfile, setLinkedSeniorProfile,
      updateProfile,
      linkSenior,
      reminders, addReminder, deleteReminder, setReminders,
      activityLog, addLogEntry,
      chatHistory, setChatHistory,
      activeReminder, setActiveReminder,
      currentLocation, setCurrentLocation,
      demoRole, setDemoRole,
      seniorsList,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};