"use client";

import React, { createContext, useContext, useEffect, useReducer } from "react";
import type { AppState, Outcome, Score } from "@/sim/types";
import {
  advanceTime,
  createLeague,
  generateReferralLink,
  initAppState,
  joinLeagueByCode,
  nextMatchday,
  resetAll,
  resetSeason,
  setActivePlayerCount,
  setDailyFreePick,
  setLuckBias,
  setUserExactScore,
  setUserPick,
  settleMatchday,
  simulateFriendJoining,
  simulateFullSeason,
  submitUserPicks,
} from "@/sim/engine";
import { storage } from "@/sim/storage";

type Action =
  | { type: "SET_PICK"; fixtureId: string; outcome: Outcome }
  | { type: "SET_EXACT_SCORE"; fixtureId: string; score: Score | undefined }
  | { type: "SUBMIT_PICKS" }
  | { type: "ADVANCE_TIME"; hours: number }
  | { type: "SETTLE_MATCHDAY" }
  | { type: "NEXT_MATCHDAY" }
  | { type: "SIMULATE_SEASON" }
  | { type: "RESET_SEASON" }
  | { type: "RESET_ALL" }
  | { type: "SET_LUCK_BIAS"; value: number }
  | { type: "SET_ACTIVE_PLAYERS"; value: number }
  | { type: "CREATE_LEAGUE"; name: string }
  | { type: "JOIN_LEAGUE"; code: string }
  | { type: "SIMULATE_REFERRAL" }
  | { type: "SET_DAILY_FREE_PICK"; outcome: Outcome };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PICK":
      return setUserPick(state, action.fixtureId, action.outcome);
    case "SET_EXACT_SCORE":
      return setUserExactScore(state, action.fixtureId, action.score);
    case "SUBMIT_PICKS":
      return submitUserPicks(state);
    case "ADVANCE_TIME":
      return advanceTime(state, action.hours);
    case "SETTLE_MATCHDAY":
      return settleMatchday(state);
    case "NEXT_MATCHDAY":
      return nextMatchday(state);
    case "SIMULATE_SEASON":
      return simulateFullSeason(state);
    case "RESET_SEASON":
      return resetSeason(state);
    case "RESET_ALL":
      return resetAll();
    case "SET_LUCK_BIAS":
      return setLuckBias(state, action.value);
    case "SET_ACTIVE_PLAYERS":
      return setActivePlayerCount(state, action.value);
    case "CREATE_LEAGUE":
      return createLeague(state, action.name);
    case "JOIN_LEAGUE":
      return joinLeagueByCode(state, action.code);
    case "SIMULATE_REFERRAL":
      return simulateFriendJoining(state);
    case "SET_DAILY_FREE_PICK":
      return setDailyFreePick(state, action.outcome);
    default:
      return state;
  }
}

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<React.Dispatch<Action> | null>(null);

function loadInitialState(): AppState {
  const saved = storage.get<AppState | null>("state", null);
  return saved ?? initAppState();
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppState, loadInitialState);

  useEffect(() => {
    storage.set("state", state);
  }, [state]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

export function useAppDispatch(): React.Dispatch<Action> {
  const ctx = useContext(AppDispatchContext);
  if (!ctx) throw new Error("useAppDispatch must be used within AppProvider");
  return ctx;
}

export { generateReferralLink };
