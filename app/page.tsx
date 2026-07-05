"use client";

import dynamic from "next/dynamic";

const MatchPickApp = dynamic(() => import("@/components/MatchPickApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center bg-pitch-900">
      <div className="flex flex-col items-center gap-3">
        <span className="text-3xl">⚽</span>
        <span className="text-sm font-medium text-white/70">Loading MatchPick…</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MatchPickApp />;
}
