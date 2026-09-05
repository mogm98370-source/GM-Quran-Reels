import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  setLogLevel,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { UserProfile, SubscriptionPlan } from '../types';

export const SUPER_ADMIN_EMAILS = [
  'larblaablaybla@gmail.com',
  'mogm98370@gmail.com'
];
export const SUPER_ADMIN_EMAIL = 'larblaablaybla@gmail.com';

// Prevent verbose connection retry warnings from cluttering console
try {
  setLogLevel('error');
} catch {}

// Initialize Firebase SDK
const app = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApp();
export const auth = getAuth(app);

// Use long-polling transport for Firestore to guarantee connection stability across proxies, iframes and cloud sandboxes
let firestoreInstance: ReturnType<typeof getFirestore>;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfigJson.firestoreDatabaseId);
} catch {
  firestoreInstance = getFirestore(app, firebaseConfigJson.firestoreDatabaseId);
}
export const db = firestoreInstance;
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, { dailyVideos: number; fps: number; watermark: boolean; priceGems: number; durationDays: number }> = {
  free: { dailyVideos: 3, fps: 20, watermark: true, priceGems: 0, durationDays: 9999 },
  weekly: { dailyVideos: 9, fps: 30, watermark: false, priceGems: 1000, durationDays: 7 },
  monthly: { dailyVideos: 20, fps: 60, watermark: false, priceGems: 5000, durationDays: 30 },
  yearly: { dailyVideos: 50, fps: 90, watermark: false, priceGems: 10000, durationDays: 365 },
};

/**
 * Checks if a user is the designated Super Admin
 */
export function isUserSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAILS.some(admin => admin.toLowerCase().trim() === clean);
}

/**
 * Get current date formatted as YYYY-MM-DD for quota tracking
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetches user profile from Firestore, handling daily usage reset if day changed
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      // Check if local cache has profile
      const local = localStorage.getItem(`gm_profile_${uid}`);
      if (local) {
        try { return JSON.parse(local) as UserProfile; } catch {}
      }
      return null;
    }

    const data = snap.data() as UserProfile;
    const today = getTodayDateString();

    // Check if subscription has expired
    let currentPlan = data.subscriptionType || 'free';
    if (currentPlan !== 'free' && data.subscriptionEnd) {
      const expiry = new Date(data.subscriptionEnd);
      if (expiry < new Date()) {
        currentPlan = 'free';
        try {
          await updateDoc(userRef, {
            subscriptionType: 'free',
            maxFPS: 20,
            dailyLimit: 3,
            hasWatermark: true,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Silent subscription expiry update:', e);
        }
        data.subscriptionType = 'free';
        data.maxFPS = 20;
        data.dailyLimit = 3;
        data.hasWatermark = true;
      }
    }

    // Reset daily count if date has changed
    if (data.lastUsageDate !== today) {
      try {
        await updateDoc(userRef, {
          dailyVideosUsed: 0,
          lastUsageDate: today,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Silent daily count reset update:', e);
      }
      data.dailyVideosUsed = 0;
      data.lastUsageDate = today;
    }

    // Persist to local cache for offline resilience
    try {
      localStorage.setItem(`gm_profile_${uid}`, JSON.stringify(data));
    } catch {}

    return data;
  } catch (err) {
    console.warn('Network issue fetching user profile, checking local cache:', err);
    try {
      const local = localStorage.getItem(`gm_profile_${uid}`);
      if (local) {
        return JSON.parse(local) as UserProfile;
      }
    } catch {}
    throw err;
  }
}

/**
 * Create a new user profile document in Firestore upon registration
 */
export async function createUserProfile(uid: string, name: string, email: string): Promise<UserProfile> {
  const today = getTodayDateString();
  const newUser: UserProfile = {
    uid,
    name,
    email,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=065f46`,
    accountStatus: 'active',
    subscriptionType: 'free',
    subscriptionStart: new Date().toISOString(),
    subscriptionEnd: '',
    gems: 0,
    dailyVideosUsed: 0,
    lastUsageDate: today,
    maxFPS: 20,
    dailyLimit: 3,
    hasWatermark: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(`gm_profile_${uid}`, JSON.stringify(newUser));
  } catch {}

  try {
    await setDoc(doc(db, 'users', uid), newUser);
  } catch (err) {
    console.warn('Silent profile setDoc sync:', err);
  }
  return newUser;
}

/**
 * Updates user profile name, avatar or default preferences
 */
export async function updateUserProfileData(
  uid: string,
  updates: { name?: string; avatar?: string; defaultReciter?: string }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });

  try {
    const local = localStorage.getItem(`gm_profile_${uid}`);
    if (local) {
      const parsed = JSON.parse(local);
      localStorage.setItem(`gm_profile_${uid}`, JSON.stringify({ ...parsed, ...updates }));
    }
  } catch {}

  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: updates.name || auth.currentUser.displayName,
        photoURL: updates.avatar || auth.currentUser.photoURL
      });
    } catch (e) {
      console.warn('updateProfile error:', e);
    }
  }
}

/**
 * Logs an admin action to auditLogs collection
 */
export async function logAdminAction(adminUid: string, action: string, targetUserUid?: string, value?: any, details?: string) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      adminUid,
      action,
      targetUserUid: targetUserUid || null,
      value: value || null,
      details: details || '',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to save audit log:', e);
  }
}

/**
 * Logs application errors for monitoring
 */
export async function logAppError(type: 'Audio' | 'Rendering' | 'Encoding' | 'Firebase' | 'Storage' | 'Auth', message: string, page: string, userId?: string) {
  try {
    await addDoc(collection(db, 'errorLogs'), {
      type,
      message,
      page,
      userId: userId || null,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to record error log:', e);
  }
}
