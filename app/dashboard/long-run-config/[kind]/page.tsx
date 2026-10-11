"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROTATION_KINDS } from "@/lib/training/run-type-config-kinds";

const TAB_KINDS = new Set<string>([...ROTATION_KINDS.map((k) => k.id), "shakeout"]);

/** Single segment after /long-run-config — tab slug or legacy config id (no sibling [id] route). */
export default function RunTypeConfigKindSegmentPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const router = useRouter();

  useEffect(() => {
    void params.then((p) => {
      const slug = p.kind.trim();
      if (TAB_KINDS.has(slug)) {
        router.replace("/dashboard/long-run-config");
        return;
      }
      router.replace(`/dashboard/long-run-config/long-run/${encodeURIComponent(slug)}`);
    });
  }, [params, router]);

  return <p className="text-gray-500">Redirecting…</p>;
}
