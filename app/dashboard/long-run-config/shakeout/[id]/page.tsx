"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

export default function ShakeoutConfigEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [totalMiles, setTotalMiles] = useState("3");
  const [paceOffsetSecPerMile, setPaceOffsetSecPerMile] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void params.then((p) => setConfigId(p.id));
  }, [params]);

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  async function save() {
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
        onClick={() => void save()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
