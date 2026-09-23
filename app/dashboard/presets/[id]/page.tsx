"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type Option = { id: string; name?: string; title?: string };

type PresetDetail = {
  id: string;
  title: string;
  slug: string;
  buildConfigId: string | null;
  taperConfigId: string | null;
  raceWeekPresetId: string | null;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
  snapTaperWeek1TotalMiles: number | null;
  snapTaperWeek1LongRunMiles: number | null;
  snapTaperWeek2TotalMiles: number | null;
  snapTaperWeek2LongRunMiles: number | null;
};

function mi(n: number | null) {
  return n == null ? "—" : `${n} mi`;
}

export default function PresetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [builds, setBuilds] = useState<Option[]>([]);
  const [tapers, setTapers] = useState<Option[]>([]);
  const [raceWeeks, setRaceWeeks] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setPresetId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!presetId) return;
    const [presetRes, buildRes, taperRes, raceRes] = await Promise.all([
      authFetch(`/api/training/plan-preset/${presetId}`),
      authFetch("/api/training/build-config"),
      authFetch("/api/training/taper-config"),
      authFetch("/api/training/race-week-preset"),
    ]);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const buildData = (await buildRes.json()) as { builds?: Option[] };
    const taperData = (await taperRes.json()) as { tapers?: Option[] };
    const raceData = (await raceRes.json()) as { presets?: Array<{ id: string; title: string }> };
    setPreset(presetData.preset ?? null);
    setBuilds(buildData.builds ?? []);
    setTapers(taperData.tapers ?? []);
    setRaceWeeks((raceData.presets ?? []).map((p) => ({ id: p.id, title: p.title })));
  }, [presetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function link(patch: Record<string, string | null>) {
    if (!presetId) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { preset?: PresetDetail };
      if (data.preset) setPreset(data.preset);
    } finally {
      setSaving(false);
    }
  }

  if (!preset) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
          ← Presets
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{preset.title}</h1>
        <p className="text-sm text-gray-500">{preset.slug}</p>
        <p className="mt-2 text-sm text-gray-600">
          Miles below are a snap from the linked build and taper. Edit the numbers on those pages. Linking again copies the current miles.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Build snap</h2>
          <Link href="/dashboard/build" className="text-sm text-sky-700 hover:underline">
            Edit builds
          </Link>
        </div>
        <select
          className="w-full max-w-md rounded border px-3 py-2 text-sm"
          value={preset.buildConfigId ?? ""}
          onChange={(e) => void link({ buildConfigId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {builds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-700">
          Long-run peak {mi(preset.snapPeakLongRunMiles)} · Weekly peak {mi(preset.snapPeakWeeklyMiles)}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Taper snap</h2>
          <Link href="/dashboard/taper" className="text-sm text-sky-700 hover:underline">
            Edit tapers
          </Link>
        </div>
        <select
          className="w-full max-w-md rounded border px-3 py-2 text-sm"
          value={preset.taperConfigId ?? ""}
          onChange={(e) => void link({ taperConfigId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {tapers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-700">
          Week 1 {mi(preset.snapTaperWeek1TotalMiles)} total, {mi(preset.snapTaperWeek1LongRunMiles)} long run
        </p>
        <p className="text-sm text-gray-700">
          Week 2 {mi(preset.snapTaperWeek2TotalMiles)} total, {mi(preset.snapTaperWeek2LongRunMiles)} long run
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Race week</h2>
          <Link href="/dashboard/race-week" className="text-sm text-sky-700 hover:underline">
            Edit race weeks
          </Link>
        </div>
        <select
          className="w-full max-w-md rounded border px-3 py-2 text-sm"
          value={preset.raceWeekPresetId ?? ""}
          onChange={(e) => void link({ raceWeekPresetId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {raceWeeks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-600">Monday–Friday is edited on the race week, not here.</p>
      </section>

      {saving ? <p className="text-sm text-gray-500">Saving snap…</p> : null}
    </div>
  );
}
