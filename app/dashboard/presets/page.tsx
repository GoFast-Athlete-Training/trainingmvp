"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { presetListMetaParts } from "@/lib/training/preset-list-copy";
import { useCallback, useEffect, useState } from "react";

type PresetRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  targetDistanceLabel: string | null;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
  buildPreset: { name: string } | null;
  taperPreset: { name: string } | null;
  raceWeekPreset: { title: string } | null;
};

export default function PresetsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch("/api/training/plan-preset");
      const data = (await res.json().catch(() => ({}))) as {
        presets?: PresetRow[];
        error?: string;
        success?: boolean;
      };
      if (!res.ok || data.success === false) {
        setRows([]);
        setLoadError(data.error || `Could not load presets (${res.status})`);
        return;
      }
      setRows(data.presets ?? []);
    } catch (e) {
      setRows([]);
      setLoadError(e instanceof Error ? e.message : "Could not load presets");
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
            Full plan templates — core details plus build, taper, and race week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/presets/ingest"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Import presets
          </Link>
          <button
            type="button"
            disabled={creating}
            onClick={() => void buildPreset()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Opening…" : "Build preset"}
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No presets on prod yet. Build preset to add one.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {rows.map((row) => {
            const meta = presetListMetaParts(row);
            const staffDesc = row.description?.trim();
            return (
              <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                    {staffDesc || (
                      <span className="italic text-gray-400">No staff description yet</span>
                    )}
                  </p>
                  {meta.length > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">{meta.join(" · ")}</p>
                  ) : null}
                  {row.slug !== "untitled" ? (
                    <p className="mt-1 font-mono text-[10px] text-gray-400">{row.slug}</p>
                  ) : null}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
