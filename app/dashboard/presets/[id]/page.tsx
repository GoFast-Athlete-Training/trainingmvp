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
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type WizardStep = "core" | "build" | "taper" | "raceWeek";

type PresetDetail = {
  id: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
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
  { id: "core", label: "Core" },
  { id: "build", label: "Build" },
  { id: "taper", label: "Taper" },
  { id: "raceWeek", label: "Race week" },
];

const NEXT_STEP: Record<WizardStep, WizardStep | null> = {
  core: "build",
  build: "taper",
  taper: "raceWeek",
  raceWeek: null,
};

export default function PresetWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetDetail | null>(null);
  const [step, setStep] = useState<WizardStep>("core");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [targetDistanceLabel, setTargetDistanceLabel] = useState("");
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
      });
    } finally {
      setSaving(false);
    }
  }

  async function cleanupPublicDescription() {
    const draft = publicDescription.trim();
    if (!draft || !presetId) return;
    setAiBusy(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/develop-public-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json()) as { publicDescription?: string };
      if (data.publicDescription) {
        setPublicDescription(data.publicDescription);
        await patchPreset({ publicDescription: data.publicDescription });
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function linkPhase(phase: Exclude<WizardStep, "core">, id: string) {
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

  async function goNext() {
    if (step === "core") await saveMeta();
    else if (step === "build") await saveBuildStep();
    else if (step === "taper") await saveTaperStep();
    else if (step === "raceWeek") await saveRaceStep();
    const next = NEXT_STEP[step];
    if (next) setStep(next);
  }

  if (!preset) return <p className="text-gray-500">Loading…</p>;

  const showBuildPicker = !preset.buildPresetId || changeBuild;
  const showTaperPicker = !preset.taperPresetId || changeTaper;
  const showRacePicker = !preset.raceWeekPresetId || changeRace;
  const nextLabel = step === "raceWeek" ? "Save" : "Next";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/dashboard/presets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Plan presets
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title.trim() || "Training preset"}</h1>
        <p className="text-sm text-gray-500">Core → build → taper → race week</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="flex shrink-0 flex-row gap-1 md:w-40 md:flex-col md:space-y-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                step === s.id
                  ? "bg-sky-100 font-medium text-sky-900"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {step === "core" ? (
            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <h2 className="text-lg font-semibold">Core</h2>
                <p className="mt-1 text-sm text-gray-600">
                  This is the plan preset: how staff identify the template and what athletes read publicly.
                  Athletes choose how many weeks to train when they start a plan.
                </p>
              </div>
              <label className="block text-sm">
                <span className="text-gray-600">Name</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Target distance</span>
                <select
                  className="mt-1 w-full max-w-md rounded border px-3 py-2"
                  value={targetDistanceLabel}
                  onChange={(e) => setTargetDistanceLabel(e.target.value)}
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
                <span className="text-gray-600">Description (staff)</span>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div>
                <span className="text-sm text-gray-600">Public description (athlete-facing)</span>
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  rows={3}
                  value={publicDescription}
                  onChange={(e) => setPublicDescription(e.target.value)}
                  placeholder="Write what athletes should see, then clean up with AI if you want."
                />
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={aiBusy || !publicDescription.trim()}
                    onClick={() => void cleanupPublicDescription()}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {aiBusy ? "Cleaning up…" : "Clean up"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void goNext()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Next — Build"}
              </button>
            </section>
          ) : null}

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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveBuildStep()}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : stepSaved ? "Saved" : "Save build"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void goNext()}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : nextLabel}
                    </button>
                  </div>
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveTaperStep()}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : stepSaved ? "Saved" : "Save taper"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void goNext()}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : nextLabel}
                    </button>
                  </div>
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
                    onClick={() => void goNext()}
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
