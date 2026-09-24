"use client";

import {
  PhaseRotationBolts,
  type PhaseRotationIds,
} from "@/components/training-manager/PhaseRotationBolts";

export type TaperFormState = {
  id: string;
  name: string;
  week1Total: string;
  week1Lr: string;
  week2Total: string;
  week2Lr: string;
  rotations: PhaseRotationIds;
};

export function TaperPhaseFields({
  value,
  onChange,
}: {
  value: TaperFormState;
  onChange: (v: TaperFormState) => void;
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
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-gray-600">Week 1 total (mi)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.week1Total}
            onChange={(e) => onChange({ ...value, week1Total: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 1 long run (mi)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.week1Lr}
            onChange={(e) => onChange({ ...value, week1Lr: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 2 total (mi)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.week2Total}
            onChange={(e) => onChange({ ...value, week2Total: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Week 2 long run (mi)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value.week2Lr}
            onChange={(e) => onChange({ ...value, week2Lr: e.target.value })}
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

export function taperFormFromApi(taper: {
  id: string;
  name: string;
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
}): TaperFormState {
  return {
    id: taper.id,
    name: taper.name,
    week1Total: taper.week1TotalMiles == null ? "" : String(taper.week1TotalMiles),
    week1Lr: taper.week1LongRunMiles == null ? "" : String(taper.week1LongRunMiles),
    week2Total: taper.week2TotalMiles == null ? "" : String(taper.week2TotalMiles),
    week2Lr: taper.week2LongRunMiles == null ? "" : String(taper.week2LongRunMiles),
    rotations: {
      longRunConfigId: taper.longRunConfigId ?? "",
      easyConfigId: taper.easyConfigId ?? "",
      tempoConfigId: taper.tempoConfigId ?? "",
      intervalsConfigId: taper.intervalsConfigId ?? "",
    },
  };
}

export function taperPatchBody(value: TaperFormState) {
  const n = (s: string) => (s === "" ? null : Number(s));
  return {
    name: value.name.trim() || "Untitled",
    week1TotalMiles: n(value.week1Total),
    week1LongRunMiles: n(value.week1Lr),
    week2TotalMiles: n(value.week2Total),
    week2LongRunMiles: n(value.week2Lr),
    longRunConfigId: value.rotations.longRunConfigId || null,
    easyConfigId: value.rotations.easyConfigId || null,
    tempoConfigId: value.rotations.tempoConfigId || null,
    intervalsConfigId: value.rotations.intervalsConfigId || null,
  };
}
