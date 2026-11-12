"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { PhaseRotationBolts } from "@/components/training-manager/PhaseRotationBolts";
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
  baseWeeklyMinMiles: number | null;
  baseWeeklyMaxMiles: number | null;
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

type PhaseEditorState = {
  id: string;
  name: string;
  longRunConfigId: string | null;
  intervalsConfigId: string | null;
  tempoConfigId: string | null;
  easyConfigId: string | null;
};

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
  const [baseWeeklyMinMiles, setBaseWeeklyMinMiles] = useState("");
  const [baseWeeklyMaxMiles, setBaseWeeklyMaxMiles] = useState("");
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
  const [editor, setEditor] = useState<PhaseEditorState | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

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
    setBaseWeeklyMinMiles(numStr(preset.baseWeeklyMinMiles));
    setBaseWeeklyMaxMiles(numStr(preset.baseWeeklyMaxMiles));
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
      baseWeeklyMinMiles:
        parseOptional(baseWeeklyMinMiles) == null ? null : Math.round(parseOptional(baseWeeklyMinMiles)!),
      baseWeeklyMaxMiles:
        parseOptional(baseWeeklyMaxMiles) == null ? null : Math.round(parseOptional(baseWeeklyMaxMiles)!),
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

  const refreshPhaseOptions = useCallback(async () => {
    const res = await authFetch("/api/training/phase-preset");
    const data = (await res.json()) as { phasePresets?: PhaseOption[] };
    setPhaseOptions(data.phasePresets ?? []);
  }, []);

  const openPhase = useCallback(async (id: string) => {
    setEditorMessage(null);
    const res = await authFetch(`/api/training/phase-preset/${id}`);
    const data = (await res.json()) as { phasePreset?: PhaseEditorState; error?: string };
    if (!res.ok || !data.phasePreset) {
      setEditorMessage(data.error || "Could not open that phase preset");
      return;
    }
    setEditor({
      id: data.phasePreset.id,
      name: data.phasePreset.name,
      longRunConfigId: data.phasePreset.longRunConfigId,
      intervalsConfigId: data.phasePreset.intervalsConfigId,
      tempoConfigId: data.phasePreset.tempoConfigId,
      easyConfigId: data.phasePreset.easyConfigId,
    });
  }, []);

  async function buildPhase() {
    setEditorMessage(null);
    const res = await authFetch("/api/training/phase-preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New phase preset" }),
    });
    const data = (await res.json()) as { phasePreset?: PhaseEditorState; error?: string };
    if (!data.phasePreset) {
      setEditorMessage(data.error || "Could not create the phase preset");
      return;
    }
    setEditor({
      id: data.phasePreset.id,
      name: data.phasePreset.name,
      longRunConfigId: data.phasePreset.longRunConfigId,
      intervalsConfigId: data.phasePreset.intervalsConfigId,
      tempoConfigId: data.phasePreset.tempoConfigId,
      easyConfigId: data.phasePreset.easyConfigId,
    });
    if (!res.ok) setEditorMessage(data.error || "Saved in Training Manage but prod sync failed");
    await refreshPhaseOptions();
  }

  async function savePhase() {
    if (!editor) return;
    setEditorSaving(true);
    setEditorMessage(null);
    try {
      const res = await authFetch(`/api/training/phase-preset/${editor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editor.name.trim() || "Phase",
          longRunConfigId: editor.longRunConfigId,
          intervalsConfigId: editor.intervalsConfigId,
          tempoConfigId: editor.tempoConfigId,
          easyConfigId: editor.easyConfigId,
        }),
      });
      const data = (await res.json()) as { phasePreset?: PhaseEditorState; error?: string };
      if (data.phasePreset) {
        setEditor({
          id: data.phasePreset.id,
          name: data.phasePreset.name,
          longRunConfigId: data.phasePreset.longRunConfigId,
          intervalsConfigId: data.phasePreset.intervalsConfigId,
          tempoConfigId: data.phasePreset.tempoConfigId,
          easyConfigId: data.phasePreset.easyConfigId,
        });
      }
      if (!res.ok) {
        setEditorMessage(data.error || "Phase preset save failed");
        return;
      }
      setEditorMessage("Phase preset saved");
      await refreshPhaseOptions();
    } finally {
      setEditorSaving(false);
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

  const usedBy = editor
    ? PHASE_FIELDS.filter((field) => pointers[field.key] === editor.id).map((field) => field.label)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
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
          Miles and phase pointers live here. The phase preset open on the right holds the four rotation slots.
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,34rem)]">
      <div className="space-y-4">
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
            Overall and base are a rough guide. Base to peak, taper, and race week are fixed totals.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Overall</h3>
          <p className="text-sm text-gray-600">A rough guide. A low athlete is not lifted up to the floor.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MilesField label="Weekly min" value={minWeeklyMiles} onChange={setMinWeeklyMiles} step="1" />
            <MilesField label="Weekly max" value={maxWeeklyMiles} onChange={setMaxWeeklyMiles} step="1" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Base</h3>
          <p className="text-sm text-gray-600">A rough guide for the weeks before the peak block.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MilesField label="Weekly min" value={baseWeeklyMinMiles} onChange={setBaseWeeklyMinMiles} step="1" />
            <MilesField label="Weekly max" value={baseWeeklyMaxMiles} onChange={setBaseWeeklyMaxMiles} step="1" />
            <MilesField label="Starting long run" value={entryLongRunMiles} onChange={setEntryLongRunMiles} />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-800">Base to peak</h3>
          <p className="text-sm text-gray-600">Fixed. Climbs from the starting long run to the peak long run.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <MilesField label="Peak long run" value={peakLongRunMiles} onChange={setPeakLongRunMiles} />
          </div>
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
              Pick a saved phase preset for each phase. The same one can fill every phase. Edit slots opens it on the right.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void buildPhase()}
            className="text-sm font-medium text-sky-700 hover:underline"
          >
            Build a phase preset
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PHASE_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <SearchCombobox
                label={field.label}
                options={options}
                value={pointers[field.key]}
                onChange={(id) => {
                  setPointers((current) => ({ ...current, [field.key]: id }));
                  if (id) void openPhase(id);
                }}
                placeholder="Search phase presets…"
                emptyLabel="Not linked"
              />
              <div className="flex gap-3 text-xs">
                {pointers[field.key] ? (
                  <>
                    <button
                      type="button"
                      className="font-medium text-sky-700 hover:underline"
                      onClick={() => void openPhase(pointers[field.key])}
                    >
                      {editor?.id === pointers[field.key] ? "Editing slots" : "Edit slots"}
                    </button>
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

      <aside className="space-y-3 xl:sticky xl:top-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Phase preset</h2>
          {editor ? (
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">Name</span>
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={editor.name}
                  onChange={(e) => setEditor((current) => (current ? { ...current, name: e.target.value } : current))}
                />
              </label>
              <p className="text-sm text-gray-600">
                {usedBy.length > 0
                  ? `Selected for ${usedBy.join(", ")}. Saving slots updates every phase that points here.`
                  : "Not selected on the left yet. Saving here updates this phase preset only."}
              </p>
              {editorMessage ? <p className="text-sm text-gray-700">{editorMessage}</p> : null}
              <button
                type="button"
                disabled={editorSaving || !editor.name.trim()}
                onClick={() => void savePhase()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editorSaving ? "Saving…" : "Save phase preset"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Choose Edit slots on a phase, or build a phase preset. Each slot picks one rotation from Run Type Config.
            </p>
          )}
        </div>
        {editor ? (
          <PhaseRotationBolts
            value={{
              longRunConfigId: editor.longRunConfigId ?? "",
              easyConfigId: editor.easyConfigId ?? "",
              tempoConfigId: editor.tempoConfigId ?? "",
              intervalsConfigId: editor.intervalsConfigId ?? "",
            }}
            onBeforeManageNavigate={() => savePhase()}
            onChange={(next) =>
              setEditor((current) =>
                current
                  ? {
                      ...current,
                      longRunConfigId: next.longRunConfigId || null,
                      easyConfigId: next.easyConfigId || null,
                      tempoConfigId: next.tempoConfigId || null,
                      intervalsConfigId: next.intervalsConfigId || null,
                    }
                  : current,
              )
            }
          />
        ) : null}
      </aside>
      </div>
    </div>
  );
}
