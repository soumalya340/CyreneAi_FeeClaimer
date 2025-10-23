"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export interface WalletAuthState {
  isConnected: boolean;
  walletAddress: string | null;
}

export const useWalletAuth = (): WalletAuthState => {
  const { publicKey, connected } = useWallet();

  const walletAddress = publicKey?.toString() || null;

  return {
    isConnected: connected,
    walletAddress,
  };
};