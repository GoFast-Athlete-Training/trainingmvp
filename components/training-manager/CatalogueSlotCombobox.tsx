"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type CataloguePickerItem = {
  id: string;
  name: string;
  slug: string | null;
  description?: string | null;
};

function formatLabel(it: CataloguePickerItem): string {
  return it.slug ? `${it.name} (${it.slug})` : it.name;
}

export function CatalogueSlotCombobox({
  options,
  value,
  onChange,
  createHref,
  workoutTypeLabel,
}: {
  options: CataloguePickerItem[];
  value: string;
  onChange: (id: string) => void;
  createHref: string;
  workoutTypeLabel: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => (value ? options.find((o) => o.id === value) : undefined),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.name} ${o.slug ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, searchQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, close]);

  return (
    <div ref={rootRef} className="min-w-0 flex-1">
      <span className="mb-1 block text-xs font-medium text-gray-500">Catalogue workout</span>
      <div className="mb-1 flex min-h-[2rem] flex-wrap items-center gap-2">
        {selected ? (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm text-sky-900">
            <span className="truncate font-medium">{formatLabel(selected)}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="shrink-0 rounded px-1 text-sky-600 hover:bg-sky-100"
              aria-label="Clear workout"
            >
              ×
            </button>
          </span>
        ) : (
          <span className="text-sm text-gray-400">None selected</span>
        )}
      </div>
      {selected?.description ? (
        <p className="mb-2 line-clamp-2 text-xs text-gray-600">{selected.description}</p>
      ) : null}
      {selected ? (
        <Link
          href={`/dashboard/catalogue/${selected.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 inline-block text-xs font-medium text-sky-700 hover:underline"
        >
          View in catalogue
        </Link>
      ) : null}
      {options.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm text-amber-900">No catalogue workouts for this type yet.</p>
          <Link
            href={createHref}
            className="mt-2 inline-flex rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Create {workoutTypeLabel} workout
          </Link>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
                inputRef.current?.blur();
              } else if (e.key === "Enter" && filtered[0]) {
                e.preventDefault();
                onChange(filtered[0].id);
                close();
              }
            }}
            placeholder="Type to search…"
            autoComplete="off"
          />
          {open ? (
            <ul
              id={listId}
              role="listbox"
              className="z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-sm"
            >
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                >
                  None
                </button>
              </li>
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                    onClick={() => {
                      onChange(o.id);
                      close();
                    }}
                  >
                    {formatLabel(o)}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
              ) : null}
            </ul>
          ) : null}
          <p className="mt-1 text-xs text-gray-500">
            <Link href={createHref} className="text-sky-700 hover:underline">
              Create new {workoutTypeLabel} in catalogue
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
