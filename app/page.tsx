"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AppProviders";
import { getPostAuthPath } from "@/lib/training-manager-onboarding";

export default function HomePage() {
  const router = useRouter();
  const { user, manager, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    router.replace(getPostAuthPath(Boolean(manager), manager?.id));
  }, [user, manager, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  );
}
