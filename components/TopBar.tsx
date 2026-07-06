"use client";

import { Goal, Settings, Wallet } from "lucide-react";
import { useAppState } from "@/store/AppContext";
import { formatMoney } from "@/lib/format";
import StreakFlame from "@/components/ui/StreakFlame";

export default function TopBar({ onOpenSimPanel }: { onOpenSimPanel: () => void }) {
  const state = useAppState();

  return (
    <header className="sticky top-0 z-30 bg-pitch-900 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Goal size={20} className="text-gold-300" />
          <span className="text-base font-bold tracking-tight">MatchPick</span>
        </div>
        <div className="flex items-center gap-2">
          <StreakFlame streak={state.user.streak} />
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
            <Wallet size={13} className="text-gold-300" />
            {formatMoney(state.wallet.balance)}
          </div>
          <button
            type="button"
            onClick={onOpenSimPanel}
            aria-label="Simulation controls"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 active:bg-white/10"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
