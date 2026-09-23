"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  name: string;
  workoutType: string;
  runSubType: string | null;
  description: string | null;
  notes: string | null;
  workBaseMiles: number | null;
  workPaceOffsetSecPerMile: number | null;
  warmupPaceOffsetSecPerMile: number | null;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
};

const TYPES = ["LongRun", "Easy", "Tempo", "Intervals"] as const;

export default function CatalogueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/training/catalogue/${id}`);
    const data = (await res.json()) as { item?: Item };
    setItem(data.item ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<Item>) {
    if (!id || !item) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/training/catalogue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { item?: Item };
      if (data.item) setItem(data.item);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !item || !window.confirm(`Delete “${item.name}”?`)) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/training/catalogue/${id}`, { method: "DELETE" });
      if (res.ok) window.location.href = "/dashboard/catalogue";
    } finally {
      setDeleting(false);
    }
  }

  if (!item) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/catalogue" className="text-sm text-sky-700 hover:underline">
          ← Workout catalogue
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{item.name}</h1>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={item.name}
            onChange={(e) => setItem({ ...item, name: e.target.value })}
            onBlur={() => void save({ name: item.name })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Type</span>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={item.workoutType}
            onChange={(e) => {
              const workoutType = e.target.value;
              setItem({ ...item, workoutType });
              void save({ workoutType });
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Run sub-type</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={item.runSubType ?? ""}
            onChange={(e) => setItem({ ...item, runSubType: e.target.value || null })}
            onBlur={() => void save({ runSubType: item.runSubType })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Description</span>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={4}
            value={item.description ?? ""}
            onChange={(e) => setItem({ ...item, description: e.target.value })}
            onBlur={() => void save({ description: item.description })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">Work base miles</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={item.workBaseMiles ?? ""}
              onChange={(e) =>
                setItem({
                  ...item,
                  workBaseMiles: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onBlur={() => void save({ workBaseMiles: item.workBaseMiles })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Work pace offset (sec/mi vs 5K)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={item.workPaceOffsetSecPerMile ?? ""}
              onChange={(e) =>
                setItem({
                  ...item,
                  workPaceOffsetSecPerMile: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onBlur={() => void save({ workPaceOffsetSecPerMile: item.workPaceOffsetSecPerMile })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Warmup pace offset (sec/mi)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={item.warmupPaceOffsetSecPerMile ?? ""}
              onChange={(e) =>
                setItem({
                  ...item,
                  warmupPaceOffsetSecPerMile: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onBlur={() => void save({ warmupPaceOffsetSecPerMile: item.warmupPaceOffsetSecPerMile })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Reps × meters</span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                className="w-full rounded border px-3 py-2"
                placeholder="Reps"
                value={item.workBaseReps ?? ""}
                onChange={(e) =>
                  setItem({
                    ...item,
                    workBaseReps: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                onBlur={() => void save({ workBaseReps: item.workBaseReps, workBaseRepMeters: item.workBaseRepMeters })}
              />
              <input
                type="number"
                className="w-full rounded border px-3 py-2"
                placeholder="Meters"
                value={item.workBaseRepMeters ?? ""}
                onChange={(e) =>
                  setItem({
                    ...item,
                    workBaseRepMeters: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                onBlur={() => void save({ workBaseReps: item.workBaseReps, workBaseRepMeters: item.workBaseRepMeters })}
              />
            </div>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-600">Notes</span>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={2}
            value={item.notes ?? ""}
            onChange={(e) => setItem({ ...item, notes: e.target.value })}
            onBlur={() => void save({ notes: item.notes })}
          />
        </label>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({})}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void remove()}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}
