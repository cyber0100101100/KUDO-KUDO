import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  addDoc, 
  updateDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp, 
  increment,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Attendance, LeaveRequest, Notification, ChatMessage } from '../types';

// Initialize Firebase
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error('Firebase configuration is missing or incomplete. Check firebase-applet-config.json.');
}
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings optimized for sandboxed environments
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId === '(default)' ? undefined : databaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

// Error handler based on skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Don't throw to prevent crashing the app, just log it
}

// User helpers
export async function getCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (userDoc.exists()) {
    return userDoc.data() as User;
  }
  return null;
}

export async function saveAttendance(attendance: Attendance) {
  try {
    const colRef = collection(db, 'attendance');
    await addDoc(colRef, attendance);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'attendance');
  }
}

export async function getTodaysAttendance(userId: string): Promise<Attendance | null> {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'attendance'),
    where('userId', '==', userId),
    where('date', '==', today),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Attendance;
  }
  return null;
}
