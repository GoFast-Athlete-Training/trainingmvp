"use client";

import {
  PhaseRotationBolts,
  type PhaseRotationIds,
} from "@/components/training-manager/PhaseRotationBolts";

export type BuildFormState = {
  id: string;
  name: string;
  startLongRunMiles: string;
  peakLongRunMiles: string;
  maxWeeklyMiles: string;
  rotations: PhaseRotationIds;
};

export function BuildPhaseFields({
  value,
  onChange,
}: {
  value: BuildFormState;
  onChange: (v: BuildFormState) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-gray-600">Name</span>
        <input
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-gray-600">Starting long run (mi)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.startLongRunMiles}
            onChange={(e) => onChange({ ...value, startLongRunMiles: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Peak long run (mi)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.peakLongRunMiles}
            onChange={(e) => onChange({ ...value, peakLongRunMiles: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Peak weekly miles</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.maxWeeklyMiles}
            onChange={(e) => onChange({ ...value, maxWeeklyMiles: e.target.value })}
          />
        </label>
      </div>
      <PhaseRotationBolts
        value={value.rotations}
        onChange={(rotations) => onChange({ ...value, rotations })}
      />
    </div>
  );
}

export function buildFormFromApi(build: {
  id: string;
  name: string;
  startLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  maxWeeklyMiles: number | null;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
}): BuildFormState {
  return {
    id: build.id,
    name: build.name,
    startLongRunMiles: build.startLongRunMiles == null ? "" : String(build.startLongRunMiles),
    peakLongRunMiles: build.peakLongRunMiles == null ? "" : String(build.peakLongRunMiles),
    maxWeeklyMiles: build.maxWeeklyMiles == null ? "" : String(build.maxWeeklyMiles),
    rotations: {
      longRunConfigId: build.longRunConfigId ?? "",
      easyConfigId: build.easyConfigId ?? "",
      tempoConfigId: build.tempoConfigId ?? "",
      intervalsConfigId: build.intervalsConfigId ?? "",
    },
  };
}

export function buildPatchBody(value: BuildFormState) {
  const n = (s: string) => (s === "" ? null : Number(s));
  return {
    name: value.name.trim() || "Untitled",
    startLongRunMiles: n(value.startLongRunMiles),
    peakLongRunMiles: n(value.peakLongRunMiles),
    maxWeeklyMiles: n(value.maxWeeklyMiles) == null ? null : Math.round(n(value.maxWeeklyMiles)!),
    longRunConfigId: value.rotations.longRunConfigId || null,
    easyConfigId: value.rotations.easyConfigId || null,
    tempoConfigId: value.rotations.tempoConfigId || null,
    intervalsConfigId: value.rotations.intervalsConfigId || null,
  };
}
