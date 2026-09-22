"use client";

import { AuthForm } from "@/components/AuthForm";
import { WelcomeShell, WelcomeSpinner } from "@/components/WelcomeShell";
import { useAuth } from "@/components/AppProviders";
import { getPostAuthPath } from "@/lib/training-manager-onboarding";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const { user, manager, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    router.replace(getPostAuthPath(Boolean(manager), manager?.id));
  }, [user, manager, loading, router]);

  if (loading) {
    return <WelcomeShell status={<WelcomeSpinner label="Checking your session…" />} />;
  }

  if (user) {
    return <WelcomeShell status={<WelcomeSpinner label="Opening Training Manage…" />} />;
  }

  return (
    <WelcomeShell>
      <AuthForm />
    </WelcomeShell>
  );
}
