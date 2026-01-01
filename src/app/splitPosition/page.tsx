"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { DammV2Manager } from "../../utils/splitPostion";

export default function SplitPositionPage() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();

  // Form State
  const [poolAddress, setPoolAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [splitPercentage, setSplitPercentage] = useState("");
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  
  // Hydration fix: ensures client-only rendering for dynamic parts
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateAddress = (address: string): boolean => {
    try {
      new PublicKey(address.trim());
      return true;
    } catch {
      return false;
    }
  };

  const handleSplitPosition = async () => {
    if (!publicKey || !connected || !signTransaction) {
      setError("Please connect your wallet first");
      return;
    }

    // Validation
    if (!validateAddress(poolAddress)) {
      setError("Invalid Pool Address");
      return;
    }
    if (!validateAddress(recipientAddress)) {
      setError("Invalid Recipient Address");
      return;
    }
    const percentage = parseFloat(splitPercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      setError("Percentage must be between 1 and 100");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const manager = new DammV2Manager(connection);
      const wallet = { publicKey, signTransaction };

      const signature = await manager.splitPositionToUser(
        poolAddress.trim(),
        recipientAddress.trim(),
        percentage,
        wallet
      );

      // Optional: Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      setTransactionSignature(signature);
      setSuccessMessage("Position split successfully!");
      setPoolAddress("");
      setRecipientAddress("");
      setSplitPercentage("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // Prevent SSR of the dynamic content to fix Hydration Error
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading Interface...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          
          {/* Header & Wallet Section */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 mb-8 border border-white/20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Splitter</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Divide and transfer pool positions</p>
              </div>
              <WalletMultiButton />
            </div>

            {connected && (
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono text-center">
                  Connected: {publicKey?.toBase58()}
                </p>
              </div>
            )}
          </div>

          {/* Form Section */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="space-y-6">
              {/* Pool Address Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  Pool Address
                </label>
                <input
                  type="text"
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                  placeholder="Paste the pool public key"
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                />
              </div>

              {/* Recipient Address Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  Recipient Wallet
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="The receiver's wallet address"
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                />
              </div>

              {/* Split Percentage Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  Split Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={splitPercentage}
                    onChange={(e) => setSplitPercentage(e.target.value)}
                    placeholder="e.g. 50"
                    min="1"
                    max="100"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-700 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                    {[25, 50, 100].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSplitPercentage(val.toString())}
                        className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-md hover:bg-blue-500 hover:text-white transition-colors"
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSplitPosition}
                disabled={loading || !connected}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-3 ${
                  loading || !connected
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Confirm Split"
                )}
              </button>

              {/* Status Messages */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                  <b>Error:</b> {error}
                </div>
              )}

              {successMessage && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl">
                  <p className="text-green-700 dark:text-green-300 font-bold mb-2">🎉 {successMessage}</p>
                  <a
                    href={`https://solscan.io/tx/${transactionSignature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 underline break-all"
                  >
                    View Transaction: {transactionSignature?.slice(0, 20)}...
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}