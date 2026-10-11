"use client";

import { authFetch } from "@/components/AppProviders";
import { RaceWeekSlotsEditor } from "@/components/training-manager/RaceWeekSlotsEditor";
import {
  defaultRaceWeekSlots,
  parseRaceWeekSlots,
  type RaceWeekSlot,
} from "@/lib/training/race-week-slots";
import { useCallback, useEffect, useState } from "react";

type RaceWeekRow = {
  id: string;
  title: string;
  slots: unknown;
};

export default function RaceWeekPage() {
  const [rows, setRows] = useState<RaceWeekRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [slots, setSlots] = useState<RaceWeekSlot[]>(() => defaultRaceWeekSlots());
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    const res = await authFetch("/api/training/race-week-preset");
    const data = (await res.json()) as { presets?: RaceWeekRow[] };
    setRows(data.presets ?? []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setTitle(row.title);
    setSlots(parseRaceWeekSlots(row.slots));
  }, [selectedId, rows]);

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/race-week-preset/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Race week", slots }),
      });
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Race week presets</h1>
      <label className="block text-sm">
        <span className="text-gray-600">Preset</span>
        <select
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select…</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      {selectedId ? (
        <>
          <label className="block text-sm">
            <span className="text-gray-600">Title</span>
            <input
              className="mt-1 w-full max-w-md rounded border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <RaceWeekSlotsEditor slots={slots} onChange={setSlots} />
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      ) : null}
    </div>
  );
}
