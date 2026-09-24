"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type BuildRow = {
  id: string;
  name: string;
  startLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  maxWeeklyMiles: number | null;
};

export default function BuildListPage() {
  const router = useRouter();
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
      const res = await authFetch("/api/training/build-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled" }),
      });
      const data = (await res.json()) as { build?: { id: string } };
      if (data.build?.id) router.push(`/dashboard/build/${data.build.id}`);
      else await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Build presets</h1>
          <p className="text-sm text-gray-600">
            Starting and peak long run, weekly peak, and run-type rotations. Link from a plan preset or edit here.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createBuild()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New build"}
        </button>
      </div>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-gray-500">
                Start {row.startLongRunMiles ?? "—"} → peak {row.peakLongRunMiles ?? "—"} · week{" "}
                {row.maxWeeklyMiles ?? "—"}
              </p>
            </div>
            <Link href={`/dashboard/build/${row.id}`} className="text-sm font-medium text-sky-700 hover:underline">
              Edit
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
        ← Plan presets
      </Link>
    </div>
  );
}
