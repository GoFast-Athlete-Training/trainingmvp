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
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState("");

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

  async function createWithName() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const body =
        phase === "raceWeek" ? { title: trimmed } : { name: trimmed };
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
      if (id) {
        setNamingNew(false);
        setNewName("");
        onLinked(id);
      }
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel =
    phase === "build" ? "build preset" : phase === "taper" ? "taper preset" : "race week";

  if (namingNew) {
    return (
      <section className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm text-gray-700">
          Name this {phaseLabel}. You will pick it by this name when you link it on another plan.
        </p>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            className="mt-1 w-full max-w-md rounded border px-3 py-2"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() => void createWithName()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create and continue"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setNamingNew(false);
              setNewName("");
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <p className="text-sm text-gray-700">
        Choose an existing {phaseLabel} or build a new one.
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
          onClick={() => setNamingNew(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Build new
        </button>
      </div>
    </section>
  );
}
