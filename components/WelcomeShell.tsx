import Image from "next/image";
import type { ReactNode } from "react";

type WelcomeShellProps = {
  children?: ReactNode;
  status?: ReactNode;
  subtitle?: string;
};

export function WelcomeShell({
  children,
  status,
  subtitle = "Staff cockpit for build, taper, and race-week presets",
}: WelcomeShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-12">
      <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={72}
              height={72}
              className="mx-auto rounded-full"
              priority
            />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              GoFast
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Training Manage</h1>
            <p className="mt-2 text-base text-gray-600">{subtitle}</p>
          </div>

          {status ? (
            <div className="mt-8 flex flex-col items-center gap-3 text-center">{status}</div>
          ) : (
            <div className="mt-8">{children}</div>
          )}
        </div>
      </main>
    </div>
  );
}

export function WelcomeSpinner({ label }: { label: string }) {
  return (
    <>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-orange-500"
        role="status"
        aria-label={label}
      />
      <p className="text-base text-gray-600">{label}</p>
    </>
  );
}
