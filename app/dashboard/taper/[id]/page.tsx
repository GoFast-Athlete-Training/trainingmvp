"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { CatalogueChecklist } from "@/components/training-manager/CatalogueChecklist";
import { useCallback, useEffect, useState } from "react";

type TaperDetail = {
  id: string;
  name: string;
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
  workouts: Array<{ catalogueWorkoutId: string }>;
};

export default function TaperEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [week1Total, setWeek1Total] = useState("");
  const [week1Lr, setWeek1Lr] = useState("");
  const [week2Total, setWeek2Total] = useState("");
  const [week2Lr, setWeek2Lr] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/taper-preset/${id}`);
    const data = (await res.json()) as { taper?: TaperDetail };
    if (!data.taper) return;
    const t = data.taper;
    setName(t.name);
    setWeek1Total(t.week1TotalMiles == null ? "" : String(t.week1TotalMiles));
    setWeek1Lr(t.week1LongRunMiles == null ? "" : String(t.week1LongRunMiles));
    setWeek2Total(t.week2TotalMiles == null ? "" : String(t.week2TotalMiles));
    setWeek2Lr(t.week2LongRunMiles == null ? "" : String(t.week2LongRunMiles));
    setSelected(t.workouts.map((w) => w.catalogueWorkoutId));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function n(v: string) {
    return v === "" ? null : Number(v);
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/taper-preset/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          week1TotalMiles: n(week1Total),
          week1LongRunMiles: n(week1Lr),
          week2TotalMiles: n(week2Total),
          week2LongRunMiles: n(week2Lr),
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
        <Link href="/dashboard/taper" className="text-sm text-sky-700 hover:underline">
          ← Tapers
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Taper</h1>
        <p className="text-sm text-gray-600">These miles mutate here. A preset copies them when you link this taper.</p>
      </div>
      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-gray-600">Name</span>
          <input className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 1 total miles</span>
          <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={week1Total} onChange={(e) => setWeek1Total(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 1 long-run miles</span>
          <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={week1Lr} onChange={(e) => setWeek1Lr(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 2 total miles</span>
          <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={week2Total} onChange={(e) => setWeek2Total(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 2 long-run miles</span>
          <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={week2Lr} onChange={(e) => setWeek2Lr(e.target.value)} />
        </label>
      </section>
      <CatalogueChecklist selected={selected} onChange={setSelected} />
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save taper"}
      </button>
    </div>
  );
}
