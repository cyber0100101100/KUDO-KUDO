import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Listen to real-time updates for the user document
        unsubscribeUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({ 
              uid: userDoc.id, 
              displayName: data.displayName || firebaseUser.displayName || 'موظف كودو',
              email: data.email || firebaseUser.email || '',
              profileImageUrl: data.profileImageUrl || firebaseUser.photoURL || '',
              ...data 
            } as User);
          } else {
            // Document might not exist yet, but we have the Auth user
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'موظف كودو',
              email: firebaseUser.email || '',
              profileImageUrl: firebaseUser.photoURL || '',
              role: 'employee', // Default role
            } as any);
          }
          setLoading(false);
        }, (error) => {
          console.error("User doc listener error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
