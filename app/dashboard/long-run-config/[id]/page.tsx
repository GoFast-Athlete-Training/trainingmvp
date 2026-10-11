"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy URL → long-run rotation editor */
export default function LegacyLongRunConfigRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  useEffect(() => {
    void params.then((p) => {
      router.replace(`/dashboard/long-run-config/long-run/${p.id}`);
    });
  }, [params, router]);
  return <p className="text-gray-500">Redirecting…</p>;
}
