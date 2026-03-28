/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SeniorProfile, UserRole, ActivityLogEntry, Reminder, ChatMessage, Location } from '../types';
import { 
  auth, db, onAuthStateChanged, onSnapshot, doc, collection, query, where, 
  setDoc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, handleFirestoreError, OperationType 
} from '../firebase';
import { User } from 'firebase/auth';

interface AppContextType {
  user: User | null;
  isAuthReady: boolean;
  role: UserRole;
  setRole: (role: UserRole) => void;
  seniorProfile: SeniorProfile;
  setSeniorProfile: (profile: SeniorProfile) => void;
  reminders: Reminder[];
  setReminders: (reminders: Reminder[]) => void;
  activityLog: ActivityLogEntry[];
  addLogEntry: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  activeReminder: Reminder | null;
  setActiveReminder: (reminder: Reminder | null) => void;
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_PROFILE: SeniorProfile = {
  name: "Milica Jovanović",
  age: 74,
  primaryCaregiver: "Ana Jovanović",
  emergencyPhone: "+381601234567",
  medications: "Amlodipine 5mg at 8:00 and 20:00. Metformin 500mg at 13:00 with food. Prescribed by Dr. Petrović.",
  notes: "Has a cat named Maca. Loves coffee in the morning. Tends to forget afternoon tasks."
};

const INITIAL_REMINDERS: Reminder[] = [
  { id: '1', title: 'Morning Amlodipine', icon: '💊', time: '08:00', repeat: 'Daily', agent: 'medication', note: 'Take with water' },
  { id: '2', title: 'Lunch Metformin', icon: '🍽️', time: '13:00', repeat: 'Daily', agent: 'medication', note: 'Take with food' },
  { id: '3', title: 'Feed Maca', icon: '🐱', time: '17:30', repeat: 'Daily', agent: 'daily_task' },
];

const SEED_LOG: ActivityLogEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), agent: 'medication', type: 'Medication reminder (Amlodipine)', outcome: 'Completed', message: 'Time for your Amlodipine 💊' },
  { id: '2', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10), agent: 'daily_task', type: 'Feed Maca', outcome: 'No Response', message: 'Don\'t forget to feed Maca 🐱' },
  { id: '3', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), agent: 'chat', type: 'Chat session', outcome: 'Info', message: '10 minute conversation' },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [role, setRole] = useState<UserRole>('senior');
  const [seniorProfile, setSeniorProfile] = useState<SeniorProfile>(INITIAL_PROFILE);
  const [reminders, setReminders] = useState<Reminder[]>(INITIAL_REMINDERS);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(SEED_LOG);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync Profile
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setSeniorProfile(snapshot.data() as SeniorProfile);
      } else {
        // Initialize profile if it doesn't exist
        const initialData = { ...INITIAL_PROFILE, userId: user.uid };
        setDoc(doc(db, 'profiles', user.uid), initialData)
          .catch(e => handleFirestoreError(e, OperationType.WRITE, `profiles/${user.uid}`));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `profiles/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  // Sync Reminders
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder));
      setReminders(data);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'reminders'));
    return () => unsubscribe();
  }, [user]);

  // Sync Activity Log
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'activityLog'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        return { 
          id: d.id, 
          ...docData, 
          timestamp: (docData.timestamp as Timestamp).toDate() 
        } as ActivityLogEntry;
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityLog(data);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'activityLog'));
    return () => unsubscribe();
  }, [user]);

  // Sync Location
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'locations', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCurrentLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          lastUpdated: (data.lastUpdated as Timestamp).toDate()
        });
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `locations/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  const updateProfile = async (profile: SeniorProfile) => {
    if (!user) {
      setSeniorProfile(profile);
      return;
    }
    try {
      await setDoc(doc(db, 'profiles', user.uid), { ...profile, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `profiles/${user.uid}`);
    }
  };

  const addLogEntry = async (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    if (!user) {
      const newEntry: ActivityLogEntry = {
        ...entry,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      };
      setActivityLog(prev => [newEntry, ...prev]);
      return;
    }
    try {
      await addDoc(collection(db, 'activityLog'), {
        ...entry,
        timestamp: Timestamp.now(),
        userId: user.uid
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'activityLog');
    }
  };

  const updateLocation = async (location: Location | null) => {
    if (!user || !location) {
      setCurrentLocation(location);
      return;
    }
    try {
      await setDoc(doc(db, 'locations', user.uid), {
        latitude: location.latitude,
        longitude: location.longitude,
        lastUpdated: Timestamp.fromDate(location.lastUpdated),
        userId: user.uid
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `locations/${user.uid}`);
    }
  };

  const updateReminders = async (newReminders: Reminder[]) => {
    if (!user) {
      setReminders(newReminders);
      return;
    }
    // This is a bit complex since we have individual docs.
    // For simplicity in this demo, we'll just handle adds/updates via separate functions if needed,
    // but here we'll just set the state for local UI and assume individual updates happen elsewhere.
    setReminders(newReminders);
  };

  return (
    <AppContext.Provider value={{
      user, isAuthReady,
      role, setRole,
      seniorProfile, setSeniorProfile: updateProfile,
      reminders, setReminders: updateReminders,
      activityLog, addLogEntry,
      chatHistory, setChatHistory,
      activeReminder, setActiveReminder,
      currentLocation, setCurrentLocation: updateLocation
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
