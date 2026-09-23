"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { CatalogueChecklist } from "@/components/training-manager/CatalogueChecklist";
import { RaceWeekDaysEditor } from "@/components/training-manager/RaceWeekDaysEditor";
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
  const [saving, setSaving] = useState(false);
  const [stepSaved, setStepSaved] = useState(false);

  const [peakLong, setPeakLong] = useState("");
  const [peakWeekly, setPeakWeekly] = useState("");
  const [buildCatalogue, setBuildCatalogue] = useState<string[]>([]);

  const [week1Total, setWeek1Total] = useState("");
  const [week1Lr, setWeek1Lr] = useState("");
  const [week2Total, setWeek2Total] = useState("");
  const [week2Lr, setWeek2Lr] = useState("");
  const [taperCatalogue, setTaperCatalogue] = useState<string[]>([]);

  const [raceDays, setRaceDays] = useState<RaceWeekDaySlot[]>(() => parseRaceWeekDays(null));
  const [catalogue, setCatalogue] = useState<Array<{ id: string; name: string; workoutType: string }>>([]);

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

  const loadBuildStep = useCallback(async (buildPresetId: string) => {
    const res = await authFetch(`/api/training/build-preset/${buildPresetId}`);
    const data = (await res.json()) as {
      build?: {
        peakLongRunMiles: number | null;
        peakWeeklyMiles: number | null;
        workouts: Array<{ catalogueWorkoutId: string }>;
      };
    };
    if (!data.build) return;
    setPeakLong(data.build.peakLongRunMiles == null ? "" : String(data.build.peakLongRunMiles));
    setPeakWeekly(data.build.peakWeeklyMiles == null ? "" : String(data.build.peakWeeklyMiles));
    setBuildCatalogue(data.build.workouts.map((w) => w.catalogueWorkoutId));
  }, []);

  const loadTaperStep = useCallback(async (taperPresetId: string) => {
    const res = await authFetch(`/api/training/taper-preset/${taperPresetId}`);
    const data = (await res.json()) as {
      taper?: {
        week1TotalMiles: number | null;
        week1LongRunMiles: number | null;
        week2TotalMiles: number | null;
        week2LongRunMiles: number | null;
        workouts: Array<{ catalogueWorkoutId: string }>;
      };
    };
    if (!data.taper) return;
    const t = data.taper;
    setWeek1Total(t.week1TotalMiles == null ? "" : String(t.week1TotalMiles));
    setWeek1Lr(t.week1LongRunMiles == null ? "" : String(t.week1LongRunMiles));
    setWeek2Total(t.week2TotalMiles == null ? "" : String(t.week2TotalMiles));
    setWeek2Lr(t.week2LongRunMiles == null ? "" : String(t.week2LongRunMiles));
    setTaperCatalogue(t.workouts.map((w) => w.catalogueWorkoutId));
  }, []);

  const loadRaceStep = useCallback(async (raceWeekPresetId: string) => {
    const res = await authFetch(`/api/training/race-week-preset/${raceWeekPresetId}`);
    const data = (await res.json()) as { preset?: { slots: unknown } };
    if (data.preset) setRaceDays(parseRaceWeekDays(data.preset.slots));
  }, []);

  const load = useCallback(async () => {
    if (!presetId) return;
    const [presetRes, catRes] = await Promise.all([
      authFetch(`/api/training/plan-preset/${presetId}`),
      authFetch("/api/training/catalogue"),
    ]);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const catData = (await catRes.json()) as { items?: Array<{ id: string; name: string; workoutType: string }> };
    setCatalogue(catData.items ?? []);
    let p = presetData.preset ?? null;
    if (!p) return;
    p = await ensurePhaseLinks(p);
    setPreset(p);
    setTitle(p.title);
    setDescription(p.description ?? "");
    if (p.buildPresetId) await loadBuildStep(p.buildPresetId);
    if (p.taperPresetId) await loadTaperStep(p.taperPresetId);
    if (p.raceWeekPresetId) await loadRaceStep(p.raceWeekPresetId);
  }, [presetId, ensurePhaseLinks, loadBuildStep, loadTaperStep, loadRaceStep]);

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
    if (!preset?.buildPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/build-preset/${preset.buildPresetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peakLongRunMiles: n(peakLong),
          peakWeeklyMiles: n(peakWeekly),
          catalogueWorkoutIds: buildCatalogue,
        }),
      });
      await patchPreset({ buildPresetId: preset.buildPresetId });
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function saveTaperStep() {
    if (!preset?.taperPresetId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/taper-preset/${preset.taperPresetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week1TotalMiles: n(week1Total),
          week1LongRunMiles: n(week1Lr),
          week2TotalMiles: n(week2Total),
          week2LongRunMiles: n(week2Lr),
          catalogueWorkoutIds: taperCatalogue,
        }),
      });
      await patchPreset({ taperPresetId: preset.taperPresetId });
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
        body: JSON.stringify({ slots: raceDays }),
      });
      setStepSaved(true);
      setTimeout(() => setStepSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!preset) return <p className="text-gray-500">Loading…</p>;

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
                <p className="text-sm text-gray-600">Set miles and bolt catalogue workouts for the build phase.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Plan snap: LR {mi(preset.snapPeakLongRunMiles)} · week {mi(preset.snapPeakWeeklyMiles)}
                </p>
              </div>
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-600">Long-run peak (mi)</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={peakLong}
                    onChange={(e) => setPeakLong(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Weekly volume peak (mi)</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={peakWeekly}
                    onChange={(e) => setPeakWeekly(e.target.value)}
                  />
                </label>
              </div>
              <CatalogueChecklist selected={buildCatalogue} onChange={setBuildCatalogue} />
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

          {step === "taper" ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Taper</h2>
                <p className="text-sm text-gray-600">Two taper weeks — totals, long runs, optional workouts.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Snap w1 {mi(preset.snapTaperWeek1TotalMiles)} / LR {mi(preset.snapTaperWeek1LongRunMiles)} · w2{" "}
                  {mi(preset.snapTaperWeek2TotalMiles)} / LR {mi(preset.snapTaperWeek2LongRunMiles)}
                </p>
              </div>
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-600">Week 1 total (mi)</span>
                  <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={week1Total} onChange={(e) => setWeek1Total(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 1 long run (mi)</span>
                  <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={week1Lr} onChange={(e) => setWeek1Lr(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 2 total (mi)</span>
                  <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={week2Total} onChange={(e) => setWeek2Total(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Week 2 long run (mi)</span>
                  <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={week2Lr} onChange={(e) => setWeek2Lr(e.target.value)} />
                </label>
              </div>
              <CatalogueChecklist selected={taperCatalogue} onChange={setTaperCatalogue} />
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
                <p className="text-sm text-gray-600">Monday–Friday routine. Saturday and race day stay outside this.</p>
              </div>
              <RaceWeekDaysEditor days={raceDays} onChange={setRaceDays} catalogue={catalogue} />
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
