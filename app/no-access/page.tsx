"use client";

import { useAuth } from "@/components/AppProviders";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NoAccessPage() {
  const router = useRouter();
  const { manager, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(manager ? "/dashboard" : "/welcome");
  }, [manager, loading, router]);

  return null;
}
