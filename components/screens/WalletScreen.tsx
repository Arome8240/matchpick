"use client";

import { Dices, Gift, Handshake, Trophy, type LucideIcon } from "lucide-react";
import { useAppState } from "@/store/AppContext";
import { formatMoney, formatSimTimestamp } from "@/lib/format";
import type { TransactionType } from "@/sim/types";
import PredictionCard from "@/components/PredictionCard";

const TYPE_META: Record<TransactionType, { Icon: LucideIcon; label: string }> = {
  STARTING_BALANCE: { Icon: Gift, label: "Welcome bonus" },
  PRIZE_RANK: { Icon: Trophy, label: "Prize pool" },
  PRIZE_DRAW: { Icon: Dices, label: "Random draw" },
  REFERRAL_BONUS: { Icon: Handshake, label: "Referral bonus" },
};

export default function WalletScreen() {
  const state = useAppState();
  const { wallet, user } = state;

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h1 className="mb-3 text-lg font-bold text-ink">Wallet</h1>

      <div className="rounded-2xl bg-pitch-900 p-5 text-white">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">cUSD balance · MiniPay</p>
        <p className="mt-1 text-4xl font-extrabold text-gold-300">{formatMoney(wallet.balance)}</p>
        <p className="mt-2 font-mono text-xs text-white/50">{user.address}</p>
      </div>

      <div className="mt-4">
        <PredictionCard />
      </div>

      <h2 className="mb-2 mt-5 text-sm font-bold text-ink">Transaction history</h2>
      {wallet.transactions.length === 0 ? (
        <p className="text-xs text-ink-soft">No transactions yet.</p>
      ) : (
        <div className="space-y-1.5">
          {wallet.transactions.map((tx) => {
            const meta = TYPE_META[tx.type];
            return (
              <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-ink/5 bg-white px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-dim text-pitch-800">
                  <meta.Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{tx.description}</p>
                  <p className="text-[10px] text-ink-soft">
                    {formatSimTimestamp(tx.timestamp)} · <span className="font-mono">{tx.txHash.slice(0, 10)}…</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-pitch-700">+{formatMoney(tx.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
