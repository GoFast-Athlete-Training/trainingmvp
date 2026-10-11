"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import {
  CatalogueSlotCombobox,
  type CataloguePickerItem,
} from "@/components/training-manager/CatalogueSlotCombobox";
import { ROTATION_KINDS, type RotationKind } from "@/lib/training/run-type-config-kinds";
import { useCallback, useEffect, useMemo, useState } from "react";

type PositionRow = {
  cyclePosition: number;
  catalogueWorkoutId: string | null;
};

function parseKind(raw: string): RotationKind | "shakeout" | null {
  if (raw === "shakeout") return "shakeout";
  return ROTATION_KINDS.find((row) => row.id === raw)?.id ?? null;
}

export default function RunTypeConfigEditorPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const pathname = usePathname();
  const [kind, setKind] = useState<RotationKind | "shakeout" | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [totalMiles, setTotalMiles] = useState("3");
  const [paceOffsetSecPerMile, setPaceOffsetSecPerMile] = useState("0");
  const [catalogue, setCatalogue] = useState<CataloguePickerItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => {
      setKind(parseKind(p.kind));
      setConfigId(p.id);
    });
  }, [params]);

  const meta = kind && kind !== "shakeout" ? ROTATION_KINDS.find((k) => k.id === kind) : null;

  const createHref = useMemo(() => {
    const returnTo = encodeURIComponent(pathname ?? "/dashboard/long-run-config");
    return `/dashboard/catalogue?new=1&type=${meta?.workoutType ?? "Easy"}&returnTo=${returnTo}`;
  }, [pathname, meta?.workoutType]);

  const loadRotation = useCallback(async () => {
    if (!configId || !meta) return;
    const [configRes, catRes] = await Promise.all([
      authFetch(`/api/training/${meta.apiSegment}/${configId}`),
      authFetch(`/api/training/catalogue?workoutType=${meta.workoutType}`),
    ]);
    const configData = (await configRes.json()) as {
      config?: { name: string; positions: PositionRow[] };
    };
    const catData = (await catRes.json()) as { items?: CataloguePickerItem[] };
    if (configData.config) {
      setName(configData.config.name);
      setPositions(
        [...configData.config.positions].sort((a, b) => a.cyclePosition - b.cyclePosition),
      );
    }
    setCatalogue(catData.items ?? []);
  }, [configId, meta]);

  const loadShakeout = useCallback(async () => {
    if (!configId) return;
    const res = await authFetch(`/api/training/shakeout-run-config/${configId}`);
    const data = (await res.json()) as {
      config?: { name: string; totalMiles: number; paceOffsetSecPerMile: number };
    };
    if (data.config) {
      setName(data.config.name);
      setTotalMiles(String(data.config.totalMiles));
      setPaceOffsetSecPerMile(String(data.config.paceOffsetSecPerMile));
    }
  }, [configId]);

  useEffect(() => {
    if (!configId || !kind) return;
    if (kind === "shakeout") void loadShakeout();
    else void loadRotation();
  }, [configId, kind, loadShakeout, loadRotation]);

  async function saveRotation() {
    if (!configId || !meta) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/${meta.apiSegment}/${configId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          positions: positions.map((p) => ({
            cyclePosition: p.cyclePosition,
            catalogueWorkoutId: p.catalogueWorkoutId || null,
          })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveShakeout() {
    if (!configId) return;
    setSaving(true);
    try {
      await authFetch(`/api/training/shakeout-run-config/${configId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          totalMiles: Number(totalMiles),
          paceOffsetSecPerMile: Number(paceOffsetSecPerMile),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!configId) return <p className="text-gray-500">Loading…</p>;

  if (!kind) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/long-run-config" className="text-sm text-sky-700 hover:underline">
          ← Run Type Config
        </Link>
        <p className="text-sm text-red-600">Unknown run type. Use the hub to open a valid config.</p>
      </div>
    );
  }

  if (kind === "shakeout") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/dashboard/long-run-config" className="text-sm text-sky-700 hover:underline">
          ← Run Type Config
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Shakeout config</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pace offset is added to marathon pace on race-week shakeout rows (slower than easy ~90s).
          </p>
        </div>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            className="mt-1 w-full max-w-md rounded border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">Default miles</span>
            <input
              type="number"
              min={0}
              step="0.1"
              className="mt-1 w-full rounded border px-3 py-2"
              value={totalMiles}
              onChange={(e) => setTotalMiles(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Pace offset (sec/mi vs MP)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={paceOffsetSecPerMile}
              onChange={(e) => setPaceOffsetSecPerMile(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveShakeout()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }

  if (!meta) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/long-run-config" className="text-sm text-sky-700 hover:underline">
        ← Run Type Config
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{meta.label} rotation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Catalogue workouts in order. Miles come from the build preset or race-week row.
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-gray-600">Name</span>
        <input
          className="mt-1 w-full max-w-md rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <ol className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        {positions.map((pos, idx) => (
          <li key={pos.cyclePosition} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <p className="mb-2 text-sm font-medium text-gray-700">Slot {idx + 1}</p>
            <CatalogueSlotCombobox
              options={catalogue}
              value={pos.catalogueWorkoutId ?? ""}
              createHref={createHref}
              workoutTypeLabel={meta.workoutType}
              onChange={(id) => {
                const next = [...positions];
                next[idx] = { ...pos, catalogueWorkoutId: id || null };
                setPositions(next);
              }}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveRotation()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
