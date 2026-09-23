"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import type { PresetCoreMeta } from "@/lib/training/preset-core";
import { useCallback, useEffect, useState } from "react";

type PresetDetail = {
  id: string;
  title: string;
  slug: string;
  presetCore: PresetCoreMeta;
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

type WizardStep = "longRun" | "easy" | "tempo" | "intervals";

const STEPS: { id: WizardStep; title: string }[] = [
  { id: "longRun", title: "Long run rotation" },
  { id: "easy", title: "Easy rotation" },
  { id: "tempo", title: "Tempo rotation" },
  { id: "intervals", title: "Intervals rotation" },
];

export default function PresetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [lrConfigs, setLrConfigs] = useState<LrConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<WizardStep>("longRun");
  const [coreDraft, setCoreDraft] = useState<PresetCoreMeta | null>(null);

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
    const p = presetData.preset ?? null;
    setPreset(p);
    if (p) setCoreDraft(p.presetCore);
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
      if (data.preset) {
        setPreset(data.preset);
        setCoreDraft(data.preset.presetCore);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveCore() {
    if (!coreDraft) return;
    await save({
      presetCore: {
        longRunPeakMiles: coreDraft.longRunPeakMiles,
        weeklyVolumePeakMiles: coreDraft.weeklyVolumePeakMiles,
        totalRunsPerWeek: coreDraft.totalRunsPerWeek,
        totalQualitySessionsPerWeek: coreDraft.totalQualitySessionsPerWeek,
      },
    });
  }

  if (!preset || !coreDraft) {
    return <p className="text-gray-500">Loading…</p>;
  }

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
          ← Presets
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{preset.title}</h1>
        <p className="text-sm text-gray-500">{preset.slug}</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Preset core</h2>
        <p className="mt-1 text-xs text-gray-500">
          Five numbers athletes confirm on plan generate (next pass). Weekly average is calculated.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">Long-run peak (mi)</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={coreDraft.longRunPeakMiles ?? ""}
              onChange={(e) =>
                setCoreDraft({
                  ...coreDraft,
                  longRunPeakMiles: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onBlur={() => void saveCore()}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Weekly volume peak (mi)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={coreDraft.weeklyVolumePeakMiles}
              onChange={(e) =>
                setCoreDraft({
                  ...coreDraft,
                  weeklyVolumePeakMiles: Number(e.target.value) || 0,
                  weeklyAverageMiles: Math.round((Number(e.target.value) || 0) * 0.88),
                })
              }
              onBlur={() => void saveCore()}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Weekly average (calculated)</span>
            <input
              type="number"
              readOnly
              className="mt-1 w-full rounded border border-gray-200 bg-gray-50 px-3 py-2"
              value={coreDraft.weeklyAverageMiles}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Runs per week</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={coreDraft.totalRunsPerWeek}
              onChange={(e) =>
                setCoreDraft({
                  ...coreDraft,
                  totalRunsPerWeek: Number(e.target.value) || 0,
                })
              }
              onBlur={() => void saveCore()}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">Quality sessions per week (tempo + intervals)</span>
            <input
              type="number"
              className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2"
              value={coreDraft.totalQualitySessionsPerWeek}
              onChange={(e) =>
                setCoreDraft({
                  ...coreDraft,
                  totalQualitySessionsPerWeek: Number(e.target.value) || 0,
                })
              }
              onBlur={() => void saveCore()}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeStep === step.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            {step.title}
          </button>
        ))}
      </div>

      {activeStep === "longRun" ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="font-semibold">{STEPS[stepIndex]?.title}</h2>
          <label className="block text-sm">
            <span className="text-gray-600">Rotation</span>
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
          <Link
            href="/dashboard/long-run-config"
            className="text-sm text-sky-700 hover:underline"
          >
            Manage long run rotations →
          </Link>
          {preset.longRunConfig?.positions?.length ? (
            <ul className="text-sm text-gray-700">
              {preset.longRunConfig.positions.map((p) => (
                <li key={p.cyclePosition}>
                  Slot {p.cyclePosition + 1}: {p.catalogueWorkoutId ?? "no catalogue"}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {activeStep === "easy" ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Easy config: {preset.easyConfigId ?? "not linked"}
          </p>
          <p className="mt-2 text-xs text-gray-500">Full easy editor ships with rotation pages.</p>
        </section>
      ) : null}

      {activeStep === "tempo" ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Tempo config: {preset.tempoConfigId ?? "not linked"}
          </p>
        </section>
      ) : null}

      {activeStep === "intervals" ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Intervals config: {preset.intervalsConfigId ?? "not linked"}
          </p>
        </section>
      ) : null}

      <div className="flex justify-between">
        <button
          type="button"
          disabled={stepIndex <= 0}
          onClick={() => setActiveStep(STEPS[Math.max(0, stepIndex - 1)]!.id)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={stepIndex >= STEPS.length - 1}
          onClick={() => setActiveStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]!.id)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {saving ? <p className="text-sm text-gray-500">Saving…</p> : null}
    </div>
  );
}
