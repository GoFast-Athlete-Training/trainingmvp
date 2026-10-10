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

export type ManagerSessionProbe = {
  manager: TrainingManagerSession | null;
  status: number | null;
  error: string | null;
};

type AuthContextValue = {
  user: User | null;
  manager: TrainingManagerSession | null;
  sessionProbe: ManagerSessionProbe | null;
  loading: boolean;
  refreshManager: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  manager: null,
  sessionProbe: null,
  loading: true,
  refreshManager: async () => {},
});

async function fetchManagerSession(token: string): Promise<ManagerSessionProbe> {
  const response = await fetch("/api/training-managers/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as {
    success?: boolean;
    manager?: TrainingManagerSession;
    error?: string;
  };
  if (response.ok && payload.manager) {
    localStorage.setItem(TRAINING_MANAGER_ID_KEY, payload.manager.id);
    return { manager: payload.manager, status: response.status, error: null };
  }
  localStorage.removeItem(TRAINING_MANAGER_ID_KEY);
  return {
    manager: null,
    status: response.status,
    error: payload.error ?? null,
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [manager, setManager] = useState<TrainingManagerSession | null>(null);
  const [sessionProbe, setSessionProbe] = useState<ManagerSessionProbe | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshManager = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      setManager(null);
      setSessionProbe(null);
      localStorage.removeItem(TRAINING_MANAGER_ID_KEY);
      return;
    }
    const token = await currentUser.getIdToken();
    const probe = await fetchManagerSession(token);
    setManager(probe.manager);
    setSessionProbe(probe.manager ? null : probe);
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
        setSessionProbe(null);
        localStorage.removeItem(TRAINING_MANAGER_ID_KEY);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = await nextUser.getIdToken();
        const probe = await fetchManagerSession(token);
        setManager(probe.manager);
        setSessionProbe(probe.manager ? null : probe);
      } catch {
        setManager(null);
        setSessionProbe(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, manager, sessionProbe, loading, refreshManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { authFetch } from "@/lib/api";
