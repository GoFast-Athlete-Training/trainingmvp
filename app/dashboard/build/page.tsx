"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type BuildRow = {
  id: string;
  name: string;
  peakLongRunMiles: number | null;
  peakWeeklyMiles: number | null;
};

export default function BuildListPage() {
  const [rows, setRows] = useState<BuildRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/build-preset");
    const data = (await res.json()) as { builds?: BuildRow[] };
    setRows(data.builds ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBuild() {
    setCreating(true);
    try {
      await authFetch("/api/training/build-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New build preset" }),
      });
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Build preset</h1>
          <p className="text-sm text-gray-600">
            Edit long-run peak, weekly peak, and the workouts bolted to this build. Presets snap these miles when linked.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createBuild()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New build preset"}
        </button>
      </div>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-gray-500">
                Long-run peak {row.peakLongRunMiles ?? "—"} mi · Weekly peak {row.peakWeeklyMiles ?? "—"} mi
              </p>
            </div>
            <Link href={`/dashboard/build/${row.id}`} className="text-sm font-medium text-sky-700 hover:underline">
              Edit
            </Link>
          </li>
        ))}
        {rows.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No builds yet.</li> : null}
      </ul>
    </div>
  );
}
