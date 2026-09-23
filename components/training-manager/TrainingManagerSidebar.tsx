"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Layers, ListTree } from "lucide-react";

const NAV = [
  { href: "/dashboard/presets", label: "Plan presets", icon: ListTree },
  { href: "/dashboard/catalogue", label: "Workout catalogue", icon: Layers },
] as const;

function navButtonClass(active: boolean): string {
  return `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    active ? "bg-sky-700 text-white" : "text-gray-700 hover:bg-gray-100"
  }`;
}

export default function TrainingManagerSidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

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
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className={navButtonClass(active)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarDays className="h-3.5 w-3.5" />
          Build preset opens the wizard: meta, build, taper, race week.
        </p>
      </div>
    </aside>
  );
}
