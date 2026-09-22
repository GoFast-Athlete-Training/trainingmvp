"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type PresetDetail = {
  id: string;
  title: string;
  slug: string;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
  longRunConfig?: {
    id: string;
    name: string;
    positions: Array<{ cyclePosition: number; catalogueWorkoutId: string | null }>;
  } | null;
};

type LrConfig = { id: string; name: string };

export default function PresetStubEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [lrConfigs, setLrConfigs] = useState<LrConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setPresetId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!presetId) return;
    const [presetRes, lrRes] = await Promise.all([
      authFetch(`/api/training/plan-preset/${presetId}`),
      authFetch("/api/training/long-run-config"),
    ]);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const lrData = (await lrRes.json()) as { configs?: LrConfig[] };
    setPreset(presetData.preset ?? null);
    setLrConfigs(lrData.configs ?? []);
  }, [presetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Record<string, unknown>) {
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

  if (!preset) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
          ← Build presets
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{preset.title}</h1>
        <p className="text-sm text-gray-500">{preset.slug}</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Meta (stub)</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Weekly miles</span>
          <input
            type="number"
            className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2"
            value={preset.minWeeklyMiles}
            onChange={(e) =>
              setPreset({ ...preset, minWeeklyMiles: Number(e.target.value) || 0 })
            }
            onBlur={() => void save({ minWeeklyMiles: preset.minWeeklyMiles })}
          />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Rotations (stub)</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Long run rotation</span>
          <select
            className="mt-1 w-full max-w-md rounded border border-gray-300 px-3 py-2"
            value={preset.longRunConfigId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setPreset({ ...preset, longRunConfigId: v });
              void save({ longRunConfigId: v });
            }}
          >
            <option value="">— none —</option>
            {lrConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {preset.longRunConfig?.positions?.length ? (
          <ul className="text-sm text-gray-700">
            {preset.longRunConfig.positions.map((p) => (
              <li key={p.cyclePosition}>
                Slot {p.cyclePosition + 1}: {p.catalogueWorkoutId ?? "no catalogue"}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-gray-500">
          easy / tempo / intervals config ids: {preset.easyConfigId ?? "—"} /{" "}
          {preset.tempoConfigId ?? "—"} / {preset.intervalsConfigId ?? "—"}
        </p>
      </section>

      {saving ? <p className="text-sm text-gray-500">Saving…</p> : null}
    </div>
  );
}
