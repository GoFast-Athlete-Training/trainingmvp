"use client";

import { authFetch } from "@/components/AppProviders";
import {
  offsetLabel,
  type RaceWeekSlot,
  type RaceWeekSlotType,
} from "@/lib/training/race-week-slots";
import { useEffect, useState } from "react";

type CatalogueRow = { id: string; name: string; workoutType: string };
type ShakeoutRow = { id: string; name: string };

const RUNNING_TYPES: RaceWeekSlotType[] = ["easy", "tempo", "intervals", "shakeout-easy"];

export function RaceWeekSlotsEditor({
  slots,
  onChange,
}: {
  slots: RaceWeekSlot[];
  onChange: (slots: RaceWeekSlot[]) => void;
}) {
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [shakeouts, setShakeouts] = useState<ShakeoutRow[]>([]);

  useEffect(() => {
    void Promise.all([
      authFetch("/api/training/catalogue").then((r) => r.json()),
      authFetch("/api/training/shakeout-run-config").then((r) => r.json()),
    ]).then(([cat, shake]) => {
      setCatalogue(
        (cat.items ?? []).map((w: CatalogueRow) => ({
          id: w.id,
          name: w.name,
          workoutType: w.workoutType,
        })),
      );
      setShakeouts((shake.configs ?? []).map((c: ShakeoutRow) => ({ id: c.id, name: c.name })));
    });
  }, []);

  function updateSlot(idx: number, patch: Partial<RaceWeekSlot>) {
    const next = [...slots];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }

  function catalogueForType(type: RaceWeekSlotType): CatalogueRow[] {
    if (type === "tempo") return catalogue.filter((c) => c.workoutType === "Tempo");
    if (type === "intervals") return catalogue.filter((c) => c.workoutType === "Intervals");
    return catalogue.filter((c) => c.workoutType === "Easy");
  }

  return (
    <ul className="space-y-3">
      {slots.map((slot, idx) => {
        const locked = slot.type === "off" || slot.type === "race";
        const isShakeout = slot.type === "shakeout-easy";
        return (
          <li
            key={slot.offsetFromRace}
            className={`grid gap-2 rounded-xl border p-4 sm:grid-cols-[5rem_1fr_6rem_1fr_5rem] ${
              isShakeout ? "border-sky-300 bg-sky-50" : "border-gray-200 bg-white"
            }`}
          >
            <p className="self-center text-sm font-medium text-gray-900">{offsetLabel(slot.offsetFromRace)}</p>
            {!locked ? (
              <>
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
                        type: e.target.value as RaceWeekSlotType,
                        catalogueWorkoutId: null,
                      })
                    }
                    disabled={isShakeout}
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
                {isShakeout ? (
                  <label className="block text-sm sm:col-span-5">
                    <span className="text-gray-600">Shakeout pace config</span>
                    <select
                      className="mt-1 w-full max-w-md rounded border px-2 py-1 text-sm"
                      value={slot.shakeoutRunConfigId ?? ""}
                      onChange={(e) =>
                        updateSlot(idx, { shakeoutRunConfigId: e.target.value || null })
                      }
                    >
                      <option value="">Default easy pace</option>
                      {shakeouts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : (
              <p className="self-center text-sm text-gray-600 sm:col-span-4">{slot.runName}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
