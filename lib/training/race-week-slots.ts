export type RaceWeekSlot = {
  offsetFromRace: number;
  slotType: "Easy" | "Tempo" | "Intervals" | "Rest" | "Shakeout" | "Race";
  easyConfigId?: string | null;
  tempoConfigId?: string | null;
  intervalsConfigId?: string | null;
};

/** Default marathon race week anchored on notional race day (offset 0). */
export function defaultRaceWeekSlots(): RaceWeekSlot[] {
  return [
    { offsetFromRace: -6, slotType: "Easy" },
    { offsetFromRace: -5, slotType: "Intervals" },
    { offsetFromRace: -4, slotType: "Easy" },
    { offsetFromRace: -3, slotType: "Rest" },
    { offsetFromRace: -2, slotType: "Shakeout" },
    { offsetFromRace: -1, slotType: "Rest" },
    { offsetFromRace: 0, slotType: "Race" },
  ];
}

export function parseRaceWeekSlots(raw: unknown): RaceWeekSlot[] {
  if (!Array.isArray(raw)) return defaultRaceWeekSlots();
  return raw.filter(
    (s): s is RaceWeekSlot =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as RaceWeekSlot).offsetFromRace === "number" &&
      typeof (s as RaceWeekSlot).slotType === "string",
  );
}
