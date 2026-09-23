"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import {
  PhaseRotationBolts,
  type PhaseRotationIds,
} from "@/components/training-manager/PhaseRotationBolts";
import { RaceWeekDaysEditor } from "@/components/training-manager/RaceWeekDaysEditor";
import { DOW_OPTIONS } from "@/lib/training/dow-options";
import { parseRaceWeekDays, type RaceWeekDaySlot } from "@/lib/training/race-week-days";
import { useCallback, useEffect, useState } from "react";

type WizardStep = "build" | "taper" | "raceWeek";

type PresetDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  buildPresetId: string | null;
  taperPresetId: string | null;
  raceWeekPresetId: string | null;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
  snapTaperWeek1TotalMiles: number | null;
  snapTaperWeek1LongRunMiles: number | null;
  snapTaperWeek2TotalMiles: number | null;
  snapTaperWeek2LongRunMiles: number | null;
  longRunConfigId?: string | null;
  easyConfigId?: string | null;
  tempoConfigId?: string | null;
  intervalsConfigId?: string | null;
  minWeeklyMiles?: number;
  maxWeeklyMiles?: number | null;
  baseLongRunPoolMiles?: number;
  peakLongRunPoolMiles?: number;
  tempoIdealDow?: number;
  intervalIdealDow?: number;
  longRunDefaultDow?: number;
  easyRunConfig?: unknown;
};

type BuildPhase = {
  id: string;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
  easyStandardMiles: number;
  easyMinMiles: number;
  easyPaceOffset: number;
  rotations: PhaseRotationIds;
};

type TaperPhase = {
  id: string;
  week1Total: string;
  week1Lr: string;
  week2Total: string;
  week2Lr: string;
  taperLongRunPoolMiles: string;
  rotations: PhaseRotationIds;
};

function mi(n: number | null) {
  return n == null ? "—" : `${n} mi`;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "taper", label: "Taper" },
  { id: "raceWeek", label: "Race week" },
];

function easyFromJson(raw: unknown): { standard: number; min: number; pace: number } {
  if (raw == null || typeof raw !== "object") return { standard: 6, min: 4, pace: 90 };
  const o = raw as Record<string, unknown>;
  return {
    standard: typeof o.standardMiles === "number" ? o.standardMiles : 6,
    min: typeof o.minMiles === "number" ? o.minMiles : 4,
    pace: typeof o.paceOffsetSecPerMile === "number" ? o.paceOffsetSecPerMile : 90,
  };
}

