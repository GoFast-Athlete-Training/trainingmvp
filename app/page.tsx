"use client";

import { useAuth } from "@/components/AppProviders";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
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
    router.replace("/dashboard");
  }, [user, manager, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  );
}
