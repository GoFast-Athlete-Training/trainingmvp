"use client";

import { AuthForm } from "@/components/AuthForm";
import { WelcomeShell, WelcomeSpinner } from "@/components/WelcomeShell";
import { useAuth } from "@/components/AppProviders";
import { auth } from "@/lib/firebase";
import { getPostAuthPath } from "@/lib/training-manager-onboarding";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const { user, manager, sessionProbe, loading, refreshManager } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (manager) router.replace(getPostAuthPath(true));
  }, [manager, loading, router]);

  if (loading) {
    return <WelcomeShell status={<WelcomeSpinner label="Checking your session…" />} />;
  }

  if (manager) {
    return <WelcomeShell status={<WelcomeSpinner label="Opening Training Manage…" />} />;
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
    router.replace("/welcome");
  }

  if (user) {
    const isTokenVerifyFailure = sessionProbe?.status === 401;
    return (
      <WelcomeShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            {isTokenVerifyFailure
              ? "You're signed in with Firebase, but Training Manage could not verify your token on the server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY on this app's Vercel project (copy from gf-racemanage Production), then redeploy."
              : "You're signed in, but there is no active training manager seat for this account yet. Ask an admin to assign you from Company Admin → Manage → Training Manage."}
          </p>
          {!isTokenVerifyFailure ? (
            <p className="text-xs text-gray-500">
              Signed-in uid: <span className="font-mono">{user.uid}</span> — must match{" "}
              <span className="font-mono">training_managers.firebaseUid</span> or email on this
              app&apos;s database.
            </p>
          ) : null}
          {sessionProbe?.error ? (
            <p className="text-xs text-gray-400">{sessionProbe.error}</p>
          ) : null}
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

  return (
    <WelcomeShell>
      <AuthForm onSignedIn={() => void refreshManager()} />
    </WelcomeShell>
  );
}
