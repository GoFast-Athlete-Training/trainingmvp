"use client";

import { authFetch } from "@/components/AppProviders";
import { SearchCombobox } from "@/components/training-manager/SearchCombobox";
import { useEffect, useState } from "react";

type Row = { id: string; label: string; detail?: string };

function miles(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : String(n);
}

function raceWeekDetail(slots: unknown): string {
  if (!Array.isArray(slots) || slots.length === 0) return "No days yet";
  const withMiles = slots.filter((s) => {
    if (!s || typeof s !== "object") return false;
    const miles = (s as { prescribedMiles?: unknown }).prescribedMiles;
    return typeof miles === "number" && miles > 0;
  }).length;
  return `${slots.length} days · ${withMiles} with miles`;
}

export function PhaseChooseOrBuild({
  phase,
  linkedId,
  onLinked,
}: {
  phase: "baseBuild" | "buildToPeak" | "taper" | "raceWeek";
  linkedId: string | null;
  onLinked: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState(linkedId ?? "");
  const [busy, setBusy] = useState(false);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState("");

  const listUrl =
    phase === "baseBuild" || phase === "buildToPeak"
      ? "/api/training/build-preset"
      : phase === "taper"
        ? "/api/training/taper-preset"
        : "/api/training/race-week-preset";

  useEffect(() => {
    void authFetch(listUrl)
      .then((r) => r.json())
      .then((data) => {
        if (phase === "baseBuild" || phase === "buildToPeak") {
          setRows(
            (data.builds ?? []).map(
              (b: {
                id: string;
                name: string;
                startLongRunMiles: number | null;
                peakLongRunMiles: number | null;
                maxWeeklyMiles: number | null;
                longRunCutback: number | null;
              }) => ({
                id: b.id,
                label: b.name,
                detail: `Start ${miles(b.startLongRunMiles)} → peak ${miles(b.peakLongRunMiles)} mi · week ${miles(b.maxWeeklyMiles)} · cutback ${miles(b.longRunCutback)}`,
              }),
            ),
          );
        } else if (phase === "taper") {
          setRows(
            (data.tapers ?? []).map(
              (t: {
                id: string;
                name: string;
                week1TotalMiles: number | null;
                week1LongRunMiles: number | null;
                week2TotalMiles: number | null;
                week2LongRunMiles: number | null;
              }) => ({
                id: t.id,
                label: t.name,
                detail: `W1 ${miles(t.week1TotalMiles)} / LR ${miles(t.week1LongRunMiles)} · W2 ${miles(t.week2TotalMiles)} / LR ${miles(t.week2LongRunMiles)}`,
              }),
            ),
          );
        } else {
          setRows(
            (data.presets ?? []).map((p: { id: string; title: string; slots: unknown }) => ({
              id: p.id,
              label: p.title,
              detail: raceWeekDetail(p.slots),
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
        phase === "baseBuild" || phase === "buildToPeak"
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
    phase === "baseBuild"
      ? "base build"
      : phase === "buildToPeak"
        ? "build to peak"
        : phase === "taper"
          ? "taper"
          : "race week";

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
        Choose an existing {phaseLabel} or create a new one.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <SearchCombobox
          label="Choose"
          options={rows}
          value={selected}
          onChange={setSelected}
          placeholder={
            phase === "baseBuild"
              ? "Search base builds…"
              : phase === "buildToPeak"
                ? "Search builds to peak…"
                : phase === "taper"
                  ? "Search tapers…"
                  : "Search race weeks…"
          }
        />
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
          Create new
        </button>
      </div>
    </section>
  );
}
