"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/components/AppProviders";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/presets", label: "Build presets" },
  { href: "/dashboard/parent-presets", label: "Programs" },
  { href: "/dashboard/long-run-config", label: "Long run rotations" },
  { href: "/dashboard/race-week", label: "Race week" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { manager } = useAuth();

  async function handleSignOut() {
    if (auth) await signOut(auth);
    router.replace("/welcome");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Training Manage
            </p>
            <p className="text-sm text-gray-600">{manager?.email ?? "Staff"}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
                  active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
