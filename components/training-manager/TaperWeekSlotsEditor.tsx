"use client";

import { authFetch } from "@/components/AppProviders";
import {
  taperOffsetLabel,
  type TaperWeekSlot,
  type TaperWeekSlotType,
} from "@/lib/training/taper-week-slots";
import { useEffect, useState } from "react";

type CatalogueRow = { id: string; name: string; workoutType: string };

const RUNNING_TYPES: TaperWeekSlotType[] = ["easy", "tempo", "intervals", "shakeout-easy"];

export function TaperWeekSlotsEditor({
  slots,
  onChange,
}: {
  slots: TaperWeekSlot[];
  onChange: (slots: TaperWeekSlot[]) => void;
}) {
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);

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
  }, []);

  function updateSlot(idx: number, patch: Partial<TaperWeekSlot>) {
    const next = [...slots];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }

  function catalogueForType(type: TaperWeekSlotType): CatalogueRow[] {
    if (type === "tempo") return catalogue.filter((c) => c.workoutType === "Tempo");
    if (type === "intervals") return catalogue.filter((c) => c.workoutType === "Intervals");
    return catalogue.filter((c) => c.workoutType === "Easy");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Optional day-level taper stamps (offsets from goal race). When empty, prod generate uses
        build rotation plus week caps only.
      </p>
      <ul className="space-y-3">
        {slots.map((slot, idx) => (
          <li
            key={slot.offsetFromRace}
            className="grid gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[5rem_1fr_6rem_1fr_5rem]"
          >
            <p className="self-center text-sm font-medium text-gray-900">
              {taperOffsetLabel(slot.offsetFromRace)}
            </p>
            <label className="block text-sm">
              <span className="text-gray-600">Run name</span>
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={slot.runName}
                onChange={(e) => updateSlot(idx, { runName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Type</span>
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={slot.type}
                onChange={(e) =>
                  updateSlot(idx, {
                    type: e.target.value as TaperWeekSlotType,
                    catalogueWorkoutId: null,
                  })
                }
              >
                {RUNNING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "shakeout-easy" ? "Shakeout (easy)" : t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Catalogue workout</span>
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={slot.catalogueWorkoutId ?? ""}
                onChange={(e) =>
                  updateSlot(idx, { catalogueWorkoutId: e.target.value || null })
                }
              >
                <option value="">Choose…</option>
                {catalogueForType(slot.type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Miles</span>
              <input
                type="number"
                min={0}
                step="0.1"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={slot.prescribedMiles ?? ""}
                onChange={(e) =>
                  updateSlot(idx, {
                    prescribedMiles: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
