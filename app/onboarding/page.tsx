"use client";

import { useAuth } from "@/components/AppProviders";
import { WelcomeShell, WelcomeSpinner } from "@/components/WelcomeShell";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
} from "@/lib/training-manager-onboarding";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function firstName(name: string | null, email: string): string {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  return email.split("@")[0] ?? "there";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, manager, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    if (!manager) {
      router.replace("/no-access");
      return;
    }
    if (hasCompletedOnboarding(manager.id)) {
      router.replace("/dashboard");
    }
  }, [user, manager, loading, router]);

  function enterCockpit() {
    if (!manager) return;
    markOnboardingComplete(manager.id);
    router.replace("/dashboard");
  }

  if (loading || !user || !manager) {
    return <WelcomeShell status={<WelcomeSpinner label="Loading…" />} />;
  }

  if (hasCompletedOnboarding(manager.id)) {
    return <WelcomeShell status={<WelcomeSpinner label="Loading…" />} />;
  }

  const greeting = firstName(manager.name, manager.email);

  return (
    <WelcomeShell>
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Welcome, {greeting}</h2>
        <p className="text-base text-gray-600">
          This is the Training Manage cockpit — author build presets, taper blocks, and race-week
          marks for the training engine.
        </p>
        <p className="text-sm text-gray-500">
          Training manager seats are assigned from Company Admin → Manage → Training Manage.
        </p>
        <button
          type="button"
          onClick={enterCockpit}
          className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-orange-700"
        >
          Enter cockpit
        </button>
      </div>
    </WelcomeShell>
  );
}
