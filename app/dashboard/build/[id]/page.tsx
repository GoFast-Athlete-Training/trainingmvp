"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Legacy route — build editing lives on the plan preset wizard. */
export default function BuildEditorRedirect({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <p className="text-sm text-gray-600">
        Build presets are edited inside a plan preset wizard (core volume + rotations).
      </p>
      <Link href="/dashboard/presets" className="text-sm font-medium text-sky-700 hover:underline">
        ← Plan presets
      </Link>
      {id ? <p className="text-xs text-gray-400">Build row id: {id}</p> : null}
    </div>
  );
}
