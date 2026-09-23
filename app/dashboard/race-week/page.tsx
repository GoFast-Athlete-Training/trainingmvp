"use client";

import { authFetch } from "@/components/AppProviders";
import {
  parseRaceWeekDays,
  type RaceWeekDaySlot,
} from "@/lib/training/race-week-days";
import { useCallback, useEffect, useState } from "react";

type CatalogueItem = { id: string; name: string; workoutType: string };

type RaceWeekRow = {
  id: string;
  title: string;
  slots: unknown;
};

const SLOT_TYPES = ["Rest", "Easy", "Tempo", "Intervals", "Shakeout"] as const;

export default function RaceWeekPage() {
  const [rows, setRows] = useState<RaceWeekRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState<RaceWeekDaySlot[]>(() => parseRaceWeekDays(null));
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [raceRes, catRes] = await Promise.all([
      authFetch("/api/training/race-week-preset"),
      authFetch("/api/training/catalogue"),
    ]);
    const raceData = (await raceRes.json()) as { presets?: RaceWeekRow[] };
    const catData = (await catRes.json()) as { items?: CatalogueItem[] };
    setRows(raceData.presets ?? []);
    setCatalogue(catData.items ?? []);
    setSelectedId((current) => current ?? raceData.presets?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const row = rows.find((r) => r.id === selectedId);
    if (row) setDays(parseRaceWeekDays(row.slots));
  }, [selectedId, rows]);

  async function createPreset() {
    const res = await authFetch("/api/training/race-week-preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Race week" }),
    });
    const data = (await res.json()) as { preset?: { id: string } };
    await load();
    if (data.preset) setSelectedId(data.preset.id);
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/race-week-preset/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: days }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Race week</h1>
          <p className="text-sm text-gray-600">Build the Monday–Friday routine. Saturday and race day stay outside it.</p>
        </div>
        <button type="button" onClick={() => void createPreset()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
          New race week
        </button>
      </div>

      {rows.length > 0 ? (
        <select
          className="rounded border px-3 py-2 text-sm"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      ) : null}

      <ul className="space-y-3">
        {days.map((day, idx) => (
          <li key={day.day} className="grid gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[8rem_1fr_1fr]">
            <p className="font-medium">{day.day}</p>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={day.slotType}
              onChange={(e) => {
                const next = [...days];
                next[idx] = { ...day, slotType: e.target.value as RaceWeekDaySlot["slotType"] };
                setDays(next);
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
                setDays(next);
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

      <button
        type="button"
        disabled={saving || !selectedId}
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save race week"}
      </button>
    </div>
  );
}
