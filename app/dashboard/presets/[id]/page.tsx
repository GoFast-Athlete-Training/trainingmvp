"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { SearchCombobox } from "@/components/training-manager/SearchCombobox";
import { formatPeakMileageSummary } from "@/lib/training/preset-list-copy";
import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";
import {
  prodSyncMessageFromBody,
  type SaveSyncStatus,
} from "@/lib/training/save-sync-feedback";
import PresetPatchCsvDialog from "@/components/training-manager/PresetPatchCsvDialog";
import PresetValidateLlmDialog from "@/components/training-manager/PresetValidateLlmDialog";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function SaveSyncBanner({ status }: { status: SaveSyncStatus }) {
  if (status.state === "idle") return null;
  if (status.state === "saving") {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        Saving and syncing to prod…
      </div>
    );
  }
  if (status.state === "synced") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
        Saved and synced to prod
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {status.message}
    </div>
  );
}

type PhasePointer = { id: string; name: string } | null;

type PresetDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  paceNudgeSecPerMile: number;
  entryLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  baseStartLongRunMiles: number | null;
  baseEndLongRunMiles: number | null;
  baseWeeklyMinMiles: number | null;
  baseWeeklyMaxMiles: number | null;
  peakWeeklyVolumeMiles: number | null;
  taperWeek1TotalMiles: number | null;
  taperWeek1LongRunMiles: number | null;
  taperWeek2TotalMiles: number | null;
  taperWeek2LongRunMiles: number | null;
  raceWeekMiles: number | null;
  baseBuildPhasePresetId: string | null;
  buildToPeakPhasePresetId: string | null;
  taperPhasePresetId: string | null;
  raceWeekPhasePresetId: string | null;
  baseBuildPhasePreset: PhasePointer;
  buildToPeakPhasePreset: PhasePointer;
  taperPhasePreset: PhasePointer;
  raceWeekPhasePreset: PhasePointer;
};

type PhaseOption = { id: string; name: string };

const PHASE_FIELDS = [
  { key: "baseBuildPhasePresetId", label: "Base build" },
  { key: "buildToPeakPhasePresetId", label: "Build to peak" },
  { key: "taperPhasePresetId", label: "Taper" },
  { key: "raceWeekPhasePresetId", label: "Race week" },
] as const;

