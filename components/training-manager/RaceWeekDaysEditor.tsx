"use client";

import { authFetch } from "@/components/AppProviders";
import type { RaceWeekDaySlot } from "@/lib/training/race-week-days";
import { useEffect, useState } from "react";

const SLOT_TYPES = ["Rest", "Easy", "Tempo", "Intervals", "Shakeout"] as const;

type ConfigRow = { id: string; name: string };

export function RaceWeekDaysEditor({
  days,
  onChange,
  shakeoutConfigId,
  onShakeoutChange,
}: {
  days: RaceWeekDaySlot[];
  onChange: (days: RaceWeekDaySlot[]) => void;
  shakeoutConfigId: string;
  onShakeoutChange: (id: string) => void;
}) {
  const [easy, setEasy] = useState<ConfigRow[]>([]);
  const [tempo, setTempo] = useState<ConfigRow[]>([]);
  const [intervals, setIntervals] = useState<ConfigRow[]>([]);
  const [shakeouts, setShakeouts] = useState<ConfigRow[]>([]);

  useEffect(() => {
    void Promise.all([
      authFetch("/api/training/easy-config").then((r) => r.json()),
      authFetch("/api/training/tempo-config").then((r) => r.json()),
      authFetch("/api/training/intervals-config").then((r) => r.json()),
      authFetch("/api/training/shakeout-run-config").then((r) => r.json()),
    ]).then(([e, t, i, s]) => {
      setEasy((e.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setTempo((t.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setIntervals((i.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setShakeouts((s.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
    });
  }, []);

  function configOptions(slotType: RaceWeekDaySlot["slotType"]): ConfigRow[] {
    if (slotType === "Easy") return easy;
    if (slotType === "Tempo") return tempo;
    if (slotType === "Intervals") return intervals;
    return [];
  }

  function configValue(day: RaceWeekDaySlot): string {
    if (day.slotType === "Easy") return day.easyConfigId ?? "";
    if (day.slotType === "Tempo") return day.tempoConfigId ?? "";
    if (day.slotType === "Intervals") return day.intervalsConfigId ?? "";
    return "";
  }

  function setConfigValue(idx: number, day: RaceWeekDaySlot, configId: string) {
    const next = [...days];
    const row: RaceWeekDaySlot = {
      ...day,
      easyConfigId: day.slotType === "Easy" ? configId || null : day.easyConfigId ?? null,
      tempoConfigId: day.slotType === "Tempo" ? configId || null : day.tempoConfigId ?? null,
      intervalsConfigId: day.slotType === "Intervals" ? configId || null : day.intervalsConfigId ?? null,
    };
    next[idx] = row;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-gray-600">Shakeout rotation</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={shakeoutConfigId}
          onChange={(e) => onShakeoutChange(e.target.value)}
        >
          <option value="">None</option>
          {shakeouts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
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
                next[idx] = {
                  ...day,
                  slotType: e.target.value as RaceWeekDaySlot["slotType"],
                };
                onChange(next);
              }}
            >
              {SLOT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {["Easy", "Tempo", "Intervals"].includes(day.slotType) ? (
              <select
                className="rounded border px-2 py-1 text-sm"
                value={configValue(day)}
                onChange={(e) => setConfigValue(idx, day, e.target.value)}
              >
                <option value="">No rotation</option>
                {configOptions(day.slotType).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="self-center text-xs text-gray-400">—</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
