// src/app/SplitPosition/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useSplitPositionAtomic } from "../../hooks/useSplitPositionAtomic"; // ← NEW

export default function SplitPositionPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Form State
  const [poolAddress, setPoolAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [splitPercentage, setSplitPercentage] = useState("");

  // NEW: Use atomic hook instead of DammV2Manager
  const { status, error, bundleId, bundleUrl, splitPosition, reset } =
    useSplitPositionAtomic("mainnet");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const validateAddress = (address: string): boolean => {
    try {
      new PublicKey(address.trim());
      return true;
    } catch {
      return false;
    }
  };

  const handleSplitPosition = async () => {
    if (!wallet.publicKey || !wallet.connected) {
      return;
    }

    if (!validateAddress(poolAddress) || !validateAddress(recipientAddress)) {
      return;
    }

    const percentage = parseFloat(splitPercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      return;
    }

    // NEW: Single function call - atomic bundle
    await splitPosition(
      poolAddress.trim(),
      recipientAddress.trim(),
      percentage
    );
  };

  const loading = ["building", "signing", "submitting", "confirming"].includes(
    status
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold dark:text-white">Splitter</h1>
                <p className="text-gray-500 text-sm">
                  Atomic position split via Jito
                </p>
              </div>
              <WalletMultiButton />
            </div>
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 space-y-6">
            {/* Pool Address */}
            <div>
              <label className="text-sm font-semibold dark:text-gray-300">
                Pool Address
              </label>
              <input
                type="text"
                value={poolAddress}
                onChange={(e) => setPoolAddress(e.target.value)}
                placeholder="Pool public key"
                className="w-full mt-2 px-4 py-4 bg-gray-50 dark:bg-gray-700 rounded-2xl dark:text-white"
              />
            </div>

            {/* Recipient */}
            <div>
              <label className="text-sm font-semibold dark:text-gray-300">
                Recipient Wallet
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Recipient address"
                className="w-full mt-2 px-4 py-4 bg-gray-50 dark:bg-gray-700 rounded-2xl dark:text-white"
              />
            </div>

            {/* Percentage */}
            <div>
              <label className="text-sm font-semibold dark:text-gray-300">
                Split %
              </label>
              <input
                type="number"
                value={splitPercentage}
                onChange={(e) => setSplitPercentage(e.target.value)}
                placeholder="50"
                min="1"
                max="100"
                className="w-full mt-2 px-4 py-4 bg-gray-50 dark:bg-gray-700 rounded-2xl dark:text-white"
              />
            </div>

            {/* Status Display */}
            {status !== "idle" && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <p className="text-blue-600 dark:text-blue-400 capitalize">
                  {status === "building" && "🔧 Building transactions..."}
                  {status === "signing" && "✍️ Please sign in wallet..."}
                  {status === "submitting" && "📤 Submitting to Jito..."}
                  {status === "confirming" && "⏳ Confirming bundle..."}
                  {status === "success" && "✅ Success!"}
                  {status === "error" && `❌ Error: ${error}`}
                </p>
              </div>
            )}

            {/* Success */}
            {status === "success" && bundleUrl && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <p className="text-green-700 dark:text-green-300 font-bold">
                  🎉 Position split!
                </p>
                <a
                  href={bundleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  View Bundle: {bundleId?.slice(0, 20)}...
                </a>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSplitPosition}
              disabled={loading || !wallet.connected}
              className={`w-full py-4 rounded-2xl font-bold text-lg ${
                loading || !wallet.connected
                  ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              }`}
            >
              {loading ? "Processing..." : "Split Position (Atomic)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
