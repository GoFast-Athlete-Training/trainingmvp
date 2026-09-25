"use client";

import { authFetch } from "@/components/AppProviders";
import { RotationCombobox } from "@/components/training-manager/RotationCombobox";
import { useEffect, useState } from "react";

type ConfigRow = { id: string; name: string };

export type PhaseRotationIds = {
  longRunConfigId: string;
  easyConfigId: string;
  tempoConfigId: string;
  intervalsConfigId: string;
};

const RUN_TYPE_CONFIG_HREF = "/dashboard/long-run-config";

export function PhaseRotationBolts({
  value,
  onChange,
  onBeforeManageNavigate,
}: {
  value: PhaseRotationIds;
  onChange: (next: PhaseRotationIds) => void;
  onBeforeManageNavigate?: () => void | Promise<void>;
}) {
  const [longConfigs, setLongConfigs] = useState<ConfigRow[]>([]);
  const [easyConfigs, setEasyConfigs] = useState<ConfigRow[]>([]);
  const [tempoConfigs, setTempoConfigs] = useState<ConfigRow[]>([]);
  const [intervalsConfigs, setIntervalsConfigs] = useState<ConfigRow[]>([]);

  useEffect(() => {
    void Promise.all([
      authFetch("/api/training/long-run-config").then((r) => r.json()),
      authFetch("/api/training/easy-config").then((r) => r.json()),
      authFetch("/api/training/tempo-config").then((r) => r.json()),
      authFetch("/api/training/intervals-config").then((r) => r.json()),
    ]).then(([lr, easy, tempo, intervals]) => {
      setLongConfigs((lr.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setEasyConfigs((easy.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setTempoConfigs((tempo.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
      setIntervalsConfigs((intervals.configs ?? []).map((c: ConfigRow) => ({ id: c.id, name: c.name })));
    });
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="font-semibold">Run-type rotations</h2>
      <p className="text-sm text-gray-600">
        Choose a preset for run rotation or{" "}
        <a
          href={RUN_TYPE_CONFIG_HREF}
          className="font-medium text-sky-700 hover:underline"
          onClick={(e) => {
            e.preventDefault();
            void (async () => {
              if (onBeforeManageNavigate) await onBeforeManageNavigate();
              window.location.assign(RUN_TYPE_CONFIG_HREF);
            })();
          }}
        >
          create one
        </a>{" "}
        in Run Type Config. Each slot is a catalogue workout in order (no pool percentages).
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <RotationCombobox
          label="Long run rotation"
          options={longConfigs}
          value={value.longRunConfigId}
          onChange={(id) => onChange({ ...value, longRunConfigId: id })}
          manageHref={RUN_TYPE_CONFIG_HREF}
          onBeforeManageNavigate={onBeforeManageNavigate}
        />
        <RotationCombobox
          label="Easy rotation"
          options={easyConfigs}
          value={value.easyConfigId}
          onChange={(id) => onChange({ ...value, easyConfigId: id })}
          manageHref={RUN_TYPE_CONFIG_HREF}
          onBeforeManageNavigate={onBeforeManageNavigate}
        />
        <RotationCombobox
          label="Tempo rotation"
          options={tempoConfigs}
          value={value.tempoConfigId}
          onChange={(id) => onChange({ ...value, tempoConfigId: id })}
          manageHref={RUN_TYPE_CONFIG_HREF}
          onBeforeManageNavigate={onBeforeManageNavigate}
        />
        <RotationCombobox
          label="Intervals rotation"
          options={intervalsConfigs}
          value={value.intervalsConfigId}
          onChange={(id) => onChange({ ...value, intervalsConfigId: id })}
          manageHref={RUN_TYPE_CONFIG_HREF}
          onBeforeManageNavigate={onBeforeManageNavigate}
        />
      </div>
    </section>
  );
}
