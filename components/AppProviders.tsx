"use client";

import { auth } from "@/lib/firebase";
import { TRAINING_MANAGER_ID_KEY } from "@/lib/training-manager-session";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type TrainingManagerSession = {
  id: string;
  email: string;
  name: string | null;
  gofastCompanyId: string;
  gofastCompanyName: string | null;
};

type AuthContextValue = {
  user: User | null;
  manager: TrainingManagerSession | null;
  loading: boolean;
  refreshManager: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  manager: null,
  loading: true,
  refreshManager: async () => {},
});

async function fetchManagerSession(token: string): Promise<TrainingManagerSession | null> {
  const response = await fetch("/api/training-managers/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as {
    success?: boolean;
    manager?: TrainingManagerSession;
  };
  if (response.ok && payload.manager) {
    localStorage.setItem(TRAINING_MANAGER_ID_KEY, payload.manager.id);
    return payload.manager;
  }
  localStorage.removeItem(TRAINING_MANAGER_ID_KEY);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [manager, setManager] = useState<TrainingManagerSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshManager = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      setManager(null);
      return;
    }
    const token = await currentUser.getIdToken();
    const nextManager = await fetchManagerSession(token);
    setManager(nextManager);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setManager(null);
        localStorage.removeItem(TRAINING_MANAGER_ID_KEY);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = await nextUser.getIdToken();
        const nextManager = await fetchManagerSession(token);
        setManager(nextManager);
      } catch {
        setManager(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, manager, loading, refreshManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { authFetch } from "@/lib/api";
