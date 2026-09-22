"use client";

import { GoogleIcon } from "@/components/GoogleIcon";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";
import { useState } from "react";

type ActiveMethod = "google" | "email" | null;

export function AuthForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeMethod, setActiveMethod] = useState<ActiveMethod>(null);

  const anyBusy = activeMethod !== null;

  async function handleGoogleSignIn() {
    setActiveMethod("google");
    setError(null);
    try {
      await signInWithGoogle();
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setActiveMethod(null);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setActiveMethod("email");
    setError(null);
    try {
      await signInWithEmail(email, password);
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setActiveMethod(null);
    }
  }

  return (
    <>
      <p className="text-center text-sm text-gray-600">
        Sign in with the same Google account you use in Company HQ.
      </p>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={anyBusy}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {activeMethod === "google" ? (
          <span>Connecting to Google…</span>
        ) : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <div className="relative my-6 text-center text-xs uppercase tracking-wide text-gray-400">
        <span className="bg-white px-2">or email</span>
      </div>

      <form onSubmit={(e) => void handleEmailSignIn(e)} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          placeholder="Password"
        />
        <button
          type="submit"
          disabled={anyBusy}
          className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {activeMethod === "email" ? "Signing in…" : "Sign in with email"}
        </button>
      </form>

      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
    </>
  );
}
