"use client";

import { authFetch } from "@/components/AppProviders";
import { useEffect, useState } from "react";

type Item = { id: string; name: string; workoutType: string; runSubType: string | null };

export function CatalogueChecklist({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    void authFetch("/api/training/catalogue")
      .then((res) => res.json())
      .then((data: { items?: Item[] }) => setItems(data.items ?? []));
  }, []);

  const groups = ["LongRun", "Easy", "Tempo", "Intervals"].map((type) => ({
    type,
    rows: items.filter((item) => item.workoutType === type),
  }));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="font-semibold">Catalogue workouts</h2>
      {groups.map((group) => (
        <div key={group.type}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.type}</p>
          <ul className="mt-1 space-y-1">
            {group.rows.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span>{item.name}</span>
                  {item.runSubType ? <span className="text-xs text-gray-500">{item.runSubType}</span> : null}
                </label>
              </li>
            ))}
            {group.rows.length === 0 ? <li className="text-sm text-gray-400">None</li> : null}
          </ul>
        </div>
      ))}
    </section>
  );
}
