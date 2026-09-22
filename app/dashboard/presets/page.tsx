"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type PresetRow = {
  id: string;
  title: string;
  slug: string;
  minWeeklyMiles: number;
  longRunConfigId: string | null;
};

export default function PresetsListPage() {
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/training/plan-preset");
      const data = (await res.json()) as { presets?: PresetRow[] };
      setRows(data.presets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPreset() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/plan-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New build preset", minWeeklyMiles: 43 }),
      });
      const data = (await res.json()) as { preset?: PresetRow };
      if (data.preset) setRows((prev) => [data.preset!, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Build presets</h1>
          <p className="text-sm text-gray-600">Stub editor — miles then rotations.</p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createPreset()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {creating ? "Creating…" : "New preset"}
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No presets yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/presets/${row.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-gray-500">{row.slug}</p>
                </div>
                <span className="text-sm text-gray-600">{row.minWeeklyMiles} mpw</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
