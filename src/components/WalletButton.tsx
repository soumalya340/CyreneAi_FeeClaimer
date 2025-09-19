"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(mod => ({ default: mod.WalletMultiButton })),
  {
    ssr: false,
    loading: () => (
      <button className="wallet-adapter-button wallet-adapter-button-trigger">
        Select Wallet
      </button>
    ),
  }
);

export default WalletMultiButton;