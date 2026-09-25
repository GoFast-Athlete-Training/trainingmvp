"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import {
  CatalogueSlotCombobox,
  type CataloguePickerItem,
} from "@/components/training-manager/CatalogueSlotCombobox";
import { useCallback, useEffect, useMemo, useState } from "react";

type PositionRow = {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
};

export default function LongRunConfigEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const pathname = usePathname();
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [catalogue, setCatalogue] = useState<CataloguePickerItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setConfigId(p.id));
  }, [params]);

  const createHref = useMemo(() => {
    const returnTo = encodeURIComponent(pathname ?? "/dashboard/long-run-config");
    return `/dashboard/catalogue?new=1&type=LongRun&returnTo=${returnTo}`;
  }, [pathname]);

  const load = useCallback(async () => {
    if (!configId) return;
    const [configRes, catRes] = await Promise.all([
      authFetch(`/api/training/long-run-config/${configId}`),
      authFetch("/api/training/catalogue?workoutType=LongRun"),
    ]);
    const configData = (await configRes.json()) as {
      config?: { name: string; positions: PositionRow[] };
    };
    const catData = (await catRes.json()) as { items?: CataloguePickerItem[] };
    if (configData.config) {
      setName(configData.config.name);
      setPositions(
        [...configData.config.positions].sort((a, b) => a.cyclePosition - b.cyclePosition),
      );
    }
    setCatalogue(catData.items ?? []);
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
          Search catalogue workouts for each slot in order. Miles come from the build preset.
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
      <ol className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        {positions.map((pos, idx) => (
          <li key={pos.cyclePosition} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <p className="mb-2 text-sm font-medium text-gray-700">Slot {idx + 1}</p>
            <CatalogueSlotCombobox
              options={catalogue}
              value={pos.catalogueWorkoutId ?? ""}
              createHref={createHref}
              workoutTypeLabel="LongRun"
              onChange={(id) => {
                const next = [...positions];
                next[idx] = { ...pos, catalogueWorkoutId: id || null };
                setPositions(next);
              }}
            />
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
