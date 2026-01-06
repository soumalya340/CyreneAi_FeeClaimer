"use client";

import React, { useState, useEffect } from "react";
import { useSplitPositionAtomic, SplitStatus } from "@/hooks/useSplitPositionAtomic";

interface SplitPositionModalProps {
  poolAddress: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (bundleId: string) => void;
}

const STATUS_MESSAGES: Record<SplitStatus, string> = {
  idle: "Ready to split position",
  building: "Building transactions...",
  signing: "Please approve in your wallet...",
  submitting: "Submitting bundle to Jito...",
  confirming: "Confirming bundle...",
  success: "Position split successful! 🎉",
  error: "Error occurred",
};

const STATUS_ICONS: Record<SplitStatus, string> = {
  idle: "📋",
  building: "🔨",
  signing: "✍️",
  submitting: "📤",
  confirming: "⏳",
  success: "✅",
  error: "❌",
};

export function SplitPositionModal({
  poolAddress,
  isOpen,
  onClose,
  onSuccess,
}: SplitPositionModalProps) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [splitPercent, setSplitPercent] = useState(50);

  const {
    status,
    error,
    result,
    bundleStatus,
    splitPosition,
    checkBundleStatus,
    reset,
  } = useSplitPositionAtomic("mainnet");

  // Poll for bundle status after success
  useEffect(() => {
    if (status === "success" && result?.bundleId) {
      const interval = setInterval(checkBundleStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [status, result?.bundleId, checkBundleStatus]);

  // Call onSuccess callback
  useEffect(() => {
    if (status === "success" && result?.bundleId && onSuccess) {
      onSuccess(result.bundleId);
    }
  }, [status, result?.bundleId, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientAddress || splitPercent <= 0 || splitPercent > 100) {
      return;
    }

    await splitPosition(poolAddress, recipientAddress, splitPercent);
  };

  const handleClose = () => {
    reset();
    setRecipientAddress("");
    setSplitPercent(50);
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = ["building", "signing", "submitting", "confirming"].includes(
    status
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            🔀 Split Position (Atomic)
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Banner */}
        <div
          className={`mb-6 p-4 rounded-lg ${
            status === "error"
              ? "bg-red-500/20 border border-red-500/50"
              : status === "success"
              ? "bg-green-500/20 border border-green-500/50"
              : "bg-blue-500/20 border border-blue-500/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{STATUS_ICONS[status]}</span>
            <span className="text-white font-medium">
              {STATUS_MESSAGES[status]}
            </span>
          </div>
          {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
          {bundleStatus && (
            <p className="mt-2 text-green-400 text-sm">
              Bundle status: {bundleStatus}
            </p>
          )}
        </div>

        {/* Success Result */}
        {status === "success" && result && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-white font-semibold mb-3">
              🎉 Bundle Submitted!
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Bundle ID:</span>
                <span className="text-white font-mono text-xs">
                  {result.bundleId.slice(0, 16)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">NFT Mint:</span>
                <span className="text-white font-mono text-xs">
                  {result.secondPositionNftMint.slice(0, 16)}...
                </span>
              </div>
            </div>
            <a
              href={result.bundleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg transition-colors"
            >
              View on Jito Explorer →
            </a>
          </div>
        )}

        {/* Form */}
        {status !== "success" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pool Address (read-only) */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Pool Address
              </label>
              <input
                type="text"
                value={poolAddress}
                disabled
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm"
              />
            </div>

            {/* Recipient Address */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter Solana wallet address..."
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Split Percentage */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Split Percentage: {splitPercent}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                disabled={isLoading}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h4 className="text-white font-medium mb-2">
                ⚡ Atomic Bundle (5 transactions)
              </h4>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Create new position</li>
                <li>Split {splitPercent}% liquidity</li>
                <li>Create recipient's token account</li>
                <li>Transfer position NFT</li>
                <li>Jito tip (0.0001 SOL)</li>
              </ol>
              <p className="mt-2 text-xs text-purple-400">
                All transactions execute atomically - all succeed or all fail!
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !recipientAddress}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all ${
                isLoading || !recipientAddress
                  ? "bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {STATUS_MESSAGES[status]}
                </span>
              ) : (
                "🚀 Split Position (1 Click)"
              )}
            </button>
          </form>
        )}

        {/* Close button for success state */}
        {status === "success" && (
          <button
            onClick={handleClose}
            className="w-full py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}