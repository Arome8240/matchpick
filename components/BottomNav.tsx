import { Goal, Trophy, Users, Wallet, User, type LucideIcon } from "lucide-react";

export type TabKey = "play" | "leaderboard" | "leagues" | "wallet" | "profile";

const TABS: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "play", label: "Play", Icon: Goal },
  { key: "leaderboard", label: "Board", Icon: Trophy },
  { key: "leagues", label: "Leagues", Icon: Users },
  { key: "wallet", label: "Wallet", Icon: Wallet },
  { key: "profile", label: "Profile", Icon: User },
];

export default function BottomNav({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-pitch-900/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)]"
            >
              <tab.Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className={`transition-transform ${isActive ? "scale-110 text-pitch-800" : "text-ink-soft/60"}`}
              />
              <span className={`text-[11px] font-medium ${isActive ? "text-pitch-800" : "text-ink-soft"}`}>
                {tab.label}
              </span>
              {isActive && <span className="mt-0.5 h-1 w-1 rounded-full bg-gold-500" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
