import { CircleCheckBig, Coins, Flame, Handshake, Medal, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import type { BadgeIconKey } from "@/sim/selectors";

export const BADGE_ICONS: Record<BadgeIconKey, LucideIcon> = {
  check: CircleCheckBig,
  target: Target,
  flame: Flame,
  medal: Medal,
  trophy: Trophy,
  zap: Zap,
  coins: Coins,
  handshake: Handshake,
};
