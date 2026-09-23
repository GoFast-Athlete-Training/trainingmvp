"use client";

import { authFetch } from "@/components/AppProviders";
import { RaceWeekDaysEditor } from "@/components/training-manager/RaceWeekDaysEditor";
import { parseRaceWeekDays, type RaceWeekDaySlot } from "@/lib/training/race-week-days";
import { useCallback, useEffect, useState } from "react";

type RaceWeekRow = {
  id: string;
  title: string;
  slots: unknown;
};

export default function RaceWeekPage() {
  const [rows, setRows] = useState<RaceWeekRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState<RaceWeekDaySlot[]>(() => parseRaceWeekDays(null));
  const [shakeoutConfigId, setShakeoutConfigId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const raceRes = await authFetch("/api/training/race-week-preset");
    const raceData = (await raceRes.json()) as {
      presets?: Array<RaceWeekRow & { shakeoutRunConfigId?: string | null }>;
    };
    setRows(raceData.presets ?? []);
    setSelectedId((current) => current ?? raceData.presets?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const row = rows.find((r) => r.id === selectedId);
    if (row) {
      setDays(parseRaceWeekDays(row.slots));
      setShakeoutConfigId((row as { shakeoutRunConfigId?: string | null }).shakeoutRunConfigId ?? "");
    }
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
        body: JSON.stringify({ slots: days, shakeoutRunConfigId: shakeoutConfigId || null }),
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

      <RaceWeekDaysEditor
        days={days}
        onChange={setDays}
        shakeoutConfigId={shakeoutConfigId}
        onShakeoutChange={setShakeoutConfigId}
      />

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
