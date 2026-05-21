'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange } from '@/lib/firebase/auth';
import { getPendingInvitations, acceptInvitation } from '@/lib/firebase/firestore';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          document.cookie = `firebaseToken=${token}; path=/; max-age=3600; SameSite=Lax`;
        } catch (e) {
          console.error('Failed to get token', e);
        }
      } else {
        document.cookie = `firebaseToken=; path=/; max-age=0; SameSite=Lax`;
      }

      setUser(firebaseUser);
      setLoading(false);

      // Auto-accept pending invitations on sign-in
      if (firebaseUser?.email) {
        try {
          const invites = await getPendingInvitations(firebaseUser.email);
          for (const inv of invites as any[]) {
            await acceptInvitation(
              inv.id,
              firebaseUser.uid,
              firebaseUser.displayName || '',
              firebaseUser.photoURL || '',
              firebaseUser.email || ''
            );
          }
        } catch (e) {
          // Non-critical — don't block auth
          console.warn('Could not auto-accept invitations:', e);
        }
      }
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
