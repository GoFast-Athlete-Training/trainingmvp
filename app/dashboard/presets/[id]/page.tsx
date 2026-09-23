"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type Option = { id: string; name?: string; title?: string };

type PresetDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coachIntent: string | null;
  buildPresetId: string | null;
  taperPresetId: string | null;
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coachIntent, setCoachIntent] = useState("");
  const [builds, setBuilds] = useState<Option[]>([]);
  const [tapers, setTapers] = useState<Option[]>([]);
  const [raceWeeks, setRaceWeeks] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  useEffect(() => {
    void params.then((p) => setPresetId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!presetId) return;
    const [presetRes, buildRes, taperRes, raceRes] = await Promise.all([
      authFetch(`/api/training/plan-preset/${presetId}`),
      authFetch("/api/training/build-preset"),
      authFetch("/api/training/taper-preset"),
      authFetch("/api/training/race-week-preset"),
    ]);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const buildData = (await buildRes.json()) as { builds?: Option[] };
    const taperData = (await taperRes.json()) as { tapers?: Option[] };
    const raceData = (await raceRes.json()) as { presets?: Array<{ id: string; title: string }> };
    const p = presetData.preset ?? null;
    setPreset(p);
    if (p) {
      setTitle(p.title);
      setDescription(p.description ?? "");
      setCoachIntent(p.coachIntent ?? "");
    }
    setBuilds(buildData.builds ?? []);
    setTapers(taperData.tapers ?? []);
    setRaceWeeks((raceData.presets ?? []).map((r) => ({ id: r.id, title: r.title })));
  }, [presetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    if (!presetId) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { preset?: PresetDetail };
      if (data.preset) setPreset(data.preset);
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta() {
    await patch({ title, description, coachIntent: coachIntent.trim() || null });
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
  }

  if (!preset) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
          ← Plan presets
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{preset.title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          To finish this plan preset, define three things: a build preset, a taper preset, and a race week preset.
          Linking copies mileage snaps onto this row.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Preset</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Title</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Description</span>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveMeta()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : metaSaved ? "Saved" : "Save preset"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Optional — persona / coach intent</h2>
        <p className="text-xs text-gray-500">Side quest only. Helps fill meta; not required for the three phase links.</p>
        <textarea
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          rows={3}
          value={coachIntent}
          onChange={(e) => setCoachIntent(e.target.value)}
          placeholder="Coach intent…"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1 — Build preset</h2>
          <Link href="/dashboard/build" className="text-sm text-sky-700 hover:underline">
            Manage build presets
          </Link>
        </div>
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={preset.buildPresetId ?? ""}
          onChange={(e) => void patch({ buildPresetId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {builds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-700">
          Snap: long-run peak {mi(preset.snapPeakLongRunMiles)} · weekly peak {mi(preset.snapPeakWeeklyMiles)}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2 — Taper preset</h2>
          <Link href="/dashboard/taper" className="text-sm text-sky-700 hover:underline">
            Manage taper presets
          </Link>
        </div>
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={preset.taperPresetId ?? ""}
          onChange={(e) => void patch({ taperPresetId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {tapers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-700">
          Snap week 1: {mi(preset.snapTaperWeek1TotalMiles)} total, {mi(preset.snapTaperWeek1LongRunMiles)} long run
        </p>
        <p className="text-sm text-gray-700">
          Snap week 2: {mi(preset.snapTaperWeek2TotalMiles)} total, {mi(preset.snapTaperWeek2LongRunMiles)} long run
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">3 — Race week preset</h2>
          <Link href="/dashboard/race-week" className="text-sm text-sky-700 hover:underline">
            Manage race weeks
          </Link>
        </div>
        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={preset.raceWeekPresetId ?? ""}
          onChange={(e) => void patch({ raceWeekPresetId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {raceWeeks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-600">Monday–Friday routine is edited on the race week preset.</p>
      </section>

      {saving ? <p className="text-sm text-gray-500">Saving…</p> : null}
    </div>
  );
}
