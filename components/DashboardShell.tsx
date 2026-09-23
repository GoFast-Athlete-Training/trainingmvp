"use client";

import TrainingManagerSidebar from "@/components/training-manager/TrainingManagerSidebar";
import { useAuth } from "@/components/AppProviders";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { manager } = useAuth();

  async function handleSignOut() {
    if (auth) await signOut(auth);
    router.replace("/welcome");
  }

  return (
    <div className="flex h-screen min-h-0 bg-gray-50">
      <TrainingManagerSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {manager?.name ?? manager?.email ?? "Training staff"}
            </p>
            <p className="text-xs text-gray-500">{manager?.gofastCompanyName ?? "GoFast"}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
