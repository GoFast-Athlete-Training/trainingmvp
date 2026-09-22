"use client";

import { signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/components/AppProviders";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const { user, manager, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user && manager) {
    router.replace("/dashboard");
  }

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">Training Manage</h1>
        <p className="mt-2 text-gray-600">
          Staff cockpit for build, taper, and race-week presets.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={busy}
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
