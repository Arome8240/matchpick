"use client";

import { useState } from "react";
import { AppProvider } from "@/store/AppContext";
import TopBar from "@/components/TopBar";
import BottomNav, { type TabKey } from "@/components/BottomNav";
import SimPanel from "@/components/SimPanel";
import PlayScreen from "@/components/screens/PlayScreen";
import LeaderboardScreen from "@/components/screens/LeaderboardScreen";
import LeaguesScreen from "@/components/screens/LeaguesScreen";
import WalletScreen from "@/components/screens/WalletScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";

function AppShell() {
  const [tab, setTab] = useState<TabKey>("play");
  const [simPanelOpen, setSimPanelOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col bg-paper">
      <TopBar onOpenSimPanel={() => setSimPanelOpen(true)} />
      <main className="flex-1">
        {tab === "play" && <PlayScreen />}
        {tab === "leaderboard" && <LeaderboardScreen />}
        {tab === "leagues" && <LeaguesScreen />}
        {tab === "wallet" && <WalletScreen />}
        {tab === "profile" && <ProfileScreen />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
      {simPanelOpen && <SimPanel onClose={() => setSimPanelOpen(false)} />}
    </div>
  );
}

export default function MatchPickApp() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
