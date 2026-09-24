"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type CatalogueItem = { id: string; name: string; workoutType: string };

type PositionRow = {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
};

export default function LongRunConfigEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setConfigId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!configId) return;
    const [configRes, catRes] = await Promise.all([
      authFetch(`/api/training/long-run-config/${configId}`),
      authFetch("/api/training/catalogue"),
    ]);
    const configData = (await configRes.json()) as {
      config?: { name: string; positions: PositionRow[] };
    };
    const catData = (await catRes.json()) as { items?: CatalogueItem[] };
    if (configData.config) {
      setName(configData.config.name);
      setPositions(
        [...configData.config.positions].sort((a, b) => a.cyclePosition - b.cyclePosition),
      );
    }
    setCatalogue((catData.items ?? []).filter((i) => i.workoutType === "LongRun"));
  }, [configId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!configId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/long-run-config/${configId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          positions: positions.map((p) => ({
            cyclePosition: p.cyclePosition,
            catalogueWorkoutId: p.catalogueWorkoutId || null,
          })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!configId) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/long-run-config" className="text-sm text-sky-700 hover:underline">
        ← Run Type Config
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Long run rotation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ordered catalogue workouts for each week in the cycle. Miles come from the build preset, not pool
          percentages.
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-gray-600">Name</span>
        <input
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <ol className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        {positions.map((pos, idx) => (
          <li key={pos.cyclePosition} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-24 shrink-0 font-medium text-gray-700">Week {idx + 1}</span>
            <select
              className="min-w-[12rem] flex-1 rounded border px-3 py-2"
              value={pos.catalogueWorkoutId ?? ""}
              onChange={(e) => {
                const next = [...positions];
                next[idx] = {
                  ...pos,
                  catalogueWorkoutId: e.target.value || null,
                };
                setPositions(next);
              }}
            >
              <option value="">Select catalogue workout…</option>
              {catalogue.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
