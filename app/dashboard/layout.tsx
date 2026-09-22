"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/components/AppProviders";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, manager, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/welcome");
    else if (!manager) router.replace("/no-access");
  }, [user, manager, loading, router]);

  if (loading || !user || !manager) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
