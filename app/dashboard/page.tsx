"use client";

import Link from "next/link";

export default function DashboardHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Training Engine</h1>
        <p className="mt-1 text-gray-600">
          Miles, rotations, taper, and race week — stub editors to iterate from.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/presets"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-sky-300"
        >
          <h2 className="font-semibold">Build presets</h2>
          <p className="mt-1 text-sm text-gray-600">Weekly miles + LR / easy / tempo / interval rotations.</p>
        </Link>
        <Link
          href="/dashboard/parent-presets"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-sky-300"
        >
          <h2 className="font-semibold">Programs</h2>
          <p className="mt-1 text-sm text-gray-600">Parent preset: build + taper + race week rollup.</p>
        </Link>
        <Link
          href="/dashboard/long-run-config"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-sky-300"
        >
          <h2 className="font-semibold">Long run rotations</h2>
          <p className="mt-1 text-sm text-gray-600">Cycle positions → catalogue workouts.</p>
        </Link>
        <Link
          href="/dashboard/race-week"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-sky-300"
        >
          <h2 className="font-semibold">Race week</h2>
          <p className="mt-1 text-sm text-gray-600">Notional race pin + day marks + shakeout.</p>
        </Link>
      </div>
    </div>
  );
}