export default function PresetWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [step, setStep] = useState<WizardStep>("build");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [stepSaved, setStepSaved] = useState(false);

  const [build, setBuild] = useState<BuildPhase | null>(null);
  const [taper, setTaper] = useState<TaperPhase | null>(null);
  const [raceDays, setRaceDays] = useState<RaceWeekDaySlot[]>(() => parseRaceWeekDays(null));
  const [shakeoutConfigId, setShakeoutConfigId] = useState("");

  useEffect(() => {
    void params.then((p) => setPresetId(p.id));
  }, [params]);

  const patchPreset = useCallback(
    async (body: Record<string, unknown>) => {
      if (!presetId) return null;
      const res = await authFetch(`/api/training/plan-preset/${presetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { preset?: PresetDetail };
      if (data.preset) setPreset(data.preset);
      return data.preset ?? null;
    },
    [presetId],
  );

  const ensurePhaseLinks = useCallback(
    async (p: PresetDetail): Promise<PresetDetail> => {
      let current = p;
      if (!current.buildPresetId) {
        const res = await authFetch("/api/training/build-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Build" }),
        });
        const data = (await res.json()) as { build?: { id: string } };
        if (data.build?.id) {
          const updated = await patchPreset({ buildPresetId: data.build.id });
          if (updated) current = updated;
        }
      }
      if (!current.taperPresetId) {
        const res = await authFetch("/api/training/taper-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Taper" }),
        });
        const data = (await res.json()) as { taper?: { id: string } };
        if (data.taper?.id) {
          const updated = await patchPreset({ taperPresetId: data.taper.id });
          if (updated) current = updated;
        }
      }
      if (!current.raceWeekPresetId) {
        const res = await authFetch("/api/training/race-week-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Race week" }),
        });
        const data = (await res.json()) as { preset?: { id: string } };
        if (data.preset?.id) {
          const updated = await patchPreset({ raceWeekPresetId: data.preset.id });
          if (updated) current = updated;
        }
      }
      return current;
    },
    [patchPreset],
  );

  const loadBuild = useCallback(
    async (buildPresetId: string, planFallback?: PresetDetail) => {
      const res = await authFetch(`/api/training/build-preset/${buildPresetId}`);
      const data = (await res.json()) as {
        build?: {
          id: string;
          minWeeklyMiles: number;
          maxWeeklyMiles: number | null;
          baseLongRunPoolMiles: number;
          peakLongRunPoolMiles: number;
          taperLongRunPoolMiles: number;
          tempoIdealDow: number;
          intervalIdealDow: number;
          longRunDefaultDow: number;
          longRunConfigId: string | null;
          easyConfigId: string | null;
          tempoConfigId: string | null;
          intervalsConfigId: string | null;
          easyRunConfig: unknown;
        };
      };
      let b = data.build;
      if (!b) return;
      if (!b.longRunConfigId && planFallback?.longRunConfigId) {
        await authFetch(`/api/training/build-preset/${buildPresetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minWeeklyMiles: planFallback.minWeeklyMiles,
            maxWeeklyMiles: planFallback.maxWeeklyMiles,
            baseLongRunPoolMiles: planFallback.baseLongRunPoolMiles,
            peakLongRunPoolMiles: planFallback.peakLongRunPoolMiles,
            tempoIdealDow: planFallback.tempoIdealDow,
            intervalIdealDow: planFallback.intervalIdealDow,
            longRunDefaultDow: planFallback.longRunDefaultDow,
            longRunConfigId: planFallback.longRunConfigId,
            easyConfigId: planFallback.easyConfigId,
            tempoConfigId: planFallback.tempoConfigId,
            intervalsConfigId: planFallback.intervalsConfigId,
            easyRunConfig: planFallback.easyRunConfig,
          }),
        });
        const again = await authFetch(`/api/training/build-preset/${buildPresetId}`);
        const againData = (await again.json()) as { build?: typeof b };
        if (againData.build) b = againData.build;
      }
      const easy = easyFromJson(b.easyRunConfig);
      setBuild({
        id: b.id,
        minWeeklyMiles: b.minWeeklyMiles,
        maxWeeklyMiles: b.maxWeeklyMiles,
        baseLongRunPoolMiles: b.baseLongRunPoolMiles,
        peakLongRunPoolMiles: b.peakLongRunPoolMiles,
        taperLongRunPoolMiles: b.taperLongRunPoolMiles,
        tempoIdealDow: b.tempoIdealDow,
        intervalIdealDow: b.intervalIdealDow,
        longRunDefaultDow: b.longRunDefaultDow,
        easyStandardMiles: easy.standard,
        easyMinMiles: easy.min,
        easyPaceOffset: easy.pace,
        rotations: {
          longRunConfigId: b.longRunConfigId ?? planFallback?.longRunConfigId ?? "",
          easyConfigId: b.easyConfigId ?? "",
          tempoConfigId: b.tempoConfigId ?? "",
          intervalsConfigId: b.intervalsConfigId ?? "",
        },
      });
    },
    [],
  );

  const loadTaper = useCallback(async (taperPresetId: string) => {
    const res = await authFetch(`/api/training/taper-preset/${taperPresetId}`);
    const data = (await res.json()) as {
      taper?: {
        id: string;
        week1TotalMiles: number | null;
        week1LongRunMiles: number | null;
        week2TotalMiles: number | null;
        week2LongRunMiles: number | null;
        taperLongRunPoolMiles: number;
        longRunConfigId: string | null;
        easyConfigId: string | null;
        tempoConfigId: string | null;
        intervalsConfigId: string | null;
      };
    };
    const t = data.taper;
    if (!t) return;
    setTaper({
      id: t.id,
      week1Total: t.week1TotalMiles == null ? "" : String(t.week1TotalMiles),
      week1Lr: t.week1LongRunMiles == null ? "" : String(t.week1LongRunMiles),
      week2Total: t.week2TotalMiles == null ? "" : String(t.week2TotalMiles),
      week2Lr: t.week2LongRunMiles == null ? "" : String(t.week2LongRunMiles),
      taperLongRunPoolMiles: String(t.taperLongRunPoolMiles),
      rotations: {
        longRunConfigId: t.longRunConfigId ?? "",
        easyConfigId: t.easyConfigId ?? "",
        tempoConfigId: t.tempoConfigId ?? "",
        intervalsConfigId: t.intervalsConfigId ?? "",
      },
    });
  }, []);

  const loadRace = useCallback(async (raceWeekPresetId: string) => {
    const res = await authFetch(`/api/training/race-week-preset/${raceWeekPresetId}`);
    const data = (await res.json()) as {
      preset?: { slots: unknown; shakeoutRunConfigId: string | null };
    };
    if (data.preset) {
      setRaceDays(parseRaceWeekDays(data.preset.slots));
      setShakeoutConfigId(data.preset.shakeoutRunConfigId ?? "");
    }
  }, []);

  const load = useCallback(async () => {
    if (!presetId) return;
    const presetRes = await authFetch(`/api/training/plan-preset/${presetId}`);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail & Record<string, unknown> };
    let p = presetData.preset ?? null;
    if (!p) return;
    p = await ensurePhaseLinks(p);
    setPreset(p);
    setTitle(p.title);
    setDescription(p.description ?? "");
    if (p.buildPresetId) await loadBuild(p.buildPresetId, p);
    if (p.taperPresetId) await loadTaper(p.taperPresetId);
    if (p.raceWeekPresetId) await loadRace(p.raceWeekPresetId);
  }, [presetId, ensurePhaseLinks, loadBuild, loadTaper, loadRace]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta() {
    setSaving(true);
    try {
      await patchPreset({ title, description });
    } finally {
      setSaving(false);
    }
  }

  function n(v: string) {
    return v === "" ? null : Number(v);
  }

  async function saveBuildStep() {
    if (!build || !preset?.buildPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/build-preset/${build.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minWeeklyMiles: build.minWeeklyMiles,
          maxWeeklyMiles: build.maxWeeklyMiles,
          baseLongRunPoolMiles: Math.max(0, build.baseLongRunPoolMiles),
          peakLongRunPoolMiles: Math.max(0, build.peakLongRunPoolMiles),
          taperLongRunPoolMiles: Math.max(0, build.taperLongRunPoolMiles),
          tempoIdealDow: build.tempoIdealDow,
          intervalIdealDow: build.intervalIdealDow,
          longRunDefaultDow: build.longRunDefaultDow,
          longRunConfigId: build.rotations.longRunConfigId || null,
          easyConfigId: build.rotations.easyConfigId || null,
          tempoConfigId: build.rotations.tempoConfigId || null,
          intervalsConfigId: build.rotations.intervalsConfigId || null,
          easyRunConfig: {
            standardMiles: build.easyStandardMiles,
            minMiles: build.easyMinMiles,
            paceOffsetSecPerMile: build.easyPaceOffset,
            weeklyTargetBufferMiles: 0,
          },
        }),
      });
      await patchPreset({ buildPresetId: preset.buildPresetId });
      await load();
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function saveTaperStep() {
    if (!taper || !preset?.taperPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/taper-preset/${taper.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week1TotalMiles: n(taper.week1Total),
          week1LongRunMiles: n(taper.week1Lr),
          week2TotalMiles: n(taper.week2Total),
          week2LongRunMiles: n(taper.week2Lr),
          taperLongRunPoolMiles: n(taper.taperLongRunPoolMiles),
          longRunConfigId: taper.rotations.longRunConfigId || null,
          easyConfigId: taper.rotations.easyConfigId || null,
          tempoConfigId: taper.rotations.tempoConfigId || null,
          intervalsConfigId: taper.rotations.intervalsConfigId || null,
        }),
      });
      await patchPreset({ taperPresetId: preset.taperPresetId });
      await load();
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function saveRaceStep() {
    if (!preset?.raceWeekPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/race-week-preset/${preset.raceWeekPresetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: raceDays,
          shakeoutRunConfigId: shakeoutConfigId || null,
        }),
      });
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!preset || !build) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
        ← Plan presets
      </Link>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="flex shrink-0 flex-row gap-1 md:w-36 md:flex-col">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                step === s.id ? "bg-sky-700 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold">Preset</h2>
            <label className="block text-sm">
              <span className="text-gray-600">Name</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveMeta()}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Description</span>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void saveMeta()}
              />
            </label>
          </section>

          {step === "build" ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Build</h2>
                <p className="text-sm text-gray-600">Core volume + run-type rotations (Company HQ pattern).</p>
                <p className="mt-1 text-xs text-gray-500">
                  Snap LR {mi(preset.snapPeakLongRunMiles)} · week {mi(preset.snapPeakWeeklyMiles)}
                </p>
              </div>
              <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-600">Min weekly miles</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.minWeeklyMiles}
                    onChange={(e) => setBuild({ ...build, minWeeklyMiles: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Peak weekly miles</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.maxWeeklyMiles ?? ""}
                    onChange={(e) =>
                      setBuild({
                        ...build,
                        maxWeeklyMiles: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Base long-run pool</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.baseLongRunPoolMiles}
                    onChange={(e) => setBuild({ ...build, baseLongRunPoolMiles: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Peak long-run pool</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.peakLongRunPoolMiles}
                    onChange={(e) => setBuild({ ...build, peakLongRunPoolMiles: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Tempo day (DOW)</span>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.tempoIdealDow}
                    onChange={(e) => setBuild({ ...build, tempoIdealDow: Number(e.target.value) })}
                  >
                    {DOW_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Intervals day (DOW)</span>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.intervalIdealDow}
                    onChange={(e) => setBuild({ ...build, intervalIdealDow: Number(e.target.value) })}
                  >
                    {DOW_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Long run day (DOW)</span>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={build.longRunDefaultDow}
                    onChange={(e) => setBuild({ ...build, longRunDefaultDow: Number(e.target.value) })}
                  >
                    {DOW_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <PhaseRotationBolts
                value={build.rotations}
                onChange={(rotations) => setBuild({ ...build, rotations })}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveBuildStep()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : stepSaved ? "Saved" : "Save build"}
              </button>
            </section>
          ) : null}

          {step === "taper" && taper ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Taper</h2>
                <p className="text-sm text-gray-600">Taper miles + same rotation bolt pattern.</p>
              </div>
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-600">Week 1 total (mi)</span>
                  <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={taper.week1Total} onChange={(e) => setTaper({ ...taper, week1Total: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 1 long run (mi)</span>
                  <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={taper.week1Lr} onChange={(e) => setTaper({ ...taper, week1Lr: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 2 total (mi)</span>
                  <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={taper.week2Total} onChange={(e) => setTaper({ ...taper, week2Total: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 2 long run (mi)</span>
                  <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={taper.week2Lr} onChange={(e) => setTaper({ ...taper, week2Lr: e.target.value })} />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-gray-600">Taper long-run pool</span>
                  <input type="number" min={0} step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={taper.taperLongRunPoolMiles} onChange={(e) => setTaper({ ...taper, taperLongRunPoolMiles: e.target.value })} />
                </label>
              </div>
              <PhaseRotationBolts
                value={taper.rotations}
                onChange={(rotations) => setTaper({ ...taper, rotations })}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveTaperStep()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : stepSaved ? "Saved" : "Save taper"}
              </button>
            </section>
          ) : null}

          {step === "raceWeek" ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Race week</h2>
                <p className="text-sm text-gray-600">Monday–Friday slot types bolt to rotation configs.</p>
              </div>
              <RaceWeekDaysEditor
                days={raceDays}
                onChange={setRaceDays}
                shakeoutConfigId={shakeoutConfigId}
                onShakeoutChange={setShakeoutConfigId}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveRaceStep()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : stepSaved ? "Saved" : "Save race week"}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
