"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { CatalogueChecklist } from "@/components/training-manager/CatalogueChecklist";
import { useCallback, useEffect, useState } from "react";

type BuildDetail = {
  id: string;
  name: string;
  peakLongRunMiles: number | null;
  peakWeeklyMiles: number | null;
  workouts: Array<{ catalogueWorkoutId: string }>;
};

export default function BuildEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [peakLong, setPeakLong] = useState("");
  const [peakWeekly, setPeakWeekly] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/build-config/${id}`);
    const data = (await res.json()) as { build?: BuildDetail };
    if (!data.build) return;
    setName(data.build.name);
    setPeakLong(data.build.peakLongRunMiles == null ? "" : String(data.build.peakLongRunMiles));
    setPeakWeekly(data.build.peakWeeklyMiles == null ? "" : String(data.build.peakWeeklyMiles));
    setSelected(data.build.workouts.map((w) => w.catalogueWorkoutId));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/build-config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          peakLongRunMiles: peakLong === "" ? null : Number(peakLong),
          peakWeeklyMiles: peakWeekly === "" ? null : Number(peakWeekly),
          catalogueWorkoutIds: selected,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/build" className="text-sm text-sky-700 hover:underline">
          ← Builds
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Build</h1>
        <p className="text-sm text-gray-600">Miles and catalogue workouts mutate here. Linked presets keep their snap.</p>
      </div>
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">Long-run peak (mi)</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded border px-3 py-2"
              value={peakLong}
              onChange={(e) => setPeakLong(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Weekly volume peak (mi)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={peakWeekly}
              onChange={(e) => setPeakWeekly(e.target.value)}
            />
          </label>
        </div>
      </section>
      <CatalogueChecklist selected={selected} onChange={setSelected} />
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save build"}
      </button>
    </div>
  );
}
