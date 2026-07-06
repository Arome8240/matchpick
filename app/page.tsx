"use client";

import dynamic from "next/dynamic";
import { Goal } from "lucide-react";

const MatchPickApp = dynamic(() => import("@/components/MatchPickApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center bg-pitch-900">
      <div className="flex flex-col items-center gap-3">
        <Goal size={32} className="text-gold-300" />
        <span className="text-sm font-medium text-white/70">Loading MatchPick…</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MatchPickApp />;
}