function numStr(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function parseOptional(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function MilesField({
  label,
  value,
  onChange,
  step = "0.1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        className="mt-1 w-full rounded border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function PhaseMileageFields({
  help,
  weeklyMin,
  weeklyMax,
  startLongRun,
  peakLongRun,
  onWeeklyMin,
  onWeeklyMax,
  onStartLongRun,
  onPeakLongRun,
}: {
  help: string;
  weeklyMin: string;
  weeklyMax: string;
  startLongRun: string;
  peakLongRun: string;
  onWeeklyMin: (value: string) => void;
  onWeeklyMax: (value: string) => void;
  onStartLongRun: (value: string) => void;
  onPeakLongRun: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">{help}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MilesField label="Weekly min" value={weeklyMin} onChange={onWeeklyMin} step="1" />
        <MilesField label="Weekly max" value={weeklyMax} onChange={onWeeklyMax} step="1" />
        <MilesField label="Starting long run" value={startLongRun} onChange={onStartLongRun} />
        <MilesField label="Peak long run" value={peakLongRun} onChange={onPeakLongRun} />
      </div>
    </div>
  );
}

export default function PresetPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [presetId, setPresetId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [targetDistanceLabel, setTargetDistanceLabel] = useState("");
  const [minWeeklyMiles, setMinWeeklyMiles] = useState("45");
  const [maxWeeklyMiles, setMaxWeeklyMiles] = useState("55");
  const [paceNudgeSecPerMile, setPaceNudgeSecPerMile] = useState("0");
  const [entryLongRunMiles, setEntryLongRunMiles] = useState("");
  const [peakLongRunMiles, setPeakLongRunMiles] = useState("");
  const [baseStartLongRunMiles, setBaseStartLongRunMiles] = useState("");
  const [baseEndLongRunMiles, setBaseEndLongRunMiles] = useState("");
  const [baseWeeklyMinMiles, setBaseWeeklyMinMiles] = useState("");
  const [baseWeeklyMaxMiles, setBaseWeeklyMaxMiles] = useState("");
  const [peakWeeklyVolumeMiles, setPeakWeeklyVolumeMiles] = useState("");
  const [taperWeek1TotalMiles, setTaperWeek1TotalMiles] = useState("");
  const [taperWeek1LongRunMiles, setTaperWeek1LongRunMiles] = useState("");
  const [taperWeek2TotalMiles, setTaperWeek2TotalMiles] = useState("");
  const [taperWeek2LongRunMiles, setTaperWeek2LongRunMiles] = useState("");
  const [raceWeekMiles, setRaceWeekMiles] = useState("");
  const [pointers, setPointers] = useState<Record<(typeof PHASE_FIELDS)[number]["key"], string>>({
    baseBuildPhasePresetId: "",
    buildToPeakPhasePresetId: "",
    taperPhasePresetId: "",
    raceWeekPhasePresetId: "",
  });
  const [phaseOptions, setPhaseOptions] = useState<PhaseOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SaveSyncStatus>({ state: "idle" });
  const [aiBusy, setAiBusy] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [patchOpen, setPatchOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isDraft = presetId === "new";
  const isPersisted = Boolean(presetId && presetId !== "new");

  useEffect(() => {
    void params.then((p) => setPresetId(p.id));
  }, [params]);

  const applyPreset = useCallback((preset: PresetDetail) => {
    setSlug(preset.slug ?? "");
    setTitle(preset.title);
    setDescription(preset.description ?? "");
    setPublicDescription(preset.publicDescription ?? "");
    setTargetDistanceLabel(preset.targetDistanceLabel ?? "");
    setMinWeeklyMiles(String(preset.minWeeklyMiles ?? 45));
    setMaxWeeklyMiles(numStr(preset.maxWeeklyMiles));
    setPaceNudgeSecPerMile(String(preset.paceNudgeSecPerMile ?? 0));
    setEntryLongRunMiles(numStr(preset.entryLongRunMiles));
    setPeakLongRunMiles(numStr(preset.peakLongRunMiles));
    setBaseStartLongRunMiles(numStr(preset.baseStartLongRunMiles));
    setBaseEndLongRunMiles(
      numStr(preset.baseEndLongRunMiles ?? preset.entryLongRunMiles),
    );
    setBaseWeeklyMinMiles(numStr(preset.baseWeeklyMinMiles));
    setBaseWeeklyMaxMiles(numStr(preset.baseWeeklyMaxMiles));
    setPeakWeeklyVolumeMiles(numStr(preset.peakWeeklyVolumeMiles));
    setTaperWeek1TotalMiles(numStr(preset.taperWeek1TotalMiles));
    setTaperWeek1LongRunMiles(numStr(preset.taperWeek1LongRunMiles));
    setTaperWeek2TotalMiles(numStr(preset.taperWeek2TotalMiles));
    setTaperWeek2LongRunMiles(numStr(preset.taperWeek2LongRunMiles));
    setRaceWeekMiles(numStr(preset.raceWeekMiles));
    setPointers({
      baseBuildPhasePresetId: preset.baseBuildPhasePresetId ?? "",
      buildToPeakPhasePresetId: preset.buildToPeakPhasePresetId ?? "",
      taperPhasePresetId: preset.taperPhasePresetId ?? "",
      raceWeekPhasePresetId: preset.raceWeekPhasePresetId ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    if (!presetId || presetId === "new") return;
    const [presetRes, phaseRes] = await Promise.all([
      authFetch(`/api/training/plan-preset/${presetId}`),
      authFetch("/api/training/phase-preset"),
    ]);
    const presetData = (await presetRes.json()) as { preset?: PresetDetail };
    const phaseData = (await phaseRes.json()) as { phasePresets?: PhaseOption[] };
    setPhaseOptions(phaseData.phasePresets ?? []);
    if (presetData.preset) applyPreset(presetData.preset);
    setLoaded(true);
  }, [presetId, applyPreset]);

  useEffect(() => {
    if (!presetId) return;
    if (presetId === "new") {
      setLoaded(true);
      void authFetch("/api/training/phase-preset")
        .then((r) => r.json())
        .then((data: { phasePresets?: PhaseOption[] }) => setPhaseOptions(data.phasePresets ?? []));
      return;
    }
    void load();
  }, [presetId, load]);

  function saveBody() {
    const min = Math.round(Number(minWeeklyMiles) || 40);
    const max = parseOptional(maxWeeklyMiles);
    const nudge = Math.round(Number(paceNudgeSecPerMile));
    return {
      title: title.trim(),
      description,
      publicDescription,
      targetDistanceLabel: targetDistanceLabel || null,
      minWeeklyMiles: min,
      maxWeeklyMiles: max == null ? null : Math.round(max),
      paceNudgeSecPerMile: Number.isFinite(nudge) ? Math.max(-180, Math.min(180, nudge)) : 0,
      entryLongRunMiles: parseOptional(entryLongRunMiles),
      peakLongRunMiles: parseOptional(peakLongRunMiles),
      baseStartLongRunMiles: parseOptional(baseStartLongRunMiles),
      baseEndLongRunMiles: parseOptional(baseEndLongRunMiles),
      baseWeeklyMinMiles:
        parseOptional(baseWeeklyMinMiles) == null ? null : Math.round(parseOptional(baseWeeklyMinMiles)!),
      baseWeeklyMaxMiles:
        parseOptional(baseWeeklyMaxMiles) == null ? null : Math.round(parseOptional(baseWeeklyMaxMiles)!),
      peakWeeklyVolumeMiles:
        parseOptional(peakWeeklyVolumeMiles) == null
          ? null
          : Math.round(parseOptional(peakWeeklyVolumeMiles)!),
      taperWeek1TotalMiles: parseOptional(taperWeek1TotalMiles),
      taperWeek1LongRunMiles: parseOptional(taperWeek1LongRunMiles),
      taperWeek2TotalMiles: parseOptional(taperWeek2TotalMiles),
      taperWeek2LongRunMiles: parseOptional(taperWeek2LongRunMiles),
      raceWeekMiles: parseOptional(raceWeekMiles),
      baseBuildPhasePresetId: pointers.baseBuildPhasePresetId || null,
      buildToPeakPhasePresetId: pointers.buildToPeakPhasePresetId || null,
      taperPhasePresetId: pointers.taperPhasePresetId || null,
      raceWeekPhasePresetId: pointers.raceWeekPhasePresetId || null,
    };
  }

  async function save() {
    const body = saveBody();
    if (!body.title) {
      setSyncStatus({ state: "error", message: "Name is required before saving." });
      return;
    }
    setSaving(true);
    setSyncStatus({ state: "saving" });
    try {
      let id = presetId;
      if (!id || id === "new") {
        const created = await authFetch("/api/training/plan-preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: body.title }),
        });
        const createdData = (await created.json()) as { preset?: PresetDetail; error?: string };
        if (!created.ok || !createdData.preset?.id) {
          setSyncStatus({
            state: "error",
            message: createdData.error || prodSyncMessageFromBody(createdData) || `Create failed (${created.status})`,
          });
          return;
        }
        id = createdData.preset.id;
        setPresetId(id);
        router.replace(`/dashboard/presets/${id}`);
      }

      const res = await authFetch(`/api/training/plan-preset/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { preset?: PresetDetail; error?: string };
      if (!res.ok || !data.preset) {
        setSyncStatus({
          state: "error",
          message: data.error || prodSyncMessageFromBody(data) || `Save failed (${res.status})`,
        });
        return;
      }
      applyPreset(data.preset);
      setSyncStatus({ state: "synced" });
      window.setTimeout(() => setSyncStatus({ state: "idle" }), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function openLlmCheck() {
    if (!presetId || presetId === "new") return;
    setLlmLoading(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/validate-packet`);
      const data = (await res.json()) as { promptText?: string; error?: string };
      if (!res.ok || !data.promptText) {
        window.alert(data.error || `Could not build check packet (${res.status})`);
        return;
      }
      setLlmPrompt(data.promptText);
      setLlmOpen(true);
    } finally {
      setLlmLoading(false);
    }
  }

  async function cleanupPublicDescription() {
    const draft = publicDescription.trim();
    if (!draft || !presetId || presetId === "new") return;
    setAiBusy(true);
    try {
      const res = await authFetch(`/api/training/plan-preset/${presetId}/develop-public-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json()) as { publicDescription?: string };
      if (data.publicDescription) setPublicDescription(data.publicDescription);
    } finally {
      setAiBusy(false);
    }
  }

  if (!loaded && !isDraft) return <p className="text-gray-500">Loading…</p>;

  const options = phaseOptions.map((row) => ({ id: row.id, label: row.name }));
  const peakSummary = formatPeakMileageSummary(
    parseOptional(peakLongRunMiles),
    parseOptional(maxWeeklyMiles) == null ? null : Math.round(parseOptional(maxWeeklyMiles)!),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/dashboard/presets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Plan presets
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title.trim() || "Training preset"}</h1>
            <p className="text-sm text-gray-500">{peakSummary}</p>
          </div>
          {isPersisted ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={llmLoading}
                onClick={() => void openLlmCheck()}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              >
                {llmLoading ? "Loading…" : "Check with LLM"}
              </button>
              <button
                type="button"
                onClick={() => setPatchOpen(true)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Patch from CSV
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-gray-600">
          Miles live here. Each phase selects a phase preset. Open that preset to set its rotations.
        </p>
        <SaveSyncBanner status={syncStatus} />
      </div>

      <PresetValidateLlmDialog open={llmOpen} onClose={() => setLlmOpen(false)} promptText={llmPrompt} />
      {isPersisted && presetId ? (
        <PresetPatchCsvDialog
          open={patchOpen}
          onClose={() => setPatchOpen(false)}
          presetId={presetId}
          onApplied={() => void load()}
        />
      ) : null}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Preset</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {slug && !isDraft ? (
          <p className="text-xs text-gray-500">
            Slug: <span className="font-mono text-gray-700">{slug}</span>
          </p>
        ) : null}
        <label className="block text-sm">
          <span className="text-gray-600">Pace nudge (sec/mile)</span>
          <input
            type="number"
            step={1}
            className="mt-1 w-full max-w-xs rounded border px-3 py-2"
            value={paceNudgeSecPerMile}
            onChange={(e) => setPaceNudgeSecPerMile(e.target.value)}
          />
          <span className="mt-1 block text-xs text-gray-500">
            Added on every workout after the catalogue offset. Negative is faster. Leave at 0 for the current MVP.
          </span>
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
          />
          {isPersisted ? (
            <button
              type="button"
              disabled={aiBusy || !publicDescription.trim()}
              onClick={() => void cleanupPublicDescription()}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {aiBusy ? "Cleaning up…" : "Clean up"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold">Mileage</h2>
          <p className="mt-1 text-sm text-gray-600">
            Base is a rough guide. Base to peak is the band the athlete picks inside, plus a peak volume the peak block
            ramps to. Taper and race week are fixed totals. A low athlete is not lifted to the floor.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Base</h3>
          <PhaseMileageFields
            help="A rough guide for the weeks before the peak block."
            weeklyMin={baseWeeklyMinMiles}
            weeklyMax={baseWeeklyMaxMiles}
            startLongRun={baseStartLongRunMiles}
            peakLongRun={baseEndLongRunMiles}
            onWeeklyMin={setBaseWeeklyMinMiles}
            onWeeklyMax={setBaseWeeklyMaxMiles}
            onStartLongRun={setBaseStartLongRunMiles}
            onPeakLongRun={setBaseEndLongRunMiles}
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Base to peak</h3>
          <PhaseMileageFields
            help="Weekly min and max are the band the athlete picks inside. The long run climbs from the start to the peak."
            weeklyMin={minWeeklyMiles}
            weeklyMax={maxWeeklyMiles}
            startLongRun={entryLongRunMiles}
            peakLongRun={peakLongRunMiles}
            onWeeklyMin={setMinWeeklyMiles}
            onWeeklyMax={setMaxWeeklyMiles}
            onStartLongRun={setEntryLongRunMiles}
            onPeakLongRun={setPeakLongRunMiles}
          />
          <MilesField
            label="Peak volume"
            value={peakWeeklyVolumeMiles}
            onChange={setPeakWeeklyVolumeMiles}
            step="1"
          />
          <p className="text-sm text-gray-600">
            Override for the peak block. The plan stays in the band until then, then ramps here even when this is above the weekly max.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Taper</h3>
          <p className="text-sm text-gray-600">Fixed. Two weeks, each with a total and a long run.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MilesField label="Week 1 total" value={taperWeek1TotalMiles} onChange={setTaperWeek1TotalMiles} />
            <MilesField label="Week 1 long run" value={taperWeek1LongRunMiles} onChange={setTaperWeek1LongRunMiles} />
            <MilesField label="Week 2 total" value={taperWeek2TotalMiles} onChange={setTaperWeek2TotalMiles} />
            <MilesField label="Week 2 long run" value={taperWeek2LongRunMiles} onChange={setTaperWeek2LongRunMiles} />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Race week</h3>
          <p className="text-sm text-gray-600">One mileage. No long run. The shakeout is a workout, not a mile box.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MilesField label="Race week mileage" value={raceWeekMiles} onChange={setRaceWeekMiles} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Phases</h2>
            <p className="mt-1 text-sm text-gray-600">
              Select a phase preset for each phase. The same one can fill every phase.
            </p>
          </div>
          <Link href="/dashboard/phase-presets" className="text-sm font-medium text-sky-700 hover:underline">
            Build a phase preset
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PHASE_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <SearchCombobox
                label={field.label}
                options={options}
                value={pointers[field.key]}
                onChange={(id) => setPointers((current) => ({ ...current, [field.key]: id }))}
                placeholder="Search phase presets…"
                emptyLabel="Not linked"
              />
              <div className="flex gap-3 text-xs">
                {pointers[field.key] ? (
                  <>
                    <Link
                      href={`/dashboard/phase-presets/${pointers[field.key]}`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      Open phase preset
                    </Link>
                    <button
                      type="button"
                      className="text-gray-500 hover:underline"
                      onClick={() => setPointers((current) => ({ ...current, [field.key]: "" }))}
                    >
                      Clear
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={saving || !title.trim()}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save preset"}
      </button>
    </div>
  );
}
