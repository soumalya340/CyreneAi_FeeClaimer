"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { isWalletWhitelisted } from "../config/whitelist";

export interface WalletAuthState {
  isConnected: boolean;
  isWhitelisted: boolean;
  walletAddress: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useWalletAuth = (): WalletAuthState & {
  checkWhitelist: () => void;
  clearError: () => void;
} => {
  const { publicKey, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toString() || null;
  const isWhitelisted = isWalletWhitelisted(walletAddress);

  const checkWhitelist = () => {
    setIsLoading(true);
    setError(null);

    if (!connected || !walletAddress) {
      setError("Please connect your wallet");
      setIsLoading(false);
      return;
    }

    if (!isWhitelisted) {
      setError("Your wallet is not authorized to access this application. Please contact support if you believe this is an error.");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    if (connected && walletAddress) {
      checkWhitelist();
    }
  }, [connected, walletAddress]);

  return {
    isConnected: connected,
    isWhitelisted,
    walletAddress,
    isLoading,
    error,
    checkWhitelist,
    clearError,
  };
};