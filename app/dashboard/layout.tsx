"use client";

import { useAuth } from "@/components/AppProviders";
import { DashboardShell } from "@/components/DashboardShell";
import { hasCompletedOnboarding } from "@/lib/training-manager-onboarding";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, manager, loading } = useAuth();
  const router = useRouter();

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
    if (!hasCompletedOnboarding(manager.id)) {
      router.replace("/onboarding");
    }
  }, [user, manager, loading, router]);

  if (loading || !user || !manager || !hasCompletedOnboarding(manager.id)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
