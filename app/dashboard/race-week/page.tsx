"use client";

import { authFetch } from "@/components/AppProviders";
import { parseRaceWeekSlots, type RaceWeekSlot } from "@/lib/training/race-week-slots";
import { useCallback, useEffect, useState } from "react";

type RaceWeekRow = {
  id: string;
  title: string;
  shakeoutDaysPriorToRace: number;
  slots: unknown;
  shakeoutRunConfig?: { name: string; totalMiles: number } | null;
};

export default function RaceWeekPage() {
  const [rows, setRows] = useState<RaceWeekRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slots, setSlots] = useState<RaceWeekSlot[]>([]);
  const [shakeoutDays, setShakeoutDays] = useState(2);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/race-week-preset");
    const data = (await res.json()) as { presets?: RaceWeekRow[] };
    setRows(data.presets ?? []);
    if (data.presets?.[0] && !selectedId) {
      setSelectedId(data.presets[0].id);
      setSlots(parseRaceWeekSlots(data.presets[0].slots));
      setShakeoutDays(data.presets[0].shakeoutDaysPriorToRace);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const row = rows.find((r) => r.id === selectedId);
    if (row) {
      setSlots(parseRaceWeekSlots(row.slots));
      setShakeoutDays(row.shakeoutDaysPriorToRace);
    }
  }, [selectedId, rows]);

  async function createPreset() {
    const res = await authFetch("/api/training/race-week-preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Marathon race week" }),
    });
    await load();
    const data = (await res.json()) as { preset?: { id: string } };
    if (data.preset) setSelectedId(data.preset.id);
  }

  async function saveSlots() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/race-week-preset/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, shakeoutDaysPriorToRace: shakeoutDays }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Race week</h1>
          <p className="text-sm text-gray-600">Notional race pin + day marks (stub editor)</p>
        </div>
        <button
          type="button"
          onClick={() => void createPreset()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
        >
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

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Week marks (offset from race day)</h2>
        <label className="text-sm block">
          Shakeout days prior
          <input
            type="number"
            className="mt-1 w-24 rounded border px-2 py-1"
            value={shakeoutDays}
            onChange={(e) => setShakeoutDays(Number(e.target.value) || 2)}
          />
        </label>
        <ul className="space-y-2">
          {slots.map((s, idx) => (
            <li key={`${s.offsetFromRace}-${idx}`} className="flex items-center gap-3 text-sm">
              <input
                type="number"
                className="w-16 rounded border px-2 py-1"
                value={s.offsetFromRace}
                onChange={(e) => {
                  const next = [...slots];
                  next[idx] = { ...s, offsetFromRace: Number(e.target.value) };
                  setSlots(next);
                }}
              />
              <select
                className="rounded border px-2 py-1"
                value={s.slotType}
                onChange={(e) => {
                  const next = [...slots];
                  next[idx] = { ...s, slotType: e.target.value as RaceWeekSlot["slotType"] };
                  setSlots(next);
                }}
              >
                {["Easy", "Tempo", "Intervals", "Rest", "Shakeout", "Race"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setSlots([...slots, { offsetFromRace: -1, slotType: "Rest" }])}
          className="text-sm text-sky-700 underline"
        >
          + Add slot
        </button>
        <button
          type="button"
          disabled={saving || !selectedId}
          onClick={() => void saveSlots()}
          className="block rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save race week"}
        </button>
      </section>
    </div>
  );
}
