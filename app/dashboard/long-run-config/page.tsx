"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type LrConfig = {
  id: string;
  name: string;
  positions: Array<{ cyclePosition: number; catalogueWorkoutId: string | null }>;
};

export default function LongRunConfigListPage() {
  const [rows, setRows] = useState<LrConfig[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/long-run-config");
    const data = (await res.json()) as { configs?: LrConfig[] };
    setRows(data.configs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createConfig(positionCount: number) {
    setCreating(true);
    try {
      await authFetch("/api/training/long-run-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: positionCount === 2 ? "Taper LR (2w)" : "Build LR (4w)", positionCount }),
      });
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Long run rotations</h1>
          <p className="text-sm text-gray-600">long_run_config → positions → catalogue</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={creating}
            onClick={() => void createConfig(4)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            New 4-slot (build)
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createConfig(2)}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white"
          >
            New 2-slot (taper)
          </button>
        </div>
      </div>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3">
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-gray-500">{row.id}</p>
            <p className="mt-1 text-sm text-gray-600">{row.positions.length} positions</p>
          </li>
        ))}
      </ul>
      <Link href="/dashboard/presets" className="text-sm text-sky-700 underline">
        Attach to a build preset →
      </Link>
    </div>
  );
}
