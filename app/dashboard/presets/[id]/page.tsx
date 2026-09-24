"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import {
  BuildPhaseFields,
  buildFormFromApi,
  buildPatchBody,
  type BuildFormState,
} from "@/components/training-manager/BuildPhaseFields";
import { PhaseChooseOrBuild } from "@/components/training-manager/PhaseChooseOrBuild";
import { RaceWeekDaysEditor } from "@/components/training-manager/RaceWeekDaysEditor";
import {
  TaperPhaseFields,
  taperFormFromApi,
  taperPatchBody,
  type TaperFormState,
} from "@/components/training-manager/TaperPhaseFields";
import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";
import { parseRaceWeekDays, type RaceWeekDaySlot } from "@/lib/training/race-week-days";
import { useCallback, useEffect, useState } from "react";

type WizardStep = "build" | "taper" | "raceWeek";

type PresetDetail = {
  id: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  planDurationWeeks: number | null;
  buildPresetId: string | null;
  taperPresetId: string | null;
  raceWeekPresetId: string | null;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
};

function mi(n: number | null) {
  return n == null ? "—" : `${n} mi`;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "taper", label: "Taper" },
  { id: "raceWeek", label: "Race week" },
];

export default function PresetWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [step, setStep] = useState<WizardStep>("build");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [targetDistanceLabel, setTargetDistanceLabel] = useState("");
  const [planDurationWeeks, setPlanDurationWeeks] = useState("");
  const [saving, setSaving] = useState(false);
  const [stepSaved, setStepSaved] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [buildForm, setBuildForm] = useState<BuildFormState | null>(null);
  const [taperForm, setTaperForm] = useState<TaperFormState | null>(null);
  const [raceDays, setRaceDays] = useState<RaceWeekDaySlot[]>(() => parseRaceWeekDays(null));
  const [shakeoutConfigId, setShakeoutConfigId] = useState("");

  const [changeBuild, setChangeBuild] = useState(false);
  const [changeTaper, setChangeTaper] = useState(false);
  const [changeRace, setChangeRace] = useState(false);

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

  const loadBuild = useCallback(async (buildPresetId: string) => {
    const res = await authFetch(`/api/training/build-preset/${buildPresetId}`);
    const data = (await res.json()) as { build?: Parameters<typeof buildFormFromApi>[0] };
    if (data.build) setBuildForm(buildFormFromApi(data.build));
  }, []);

  const loadTaper = useCallback(async (taperPresetId: string) => {
    const res = await authFetch(`/api/training/taper-preset/${taperPresetId}`);
    const data = (await res.json()) as { taper?: Parameters<typeof taperFormFromApi>[0] };
    if (data.taper) setTaperForm(taperFormFromApi(data.taper));
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
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const p = presetData.preset ?? null;
    if (!p) return;
    setPreset(p);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setPublicDescription(p.publicDescription ?? "");
    setTargetDistanceLabel(p.targetDistanceLabel ?? "");
    setPlanDurationWeeks(p.planDurationWeeks == null ? "" : String(p.planDurationWeeks));
    if (p.buildPresetId) await loadBuild(p.buildPresetId);
    else setBuildForm(null);
    if (p.taperPresetId) await loadTaper(p.taperPresetId);
    else setTaperForm(null);
    if (p.raceWeekPresetId) await loadRace(p.raceWeekPresetId);
  }, [presetId, loadBuild, loadTaper, loadRace]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta() {
    setSaving(true);
    try {
      await patchPreset({
        title,
        description,
        publicDescription,
        targetDistanceLabel: targetDistanceLabel || null,
        planDurationWeeks:
          planDurationWeeks === "" ? null : Math.max(1, Math.round(Number(planDurationWeeks))),
      });
    } finally {
      setSaving(false);
    }
  }

  async function developPublicDescription() {
    if (!presetId) return;
    setAiBusy(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/develop-public-description`, {
        method: "POST",
      });
      const data = (await res.json()) as { publicDescription?: string; error?: string };
      if (data.publicDescription) {
        setPublicDescription(data.publicDescription);
        await patchPreset({ publicDescription: data.publicDescription });
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function linkPhase(phase: WizardStep, id: string) {
    const key =
      phase === "build"
        ? "buildPresetId"
        : phase === "taper"
          ? "taperPresetId"
          : "raceWeekPresetId";
    await patchPreset({ [key]: id });
    if (phase === "build") {
      setChangeBuild(false);
      await loadBuild(id);
    } else if (phase === "taper") {
      setChangeTaper(false);
      await loadTaper(id);
    } else {
      setChangeRace(false);
      await loadRace(id);
    }
    await load();
  }

  async function saveBuildStep() {
    if (!buildForm || !preset?.buildPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/build-preset/${buildForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody(buildForm)),
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
    if (!taperForm || !preset?.taperPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/taper-preset/${taperForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taperPatchBody(taperForm)),
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
        body: JSON.stringify({ slots: raceDays, shakeoutRunConfigId: shakeoutConfigId || null }),
      });
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!preset) return <p className="text-gray-500">Loading…</p>;

  const showBuildPicker = !preset.buildPresetId || changeBuild;
  const showTaperPicker = !preset.taperPresetId || changeTaper;
  const showRacePicker = !preset.raceWeekPresetId || changeRace;

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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-gray-600">Target distance</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={targetDistanceLabel}
                  onChange={(e) => {
                    setTargetDistanceLabel(e.target.value);
                    void patchPreset({ targetDistanceLabel: e.target.value || null });
                  }}
                >
                  <option value="">Any distance</option>
                  {TARGET_DISTANCE_OPTIONS.filter(Boolean).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Plan length (weeks)</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={planDurationWeeks}
                  onChange={(e) => setPlanDurationWeeks(e.target.value)}
                  onBlur={() => void saveMeta()}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600">Description (staff)</span>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void saveMeta()}
              />
            </label>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Public description (athlete-facing)</span>
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void developPublicDescription()}
                  className="text-sm font-medium text-sky-700 hover:underline disabled:opacity-50"
                >
                  {aiBusy ? "Drafting…" : "Develop public description"}
                </button>
              </div>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={publicDescription}
                onChange={(e) => setPublicDescription(e.target.value)}
                onBlur={() => void saveMeta()}
              />
            </div>
          </section>

          {step === "build" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Build</h2>
                  <p className="text-xs text-gray-500">
                    Snap LR {mi(preset.snapPeakLongRunMiles)} · week {mi(preset.snapPeakWeeklyMiles)}
                  </p>
                </div>
                {preset.buildPresetId && !changeBuild ? (
                  <button
                    type="button"
                    className="text-sm text-sky-700 hover:underline"
                    onClick={() => setChangeBuild(true)}
                  >
                    Change build
                  </button>
                ) : null}
              </div>
              {showBuildPicker ? (
                <PhaseChooseOrBuild
                  phase="build"
                  linkedId={preset.buildPresetId}
                  onLinked={(id) => void linkPhase("build", id)}
                />
              ) : null}
              {buildForm && !showBuildPicker ? (
                <>
                  <BuildPhaseFields value={buildForm} onChange={setBuildForm} />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveBuildStep()}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : stepSaved ? "Saved" : "Save build"}
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {step === "taper" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Taper</h2>
                {preset.taperPresetId && !changeTaper ? (
                  <button
                    type="button"
                    className="text-sm text-sky-700 hover:underline"
                    onClick={() => setChangeTaper(true)}
                  >
                    Change taper
                  </button>
                ) : null}
              </div>
              {showTaperPicker ? (
                <PhaseChooseOrBuild
                  phase="taper"
                  linkedId={preset.taperPresetId}
                  onLinked={(id) => void linkPhase("taper", id)}
                />
              ) : null}
              {taperForm && !showTaperPicker ? (
                <>
                  <TaperPhaseFields value={taperForm} onChange={setTaperForm} />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveTaperStep()}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : stepSaved ? "Saved" : "Save taper"}
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {step === "raceWeek" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Race week</h2>
                {preset.raceWeekPresetId && !changeRace ? (
                  <button
                    type="button"
                    className="text-sm text-sky-700 hover:underline"
                    onClick={() => setChangeRace(true)}
                  >
                    Change race week
                  </button>
                ) : null}
              </div>
              {showRacePicker ? (
                <PhaseChooseOrBuild
                  phase="raceWeek"
                  linkedId={preset.raceWeekPresetId}
                  onLinked={(id) => void linkPhase("raceWeek", id)}
                />
              ) : null}
              {preset.raceWeekPresetId && !showRacePicker ? (
                <>
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
                </>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
