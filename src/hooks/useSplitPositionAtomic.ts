"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  executeAtomicSplit,
  AtomicSplitResult,
} from "@/lib/dammv2/atomic-split";
import { NetworkType, JitoClient } from "@/lib/dammv2/jito-client";

export type SplitStatus =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export interface UseSplitPositionAtomicReturn {
  // State
  status: SplitStatus;
  error: string | null;
  result: AtomicSplitResult | null;
  bundleStatus: string | null;
  bundleId: string | null;
  bundleUrl: string | null;

  // Actions
  splitPosition: (
    poolAddress: string,
    recipientAddress: string,
    splitPercent: number
  ) => Promise<AtomicSplitResult | null>;
  checkBundleStatus: () => Promise<void>;
  reset: () => void;
}

export function useSplitPositionAtomic(
  network: NetworkType = "mainnet"
): UseSplitPositionAtomicReturn {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [status, setStatus] = useState<SplitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AtomicSplitResult | null>(null);
  const [bundleStatus, setBundleStatus] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setBundleStatus(null);
  }, []);

  const splitPosition = useCallback(
    async (
      poolAddress: string,
      recipientAddress: string,
      splitPercent: number
    ): Promise<AtomicSplitResult | null> => {
      if (!wallet.publicKey || !wallet.signAllTransactions) {
        setError("Please connect your wallet");
        return null;
      }

      try {
        reset();
        setStatus("building");

        console.log("🚀 Starting atomic position split...");
        console.log("  Pool:", poolAddress);
        console.log("  Recipient:", recipientAddress);
        console.log("  Split %:", splitPercent);

        setStatus("signing");

        const splitResult = await executeAtomicSplit({
          poolAddress,
          recipientAddress,
          splitPercent,
          wallet: {
            publicKey: wallet.publicKey,
            signAllTransactions: wallet.signAllTransactions,
          },
          connection,
          network,
        });

        setStatus("submitting");
        setResult(splitResult);
        setStatus("success");

        return splitResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        setStatus("error");
        console.error("Split position error:", err);
        return null;
      }
    },
    [wallet, connection, network, reset]
  );

  const checkBundleStatus = useCallback(async () => {
    if (!result?.bundleId) {
      return;
    }

    try {
      const jitoClient = new JitoClient(network);
      const statusResponse = await jitoClient.getBundleStatus(result.bundleId);

      if (statusResponse.result?.value?.[0]) {
        const bundle = statusResponse.result.value[0];
        setBundleStatus(bundle.confirmation_status);
      }
    } catch (err) {
      console.error("Error checking bundle status:", err);
    }
  }, [result?.bundleId, network]);

  return {
    status,
    error,
    result,
    bundleStatus,
    bundleId: result?.bundleId || null,
    bundleUrl: result?.bundleUrl || null,
    splitPosition,
    checkBundleStatus,
    reset,
  };
}
