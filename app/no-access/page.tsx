"use client";

import { useAuth } from "@/components/AppProviders";
import { WelcomeShell, WelcomeSpinner } from "@/components/WelcomeShell";
import { auth } from "@/lib/firebase";
import { getPostAuthPath } from "@/lib/training-manager-onboarding";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NoAccessPage() {
  const router = useRouter();
  const { user, manager, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    if (manager) {
      router.replace(getPostAuthPath(true, manager.id));
    }
  }, [user, manager, loading, router]);

  async function handleSignOut() {
    if (auth) await signOut(auth);
    router.replace("/welcome");
  }

  if (loading || !user || manager) {
    return <WelcomeShell status={<WelcomeSpinner label="Loading…" />} />;
  }

  return (
    <WelcomeShell>
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No seat yet</h2>
        <p className="text-base text-gray-600">
          You&apos;re signed in, but Training Manage doesn&apos;t have a training manager seat for
          this account yet. Ask a founder to assign you from Company Admin → Manage → Training
          Manage.
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold hover:bg-gray-50"
        >
          Sign out and try another account
        </button>
      </div>
    </WelcomeShell>
  );
}
