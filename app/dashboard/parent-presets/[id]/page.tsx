"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { parseRaceWeekSlots, type RaceWeekSlot } from "@/lib/training/race-week-slots";
import { useCallback, useEffect, useState } from "react";

type ParentDetail = {
  id: string;
  title: string;
  buildPresetId: string;
  taperPresetId: string | null;
  raceWeekPresetId: string | null;
  peakWeeklyMiles: number | null;
  peakLongRunMiles: number | null;
  buildLongRunWeekends: number | null;
  raceWeekPreset?: {
    id: string;
    title: string;
    slots: unknown;
    shakeoutDaysPriorToRace: number;
  } | null;
};

export default function ParentPresetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [parent, setParent] = useState<ParentDetail | null>(null);
  const [taperPresets, setTaperPresets] = useState<Array<{ id: string; title: string }>>([]);
  const [raceWeekPresets, setRaceWeekPresets] = useState<Array<{ id: string; title: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setParentId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!parentId) return;
    const [parentRes, presetRes, raceRes] = await Promise.all([
      authFetch(`/api/training/plan-preset-parent/${parentId}`),
      authFetch("/api/training/plan-preset"),
      authFetch("/api/training/race-week-preset"),
    ]);
    const parentData = (await parentRes.json()) as { parent?: ParentDetail };
    const presetData = (await presetRes.json()) as { presets?: Array<{ id: string; title: string; longRunCycleWeeks?: number }> };
    const raceData = (await raceRes.json()) as { presets?: Array<{ id: string; title: string }> };
    setParent(parentData.parent ?? null);
    setTaperPresets(
      (presetData.presets ?? []).filter((p) => p.longRunCycleWeeks === 2),
    );
    setRaceWeekPresets(raceData.presets ?? []);
  }, [parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Record<string, unknown>) {
    if (!parentId) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/training/plan-preset-parent/${parentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { parent?: ParentDetail };
      if (data.parent) setParent(data.parent);
    } finally {
      setSaving(false);
    }
  }

  async function createTaperPreset() {
    const res = await authFetch("/api/training/taper-preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${parent?.title ?? "Program"} taper` }),
    });
    const data = (await res.json()) as { taperPreset?: { id: string; title: string } };
    if (data.taperPreset) {
      setTaperPresets((prev) => [...prev, data.taperPreset!]);
      await save({ taperPresetId: data.taperPreset.id });
    }
  }

  const slots: RaceWeekSlot[] = parent?.raceWeekPreset
    ? parseRaceWeekSlots(parent.raceWeekPreset.slots)
    : [];

  if (!parent) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/parent-presets" className="text-sm text-sky-700 hover:underline">
          ← Programs
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{parent.title}</h1>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Parent meta</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Peak weekly miles
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={parent.peakWeeklyMiles ?? ""}
              onChange={(e) =>
                setParent({
                  ...parent,
                  peakWeeklyMiles: e.target.value ? Number(e.target.value) : null,
                })
              }
              onBlur={() => void save({ peakWeeklyMiles: parent.peakWeeklyMiles })}
            />
          </label>
          <label className="text-sm">
            Peak Saturday (mi)
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={parent.peakLongRunMiles ?? ""}
              onChange={(e) =>
                setParent({
                  ...parent,
                  peakLongRunMiles: e.target.value ? Number(e.target.value) : null,
                })
              }
              onBlur={() => void save({ peakLongRunMiles: parent.peakLongRunMiles })}
            />
          </label>
          <label className="text-sm">
            Build LR weekends
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={parent.buildLongRunWeekends ?? ""}
              onChange={(e) =>
                setParent({
                  ...parent,
                  buildLongRunWeekends: e.target.value ? Number(e.target.value) : null,
                })
              }
              onBlur={() => void save({ buildLongRunWeekends: parent.buildLongRunWeekends })}
            />
          </label>
        </div>
        <p className="text-xs text-gray-500">Build preset: {parent.buildPresetId}</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Taper preset</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={parent.taperPresetId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setParent({ ...parent, taperPresetId: v });
              void save({ taperPresetId: v });
            }}
          >
            <option value="">— none —</option>
            {taperPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createTaperPreset()}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Create 14/12 taper preset
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Race week preset</h2>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={parent.raceWeekPresetId ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setParent({ ...parent, raceWeekPresetId: v });
            void save({ raceWeekPresetId: v });
          }}
        >
          <option value="">— none —</option>
          {raceWeekPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {slots.length > 0 ? (
          <ul className="text-sm text-gray-700">
            {slots.map((s) => (
              <li key={s.offsetFromRace}>
                {s.offsetFromRace >= 0 ? "+" : ""}
                {s.offsetFromRace}: {s.slotType}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/dashboard/race-week" className="text-sm text-sky-700 underline">
          Edit race week presets →
        </Link>
      </section>

      {saving ? <p className="text-sm text-gray-500">Saving…</p> : null}
    </div>
  );
}
