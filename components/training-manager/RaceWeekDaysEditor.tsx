"use client";

import type { RaceWeekDaySlot } from "@/lib/training/race-week-days";

const SLOT_TYPES = ["Rest", "Easy", "Tempo", "Intervals", "Shakeout"] as const;

export function RaceWeekDaysEditor({
  days,
  onChange,
  catalogue,
}: {
  days: RaceWeekDaySlot[];
  onChange: (days: RaceWeekDaySlot[]) => void;
  catalogue: Array<{ id: string; name: string; workoutType: string }>;
}) {
  return (
    <ul className="space-y-3">
      {days.map((day, idx) => (
        <li
          key={day.day}
          className="grid gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[8rem_1fr_1fr]"
        >
          <p className="font-medium">{day.day}</p>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={day.slotType}
            onChange={(e) => {
              const next = [...days];
              next[idx] = { ...day, slotType: e.target.value as RaceWeekDaySlot["slotType"] };
              onChange(next);
            }}
          >
            {SLOT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={day.catalogueWorkoutId ?? ""}
            onChange={(e) => {
              const next = [...days];
              next[idx] = { ...day, catalogueWorkoutId: e.target.value || null };
              onChange(next);
            }}
          >
            <option value="">No catalogue workout</option>
            {catalogue.map((item) => (
              <option key={item.id} value={item.id}>
                {item.workoutType}: {item.name}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}
