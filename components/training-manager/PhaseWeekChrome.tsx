"use client";

import { authFetch } from "@/components/AppProviders";
import {
  PHASE_WEEK_LABELS,
  type PhaseWeekPin,
  type PhaseWeekPinWorkoutType,
  type PhaseWeekRow,
} from "@/lib/training/phase-week-pins";
import { useEffect, useState } from "react";

type CatalogueRow = { id: string; name: string; workoutType: string };

const PIN_TYPES: PhaseWeekPinWorkoutType[] = ["Tempo", "LongRun", "Intervals"];

export function PhaseWeekChrome({
  name,
  onNameChange,
  nameLabel = "Name",
  weeks,
  onWeeksChange,
  raceWeekMeta,
}: {
  name: string;
  onNameChange: (name: string) => void;
  nameLabel?: string;
  weeks: PhaseWeekRow[];
  onWeeksChange: (weeks: PhaseWeekRow[]) => void;
  raceWeekMeta?: {
    shakeoutConfigId: string;
    onShakeoutChange: (id: string) => void;
    shakeoutDaysPrior: number;
    onShakeoutDaysPriorChange: (n: number) => void;
  };
}) {
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [shakeouts, setShakeouts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void authFetch("/api/training/catalogue")
      .then((r) => r.json())
      .then((data) => {
        setCatalogue(
          (data.items ?? []).map((w: CatalogueRow) => ({
            id: w.id,
            name: w.name,
            workoutType: w.workoutType,
          })),
        );
      });
    if (raceWeekMeta) {
      void authFetch("/api/training/shakeout-run-config")
        .then((r) => r.json())
        .then((s) => {
          setShakeouts((s.configs ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        });
    }
  }, [raceWeekMeta]);

  function updateWeek(weekIndex: number, patch: Partial<PhaseWeekRow>) {
    onWeeksChange(
      weeks.map((w) => (w.weekIndex === weekIndex ? { ...w, ...patch } : w)),
    );
  }

  function addPin(weekIndex: number) {
    const week = weeks.find((w) => w.weekIndex === weekIndex);
    if (!week) return;
    updateWeek(weekIndex, {
      pins: [...week.pins, { workoutType: "Tempo", catalogueWorkoutId: "" }],
    });
  }

  function updatePin(weekIndex: number, pinIdx: number, patch: Partial<PhaseWeekPin>) {
    const week = weeks.find((w) => w.weekIndex === weekIndex);
    if (!week) return;
    const pins = week.pins.map((p, i) => (i === pinIdx ? { ...p, ...patch } : p));
    updateWeek(weekIndex, { pins });
  }

  function removePin(weekIndex: number, pinIdx: number) {
    const week = weeks.find((w) => w.weekIndex === weekIndex);
    if (!week) return;
    updateWeek(weekIndex, { pins: week.pins.filter((_, i) => i !== pinIdx) });
  }

  function optionsForType(wt: PhaseWeekPinWorkoutType): CatalogueRow[] {
    return catalogue.filter((c) => c.workoutType === wt);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-gray-600">{nameLabel}</span>
        <input
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </label>
      {raceWeekMeta ? (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">Shakeout rotation</span>
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              value={raceWeekMeta.shakeoutConfigId}
              onChange={(e) => raceWeekMeta.onShakeoutChange(e.target.value)}
            >
              <option value="">None</option>
              {shakeouts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Shakeout days before race</span>
            <input
              type="number"
              min={0}
              max={6}
              className="mt-1 w-full rounded border px-3 py-2"
              value={raceWeekMeta.shakeoutDaysPrior}
              onChange={(e) =>
                raceWeekMeta.onShakeoutDaysPriorChange(Number(e.target.value) || 0)
              }
            />
          </label>
        </div>
      ) : null}
      <p className="text-sm text-gray-600">
        Pin catalogue workouts for non-easy days. Generate fills other preferred days with easy runs
        under each week&apos;s cap.
      </p>
      {weeks.map((week) => {
        const label = PHASE_WEEK_LABELS[week.weekIndex - 1] ?? `W${week.weekIndex}`;
        return (
          <section
            key={week.weekIndex}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <h3 className="font-medium text-gray-900">{label}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-gray-600">Week cap (mi)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={week.totalMilesCap ?? ""}
                  onChange={(e) =>
                    updateWeek(week.weekIndex, {
                      totalMilesCap: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Long-run cap (mi)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={week.longRunCapMiles ?? ""}
                  onChange={(e) =>
                    updateWeek(week.weekIndex, {
                      longRunCapMiles: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <ul className="space-y-2">
              {week.pins.map((pin, pinIdx) => (
                <li key={pinIdx} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="text-gray-600">Type</span>
                    <select
                      className="mt-1 block rounded border px-2 py-1 text-sm"
                      value={pin.workoutType}
                      onChange={(e) =>
                        updatePin(week.weekIndex, pinIdx, {
                          workoutType: e.target.value as PhaseWeekPinWorkoutType,
                          catalogueWorkoutId: "",
                        })
                      }
                    >
                      {PIN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-[12rem] flex-1 text-sm">
                    <span className="text-gray-600">Catalogue workout</span>
                    <select
                      className="mt-1 block w-full rounded border px-2 py-1 text-sm"
                      value={pin.catalogueWorkoutId}
                      onChange={(e) =>
                        updatePin(week.weekIndex, pinIdx, { catalogueWorkoutId: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      {optionsForType(pin.workoutType).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                    onClick={() => removePin(week.weekIndex, pinIdx)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="text-sm font-medium text-sky-700 hover:underline"
              onClick={() => addPin(week.weekIndex)}
            >
              Add pinned workout
            </button>
          </section>
        );
      })}
    </div>
  );
}
