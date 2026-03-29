/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, ActivityLogEntry, Reminder, ChatMessage, Location } from '../types';
import { 
  auth, db, onAuthStateChanged, onSnapshot, doc, collection, query, where, 
  setDoc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, handleFirestoreError, OperationType
} from '../firebase';
import { User } from 'firebase/auth';

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
  addLogEntry: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  activeReminder: Reminder | null;
  setActiveReminder: (reminder: Reminder | null) => void;
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
  demoRole: UserRole;
  setDemoRole: (role: UserRole) => void;
  seniorsList: UserProfile[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_SENIOR_DATA = {
  name: "Milica Jovanović",
  age: 74,
  primaryCaregiver: "Ana Jovanović",
  emergencyPhone: "+381601234567",
  medications: "Amlodipine 5mg at 8:00 and 20:00. Metformin 500mg at 13:00 with food. Prescribed by Dr. Petrović.",
  notes: "Has a cat named Maca. Loves coffee in the morning. Tends to forget afternoon tasks."
};

const SHARED_DEMO_ID = 'shared-demo-senior';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [linkedSeniorProfile, setLinkedSeniorProfile] = useState<UserProfile | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [demoReminders, setDemoReminders] = useState<Reminder[]>(INITIAL_REMINDERS);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [demoRole, setDemoRole] = useState<UserRole>(null);
  const [seniorsList, setSeniorsList] = useState<UserProfile[]>([]);

  const role = user ? (userProfile?.role || null) : demoRole;
  const isDemo = !user || user.isAnonymous;
  const targetUserId = isDemo ? SHARED_DEMO_ID : (role === 'senior' ? user?.uid : userProfile?.linkedSeniorId);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      
    });
    return () => unsubscribe();
  }, []);

  // Initialize Shared Demo Data
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const initDemo = async () => {
      const demoDoc = await getDoc(doc(db, 'profiles', SHARED_DEMO_ID));
      if (!demoDoc.exists()) {
        await setDoc(doc(db, 'profiles', SHARED_DEMO_ID), {
          uid: SHARED_DEMO_ID,
          role: 'senior',
          ...INITIAL_SENIOR_DATA,
          createdAt: Timestamp.now()
        });
      }
    };
    initDemo().catch(console.error);
  }, [isAuthReady, user]);

  // Sync Seniors List (for caregivers to browse)
  useEffect(() => {
    if (role !== 'caregiver') {
      setSeniorsList([]);
      return;
    }

    if (isDemo) {
      setSeniorsList([
        { uid: SHARED_DEMO_ID, name: 'Milica Jovanović', role: 'senior', ...INITIAL_SENIOR_DATA },
        { uid: 'demo-senior-2', name: 'Dragan Nikolić', role: 'senior', age: 78, notes: 'Loves chess and walking in the park.' },
        { uid: 'demo-senior-3', name: 'Jelena Marković', role: 'senior', age: 82, notes: 'Very active, but needs medication reminders.' }
      ]);
      return;
    }

    // Only fetch from Firestore if we have a real user
    if (!user) return;

    const q = query(collection(db, 'profiles'), where('role', '==', 'senior'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => d.data() as UserProfile);
      setSeniorsList(data);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'profiles'));
    return () => unsubscribe();
  }, [role, user, demoRole]);

  // Sync User Profile
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      } else {
        // Fallback for demo users before profile is created in Firestore
        if (isDemo && demoRole) {
          setUserProfile({
            uid: user.uid,
            name: 'Demo User',
            role: demoRole,
            linkedSeniorId: demoRole === 'caregiver' ? SHARED_DEMO_ID : undefined
          });
        } else {
          setUserProfile(null);
        }
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `profiles/${user.uid}`));
    return () => unsubscribe();
  }, [user, isDemo, demoRole]);

  // Initialize User Profile in Firestore
  useEffect(() => {
    if (!isAuthReady || !user || !demoRole) return;
    
    const initProfile = async () => {
      const profileRef = doc(db, 'profiles', user.uid);
      const profileDoc = await getDoc(profileRef);
      if (!profileDoc.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          name: 'Demo User',
          role: demoRole,
          linkedSeniorId: demoRole === 'caregiver' ? SHARED_DEMO_ID : undefined,
          createdAt: Timestamp.now()
        });
      }
    };
    initProfile().catch(console.error);
  }, [isAuthReady, user, demoRole]);

  // Sync Linked Senior Profile
  useEffect(() => {
    if (!targetUserId) {
      setLinkedSeniorProfile(null);
      return;
    }
    
    // Always fetch from Firestore if we have a targetUserId
    const unsubscribe = onSnapshot(doc(db, 'profiles', targetUserId), (snapshot) => {
      if (snapshot.exists()) {
        setLinkedSeniorProfile(snapshot.data() as UserProfile);
      } else if (targetUserId === SHARED_DEMO_ID) {
        // Fallback for shared demo if doc doesn't exist yet
        setLinkedSeniorProfile({
          uid: SHARED_DEMO_ID,
          role: 'senior',
          ...INITIAL_SENIOR_DATA
        });
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `profiles/${targetUserId}`));
    return () => unsubscribe();
  }, [targetUserId]);

  // Sync Reminders (based on targetUserId)
  useEffect(() => {
    if (!targetUserId) {
      setReminders([]);
      return;
    }
    
    // Always fetch from Firestore if we have a targetUserId
    const q = query(collection(db, 'reminders'), where('userId', '==', targetUserId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder));
      setReminders(data);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'reminders'));
    return () => unsubscribe();
  }, [targetUserId]);

  // Sync Activity Log (based on targetUserId)
  useEffect(() => {
    if (!targetUserId) {
      setActivityLog([]);
      return;
    }
    
    // Always fetch from Firestore if we have a targetUserId
    const q = query(collection(db, 'activityLog'), where('userId', '==', targetUserId));
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
  }, [targetUserId]);

  // Sync Location (based on targetUserId)
  useEffect(() => {
    if (!targetUserId) {
      setCurrentLocation(null);
      return;
    }
    
    // Always fetch from Firestore if we have a targetUserId
    const unsubscribe = onSnapshot(doc(db, 'locations', targetUserId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCurrentLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          lastUpdated: (data.lastUpdated as Timestamp).toDate()
        });
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `locations/${targetUserId}`));
    return () => unsubscribe();
  }, [targetUserId]);

  const addReminder = async (reminder: Omit<Reminder, 'id'>) => {
    if (!targetUserId) return;
    
    // Always push to Firestore if we have a targetUserId
    try {
      await addDoc(collection(db, 'reminders'), {
        ...reminder,
        userId: targetUserId,
        completed: false
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reminders');
    }
  };

  const deleteReminder = async (reminderId: string) => {
    // Always push to Firestore if we have a targetUserId
    try {
      await deleteDoc(doc(db, 'reminders', reminderId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `reminders/${reminderId}`);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const profileId = (isDemo && demoRole === 'senior') ? SHARED_DEMO_ID : user.uid;
    try {
      const profileRef = doc(db, 'profiles', profileId);
      const currentSnapshot = await getDoc(profileRef);
      
      if (currentSnapshot.exists()) {
        await updateDoc(profileRef, updates);
      } else {
        // New profile creation
        const newProfile: UserProfile = {
          uid: profileId,
          name: user.displayName || 'Demo User',
          role: updates.role || demoRole || 'senior',
          ...(updates.role === 'senior' || demoRole === 'senior' ? INITIAL_SENIOR_DATA : {}),
          ...updates
        };
        await setDoc(profileRef, newProfile);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `profiles/${profileId}`);
    }
  };

  const linkSenior = async (seniorId: string) => {
    if (!user || role !== 'caregiver') return;
    try {
      // Verify senior exists
      const seniorRef = doc(db, 'profiles', seniorId);
      const seniorSnap = await getDoc(seniorRef);
      if (!seniorSnap.exists() || seniorSnap.data().role !== 'senior') {
        throw new Error('Senior profile not found');
      }
      await updateDoc(doc(db, 'profiles', user.uid), { linkedSeniorId: seniorId });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `profiles/${user.uid}`);
      throw e;
    }
  };

  const addLogEntry = async (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    if (!targetUserId) return;
    try {
      await addDoc(collection(db, 'activityLog'), {
        ...entry,
        timestamp: Timestamp.now(),
        userId: targetUserId
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'activityLog');
    }
  };

  const updateLocation = async (location: Location | null) => {
    if (!targetUserId || !location || role !== 'senior') return;
    try {
      await setDoc(doc(db, 'locations', targetUserId), {
        latitude: location.latitude,
        longitude: location.longitude,
        lastUpdated: Timestamp.fromDate(location.lastUpdated),
        userId: targetUserId
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `locations/${targetUserId}`);
    }
  };

  const updateReminders = async (newReminders: Reminder[]) => {
    // Local state update for immediate feedback, 
    // real updates happen via individual addDoc/deleteDoc calls in components
    setReminders(newReminders);
  };

  return (
    <AppContext.Provider value={{
      user, isAuthReady,
      role, 
      userProfile, setUserProfile,
      linkedSeniorProfile, setLinkedSeniorProfile,
      updateProfile,
      linkSenior,
      reminders, addReminder, deleteReminder, setReminders: updateReminders,
      activityLog, addLogEntry,
      chatHistory, setChatHistory,
      activeReminder, setActiveReminder,
      currentLocation, setCurrentLocation: updateLocation,
      demoRole, setDemoRole,
      seniorsList
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
