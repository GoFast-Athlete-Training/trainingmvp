"use client";

import { PhaseWeekChrome } from "@/components/training-manager/PhaseWeekChrome";
import { TaperWeekSlotsEditor } from "@/components/training-manager/TaperWeekSlotsEditor";
import {
  phaseWeekRowsFromLegacyTaper,
  taperLegacyScalarsFromWeekRows,
  type PhaseWeekRow,
} from "@/lib/training/phase-week-pins";
import {
  defaultTaperWeekSlots,
  parseTaperWeekSlots,
  type TaperWeekSlot,
} from "@/lib/training/taper-week-slots";

export type TaperFormState = {
  id: string;
  name: string;
  weeks: PhaseWeekRow[];
  slots: TaperWeekSlot[];
};

export function TaperPhaseFields({
  value,
  onChange,
}: {
  value: TaperFormState;
  onChange: (v: TaperFormState) => void;
}) {
  return (
    <div className="space-y-8">
      <PhaseWeekChrome
        name={value.name}
        onNameChange={(name) => onChange({ ...value, name })}
        weeks={value.weeks}
        onWeeksChange={(weeks) => onChange({ ...value, weeks })}
        weekCount={2}
      />
      <section>
        <h3 className="text-sm font-semibold text-gray-900">Taper day slots (optional)</h3>
        <TaperWeekSlotsEditor
          slots={value.slots}
          onChange={(slots) => onChange({ ...value, slots })}
        />
      </section>
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
  weekPins?: unknown;
  slots?: unknown;
}): TaperFormState {
  const parsedSlots = parseTaperWeekSlots(taper.slots);
  return {
    id: taper.id,
    name: taper.name,
    weeks: phaseWeekRowsFromLegacyTaper(taper),
    slots: parsedSlots.length > 0 ? parsedSlots : defaultTaperWeekSlots(),
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
    slots: value.slots.filter(
      (s) =>
        s.catalogueWorkoutId ||
        (s.prescribedMiles != null && s.prescribedMiles > 0) ||
        s.runName.trim() !== "Easy",
    ),
    longRunConfigId: null,
    easyConfigId: null,
    tempoConfigId: null,
    intervalsConfigId: null,
  };
}
