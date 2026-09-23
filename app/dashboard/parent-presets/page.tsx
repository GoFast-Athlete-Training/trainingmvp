"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type ParentRow = {
  id: string;
  title: string;
  slug: string;
  buildPresetId: string;
  taperPresetId: string | null;
  raceWeekPresetId: string | null;
};

type BuildPreset = { id: string; title: string };

export default function ParentPresetsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [buildPresets, setBuildPresets] = useState<BuildPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [parentRes, buildRes] = await Promise.all([
        authFetch("/api/training/plan-preset-parent"),
        authFetch("/api/training/plan-preset"),
      ]);
      const parentData = (await parentRes.json()) as { parents?: ParentRow[] };
      const buildData = (await buildRes.json()) as { presets?: BuildPreset[] };
      setRows(parentData.parents ?? []);
      setBuildPresets(buildData.presets ?? []);
      if (buildData.presets?.[0]) setSelectedBuild(buildData.presets[0].id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createParent() {
    if (!selectedBuild) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/training/plan-preset-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildPresetId: selectedBuild }),
      });
      const data = (await res.json()) as { parent?: ParentRow };
      if (data.parent) setRows((prev) => [data.parent!, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Parent presets</h1>
        <p className="text-sm text-gray-600">Build + taper + race week rollup.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm">
          <span className="text-gray-600">Build preset</span>
          <select
            className="mt-1 block rounded border border-gray-300 px-3 py-2"
            value={selectedBuild}
            onChange={(e) => setSelectedBuild(e.target.value)}
          >
            {buildPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={creating || !selectedBuild}
          onClick={() => void createParent()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New parent preset"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/parent-presets/${row.id}`}
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-gray-500">
                  taper: {row.taperPresetId ? "linked" : "—"} · race week:{" "}
                  {row.raceWeekPresetId ? "linked" : "—"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
