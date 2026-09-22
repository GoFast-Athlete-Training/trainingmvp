"use client";

import Link from "next/link";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">No Training Manage seat</h1>
      <p className="max-w-md text-gray-600">
        Your Company account is signed in, but no training manager seat is active yet.
      </p>
      <Link href="/welcome" className="text-sm text-sky-700 underline">
        Back to sign in
      </Link>
    </div>
  );
}
