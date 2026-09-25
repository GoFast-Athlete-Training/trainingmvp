"use client";

import { PhaseWeekChrome } from "@/components/training-manager/PhaseWeekChrome";
import {
  phaseWeekRowsFromLegacyTaper,
  taperLegacyScalarsFromWeekRows,
  type PhaseWeekRow,
} from "@/lib/training/phase-week-pins";

export type TaperFormState = {
  id: string;
  name: string;
  weeks: PhaseWeekRow[];
};

export function TaperPhaseFields({
  value,
  onChange,
}: {
  value: TaperFormState;
  onChange: (v: TaperFormState) => void;
}) {
  return (
    <PhaseWeekChrome
      name={value.name}
      onNameChange={(name) => onChange({ ...value, name })}
      weeks={value.weeks}
      onWeeksChange={(weeks) => onChange({ ...value, weeks })}
    />
  );
}

export function taperFormFromApi(taper: {
  id: string;
  name: string;
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
  weekPins?: unknown;
}): TaperFormState {
  return {
    id: taper.id,
    name: taper.name,
    weeks: phaseWeekRowsFromLegacyTaper(taper),
  };
}

export function taperPatchBody(value: TaperFormState) {
  const legacy = taperLegacyScalarsFromWeekRows(value.weeks);
  return {
    name: value.name.trim() || "Untitled",
    week1TotalMiles: legacy.week1TotalMiles,
    week1LongRunMiles: legacy.week1LongRunMiles,
    week2TotalMiles: legacy.week2TotalMiles,
    week2LongRunMiles: legacy.week2LongRunMiles,
    weekPins: legacy.weekPins,
    longRunConfigId: null,
    easyConfigId: null,
    tempoConfigId: null,
    intervalsConfigId: null,
  };
}
