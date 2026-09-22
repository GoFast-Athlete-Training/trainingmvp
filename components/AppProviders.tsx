"use client";

import { auth } from "@/lib/firebase";
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

const STAFF_STORAGE_KEY = "trainingmgmt_staff_id";

async function fetchManagerSession(token: string): Promise<TrainingManagerSession | null> {
  const response = await fetch("/api/training-managers/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as {
    success?: boolean;
    manager?: TrainingManagerSession;
  };
  if (response.ok && payload.manager) {
    localStorage.setItem(STAFF_STORAGE_KEY, payload.manager.id);
    return payload.manager;
  }
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
        localStorage.removeItem(STAFF_STORAGE_KEY);
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

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const staffId = localStorage.getItem(STAFF_STORAGE_KEY);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (staffId) headers.set("x-gofast-staff-id", staffId);
  return fetch(path, { ...init, headers });
}
