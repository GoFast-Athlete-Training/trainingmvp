"use client";

import { authFetch } from "@/components/AppProviders";
import { useEffect, useState } from "react";

type Row = { id: string; label: string };

export function PhaseChooseOrBuild({
  phase,
  linkedId,
  onLinked,
}: {
  phase: "build" | "taper" | "raceWeek";
  linkedId: string | null;
  onLinked: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState(linkedId ?? "");
  const [busy, setBusy] = useState(false);

  const listUrl =
    phase === "build"
      ? "/api/training/build-preset"
      : phase === "taper"
        ? "/api/training/taper-preset"
        : "/api/training/race-week-preset";

  useEffect(() => {
    void authFetch(listUrl)
      .then((r) => r.json())
      .then((data) => {
        if (phase === "build") {
          setRows(
            (data.builds ?? []).map((b: { id: string; name: string }) => ({
              id: b.id,
              label: b.name,
            })),
          );
        } else if (phase === "taper") {
          setRows(
            (data.tapers ?? []).map((t: { id: string; name: string }) => ({
              id: t.id,
              label: t.name,
            })),
          );
        } else {
          setRows(
            (data.presets ?? []).map((p: { id: string; title: string }) => ({
              id: p.id,
              label: p.title,
            })),
          );
        }
      });
  }, [listUrl, phase]);

  async function linkExisting() {
    if (!selected) return;
    onLinked(selected);
  }

  async function buildNew() {
    setBusy(true);
    try {
      const body =
        phase === "raceWeek"
          ? { title: "Untitled" }
          : { name: "Untitled" };
      const res = await authFetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const id =
        phase === "build"
          ? (data.build?.id as string)
          : phase === "taper"
            ? (data.taper?.id as string)
            : (data.preset?.id as string);
      if (id) onLinked(id);
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel =
    phase === "build" ? "build preset" : phase === "taper" ? "taper preset" : "race week";

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <p className="text-sm text-gray-700">
        Choose an existing {phaseLabel} or build a new one (starts as <strong>Untitled</strong>).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="text-gray-600">Choose</span>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select…</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!selected}
          onClick={() => void linkExisting()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Use selected
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void buildNew()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Build new"}
        </button>
      </div>
    </section>
  );
}
