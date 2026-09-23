export const RACE_WEEK_DAYS = [
  { day: "Monday", offsetFromRace: -6 },
  { day: "Tuesday", offsetFromRace: -5 },
  { day: "Wednesday", offsetFromRace: -4 },
  { day: "Thursday", offsetFromRace: -3 },
  { day: "Friday", offsetFromRace: -2 },
] as const;

export type RaceWeekDayName = (typeof RACE_WEEK_DAYS)[number]["day"];

export type RaceWeekDaySlot = {
  day: RaceWeekDayName;
  offsetFromRace: number;
  slotType: "Easy" | "Tempo" | "Intervals" | "Rest" | "Shakeout";
  easyConfigId?: string | null;
  tempoConfigId?: string | null;
  intervalsConfigId?: string | null;
};

export function defaultRaceWeekDays(): RaceWeekDaySlot[] {
  return RACE_WEEK_DAYS.map((d) => ({
    day: d.day,
    offsetFromRace: d.offsetFromRace,
    slotType: "Rest",
    easyConfigId: null,
    tempoConfigId: null,
    intervalsConfigId: null,
  }));
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

export function parseRaceWeekDays(raw: unknown): RaceWeekDaySlot[] {
  const defaults = defaultRaceWeekDays();
  if (!Array.isArray(raw)) return defaults;
  return defaults.map((day) => {
    const found = raw.find((item) => {
      if (item == null || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return row.day === day.day || row.offsetFromRace === day.offsetFromRace;
    }) as Record<string, unknown> | undefined;
    if (!found) return day;
    const slotType = found.slotType;
    const allowed = ["Easy", "Tempo", "Intervals", "Rest", "Shakeout"] as const;
    return {
      day: day.day,
      offsetFromRace: day.offsetFromRace,
      slotType: allowed.includes(slotType as (typeof allowed)[number])
        ? (slotType as RaceWeekDaySlot["slotType"])
        : "Rest",
      easyConfigId: strOrNull(found.easyConfigId),
      tempoConfigId: strOrNull(found.tempoConfigId),
      intervalsConfigId: strOrNull(found.intervalsConfigId),
    };
  });
}
