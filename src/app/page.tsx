"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { FeeClaimer } from "../utils/feeClaimer";

interface PoolInfo {
  publicKey: PublicKey;
  baseMint?: PublicKey;
  quoteMint?: PublicKey;
  creator?: PublicKey;
}

interface FeeMetrics {
  current: {
    partnerBaseFee: string;
    partnerQuoteFee: string;
    creatorBaseFee: string;
    creatorQuoteFee: string;
  };
  total: {
    totalTradingBaseFee: string;
    totalTradingQuoteFee: string;
  };
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [tokenAddress, setTokenAddress] = useState("");
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [feeMetrics, setFeeMetrics] = useState<FeeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<
    string | null
  >(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateTokenAddress = (address: string): boolean => {
    // Basic validation for Solana address format
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address.trim());
  };

  const handleTrackFees = async () => {
    const trimmedAddress = tokenAddress.trim();

    if (!trimmedAddress) {
      setError("Please enter a token address");
      return;
    }

    if (!validateTokenAddress(trimmedAddress)) {
      setError("Please enter a valid Solana token address");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setPoolInfo(null);
    setFeeMetrics(null);

    try {
      const feeClaimer = new FeeClaimer(connection);

      const pool = await feeClaimer.getPoolByBaseMint(trimmedAddress);
      setPoolInfo(pool);

      const metrics = await feeClaimer.getPoolFeeMetrics(
        pool.publicKey.toString()
      );
      setFeeMetrics(metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track fees");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFees = async () => {
    if (!poolInfo) {
      setError("Please track fees first before refreshing");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const feeClaimer = new FeeClaimer(connection);
      const metrics = await feeClaimer.getPoolFeeMetrics(
        poolInfo.publicKey.toString()
      );
      setFeeMetrics(metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh fees");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimFees = async () => {
    if (!poolInfo || !publicKey || !connected) {
      setError("Please connect wallet and track fees first");
      return;
    }

    if (!signTransaction) {
      setError("Wallet does not support transaction signing");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const feeClaimer = new FeeClaimer(connection);

      const wallet = {
        publicKey,
        signTransaction,
      };

      const signature = await feeClaimer.claimPartnerTradingFee(
        poolInfo.publicKey.toString(),
        wallet,
        feeMetrics?.current.partnerQuoteFee
      );

      setTransactionSignature(signature);
      setSuccessMessage("Fees claimed successfully!");

      // Refresh the fee metrics
      const metrics = await feeClaimer.getPoolFeeMetrics(
        poolInfo.publicKey.toString()
      );
      setFeeMetrics(metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim fees");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Meteora DBC Fee Claimer
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              Track and claim fees from Meteora Dynamic Bonding Curve pools
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-left">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>How to use:</strong> Enter your token&apos;s base
                    mint address (the token you launched on Meteora DBC) to
                    track and claim trading fees from your pool. Make sure
                    you&apos;re connected with the wallet that created the
                    token.
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Wallet Connection
              </h2>
              {mounted && <WalletMultiButton />}
            </div>

            {connected && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-green-700 dark:text-green-300">
                  ✓ Wallet connected: {publicKey?.toString().slice(0, 8)}...
                  {publicKey?.toString().slice(-8)}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              Track Pool Fees
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="tokenAddress"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Token Base Mint Address
                </label>
                <input
                  id="tokenAddress"
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="e.g., 9E53R3NZA9B5RRJjbBGSveYadcKxzjNFmNF3fEtmE8Bw"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                onClick={handleTrackFees}
                disabled={loading || !tokenAddress.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                {loading ? "Loading..." : "Track Fees"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-green-700 dark:text-green-300 font-medium">
                  {successMessage}
                </p>
              </div>
              {transactionSignature && (
                <div className="mt-3">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                    Transaction Signature:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-mono break-all">
                      {transactionSignature}
                    </code>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(transactionSignature)
                      }
                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                      title="Copy to clipboard"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <a
                      href={`https://solscan.io/tx/${transactionSignature}?cluster=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                      title="View on Solscan"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {poolInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                Pool Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Pool Address
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                    {poolInfo.publicKey.toString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Creator
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                    {poolInfo.creator?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Base Mint
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                    {poolInfo.baseMint?.toString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Quote Mint
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                    {poolInfo.quoteMint?.toString() || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {feeMetrics && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Unclaimed Fees
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={handleRefreshFees}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {loading ? "Loading..." : "Refresh"}
                  </button>
                  {connected && (
                    <button
                      onClick={handleClaimFees}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      {loading ? "Claiming..." : "Claim Fees"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Current Fees
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Partner Base Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.current.partnerBaseFee}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Partner Quote Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.current.partnerQuoteFee}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Creator Base Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.current.creatorBaseFee}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Creator Quote Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.current.creatorQuoteFee}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Total Trading Fees
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Total Base Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.total.totalTradingBaseFee}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Total Quote Fee:
                      </span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {feeMetrics.total.totalTradingQuoteFee}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
