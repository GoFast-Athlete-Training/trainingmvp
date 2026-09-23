"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type PresetRow = {
  id: string;
  title: string;
  slug: string;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
  buildPreset: { name: string } | null;
  taperPreset: { name: string } | null;
  raceWeekPreset: { title: string } | null;
};

function mi(n: number | null) {
  return n == null ? "—" : `${n} mi`;
}

export default function PresetsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function buildPreset() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/plan-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      const data = (await res.json()) as { preset?: { id: string } };
      if (data.preset?.id) {
        router.push(`/dashboard/presets/${data.preset.id}`);
      } else {
        await load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function deletePreset(id: string, title: string) {
    if (!window.confirm(`Delete preset “${title}”? Build, taper, race week, and catalogue stay.`)) return;
    setDeletingId(id);
    try {
      const res = await authFetch(`/api/training/plan-preset/${id}`, { method: "DELETE" });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan presets</h1>
          <p className="text-sm text-gray-600">
            Each preset links build, taper, and race week. Mileage snaps live on the preset row.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void buildPreset()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {creating ? "Opening…" : "Build preset"}
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No presets yet. Use Build preset to start, or send from Company HQ.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-gray-500">{row.slug}</p>
                <p className="mt-1 text-xs text-gray-600">
                  Snap LR {mi(row.snapPeakLongRunMiles)} · week {mi(row.snapPeakWeeklyMiles)}
                  {row.buildPreset ? ` · ${row.buildPreset.name}` : ""}
                  {row.taperPreset ? ` · ${row.taperPreset.name}` : ""}
                  {row.raceWeekPreset ? ` · ${row.raceWeekPreset.title}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/dashboard/presets/${row.id}`}
                  className="text-sm font-medium text-sky-700 hover:underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={deletingId === row.id}
                  onClick={() => void deletePreset(row.id, row.title)}
                  className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  {deletingId === row.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
