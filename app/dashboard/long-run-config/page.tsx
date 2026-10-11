"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { ROTATION_KINDS, type RotationKind } from "@/lib/training/run-type-config-kinds";
import { useCallback, useEffect, useState } from "react";

type RotationRow = {
  id: string;
  name: string;
  positions?: Array<{ cyclePosition: number }>;
};

type ShakeoutRow = { id: string; name: string; totalMiles: number; paceOffsetSecPerMile: number };

type Tab = RotationKind | "shakeout";

export default function RunTypeConfigHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("long-run");
  const [rotations, setRotations] = useState<Record<RotationKind, RotationRow[]>>({
    "long-run": [],
    easy: [],
    tempo: [],
    intervals: [],
  });
  const [shakeouts, setShakeouts] = useState<ShakeoutRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const [lr, easy, tempo, intervals, shake] = await Promise.all([
      authFetch("/api/training/long-run-config").then((r) => r.json()),
      authFetch("/api/training/easy-config").then((r) => r.json()),
      authFetch("/api/training/tempo-config").then((r) => r.json()),
      authFetch("/api/training/intervals-config").then((r) => r.json()),
      authFetch("/api/training/shakeout-run-config").then((r) => r.json()),
    ]);
    setRotations({
      "long-run": lr.configs ?? [],
      easy: easy.configs ?? [],
      tempo: tempo.configs ?? [],
      intervals: intervals.configs ?? [],
    });
    setShakeouts(shake.configs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRotation() {
    const trimmed = newName.trim();
    if (!trimmed || tab === "shakeout") return;
    const kind = ROTATION_KINDS.find((k) => k.id === tab)!;
    setCreating(true);
    try {
      const res = await authFetch(`/api/training/${kind.apiSegment}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, positionCount: 4 }),
      });
      const data = (await res.json()) as { config?: { id: string } };
      if (data.config?.id) {
        router.push(`/dashboard/long-run-config/${kind.id}/${data.config.id}`);
      } else {
        await load();
      }
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  async function createShakeout() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/training/shakeout-run-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, totalMiles: 3, paceOffsetSecPerMile: 0 }),
      });
      const data = (await res.json()) as { config?: { id: string } };
      if (data.config?.id) {
        router.push(`/dashboard/long-run-config/shakeout/${data.config.id}`);
      } else {
        await load();
      }
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  const activeKind = ROTATION_KINDS.find((k) => k.id === tab);
  const rotationList = tab !== "shakeout" ? rotations[tab] : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Run Type Config</h1>
        <p className="text-sm text-gray-600">
          Rotations bolt onto build presets. Shakeout configs set pace offset for race-week shakeout
          rows.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {ROTATION_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setTab(k.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === k.id ? "bg-sky-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("shakeout")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "shakeout" ? "bg-sky-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Shakeout
        </button>
      </div>

      <section className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <label className="block text-sm">
          <span className="text-gray-600">
            New {tab === "shakeout" ? "shakeout config" : `${activeKind?.label ?? ""} rotation`}
          </span>
          <input
            className="mt-1 w-full max-w-md rounded border px-3 py-2"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={creating || !newName.trim()}
          onClick={() => void (tab === "shakeout" ? createShakeout() : createRotation())}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </section>

      {tab === "shakeout" ? (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {shakeouts.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{row.name}</p>
                <p className="text-xs text-gray-500">
                  {row.totalMiles} mi · pace offset {row.paceOffsetSecPerMile} sec/mi
                </p>
              </div>
              <Link
                href={`/dashboard/long-run-config/shakeout/${row.id}`}
                className="text-sm text-sky-700 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
          {shakeouts.length === 0 ? (
            <li className="px-4 py-6 text-sm text-gray-500">No shakeout configs yet.</li>
          ) : null}
        </ul>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {rotationList.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{row.name}</p>
                <p className="text-xs text-gray-500">{row.positions?.length ?? 0} slots</p>
              </div>
              <Link
                href={`/dashboard/long-run-config/${tab}/${row.id}`}
                className="text-sm text-sky-700 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
          {rotationList.length === 0 ? (
            <li className="px-4 py-6 text-sm text-gray-500">No rotations yet.</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
