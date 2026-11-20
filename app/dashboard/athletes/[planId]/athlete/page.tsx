"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AthleteDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const planId = typeof params.planId === "string" ? params.planId : "";

  useEffect(() => {
    if (!planId) return;
    router.replace(`/dashboard/athletes/${encodeURIComponent(planId)}`);
  }, [planId, router]);

  return <p className="text-sm text-gray-500">Loading…</p>;
}
