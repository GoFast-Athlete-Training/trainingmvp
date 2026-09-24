"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronRight, Layers, ListTree } from "lucide-react";
import { useState } from "react";

const PHASE_LINKS = [
  { href: "/dashboard/build", label: "Build presets" },
  { href: "/dashboard/taper", label: "Taper presets" },
  { href: "/dashboard/race-week", label: "Race week" },
] as const;

function navButtonClass(active: boolean): string {
  return `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    active ? "bg-sky-700 text-white" : "text-gray-700 hover:bg-gray-100"
  }`;
}

export default function TrainingManagerSidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const presetsActive =
    pathname === "/dashboard/presets" || pathname.startsWith("/dashboard/presets/");
  const phaseActive = PHASE_LINKS.some(
    (p) => pathname === p.href || pathname.startsWith(`${p.href}/`),
  );
  const [presetsOpen, setPresetsOpen] = useState(presetsActive || phaseActive);

  return (
    <aside className="flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => router.push("/dashboard/presets")}
        className="w-full border-b border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="mb-2 flex items-center gap-3">
          <img src="/logo.jpg" alt="GoFast" className="h-8 w-8 rounded-full" />
          <span className="text-lg font-bold text-gray-900">GoFast</span>
        </div>
        <p className="text-xs text-gray-500">Training Manage</p>
      </button>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setPresetsOpen((o) => !o);
              if (!presetsOpen) router.push("/dashboard/presets");
            }}
            className={navButtonClass(presetsActive && !phaseActive)}
          >
            {presetsOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <ListTree className="h-4 w-4 shrink-0" />
            <span className="font-medium">Plan presets</span>
          </button>
          {presetsOpen ? (
            <ul className="ml-4 space-y-0.5 border-l border-gray-200 pl-2">
              <li>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/presets")}
                  className={`${navButtonClass(pathname === "/dashboard/presets")} text-xs`}
                >
                  All presets
                </button>
              </li>
              {PHASE_LINKS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => router.push(item.href)}
                      className={`${navButtonClass(active)} text-xs`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={() => router.push("/dashboard/catalogue")}
            className={navButtonClass(
              pathname === "/dashboard/catalogue" || pathname.startsWith("/dashboard/catalogue/"),
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="font-medium">Workout catalogue</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarDays className="h-3.5 w-3.5" />
          Build or choose phase presets under each plan.
        </p>
      </div>
    </aside>
  );
}
