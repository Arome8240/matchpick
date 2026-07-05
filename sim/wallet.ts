import type { Transaction, TransactionType, Wallet } from "./types";
import { randId, randTxHash } from "./rand";

export const STARTING_BALANCE = 5.0;
export const DEMO_ADDRESS = "0xDEMO...1234";

export function createStartingWallet(now: number): Wallet {
  const tx: Transaction = {
    id: randId("tx"),
    type: "STARTING_BALANCE",
    amount: STARTING_BALANCE,
    description: "MiniPay welcome balance",
    timestamp: now,
    txHash: randTxHash(),
    balanceAfter: STARTING_BALANCE,
  };
  return { balance: STARTING_BALANCE, transactions: [tx] };
}

export function credit(
  wallet: Wallet,
  type: TransactionType,
  amount: number,
  description: string,
  timestamp: number
): Wallet {
  const balanceAfter = Math.round((wallet.balance + amount) * 100) / 100;
  const tx: Transaction = {
    id: randId("tx"),
    type,
    amount,
    description,
    timestamp,
    txHash: randTxHash(),
    balanceAfter,
  };
  return { balance: balanceAfter, transactions: [tx, ...wallet.transactions] };
}
