"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { DammV2Manager, PositionInfo } from "../../utils/dammv2Manager";

// --- Sub-Component: Individual Position Card ---
const PositionCard = ({ 
  position, 
  index, 
  onClaim, 
  isClaiming 
}: { 
  position: PositionInfo, 
  index: number, 
  onClaim: (p: PositionInfo) => void, 
  isClaiming: boolean 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-6)}`;

  // Helper for data rows
  const DataRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 px-2 py-0.5 rounded">
        {value}
      </span>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg">
      
      {/* Clickable Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer p-5 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${
            isExpanded 
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
              : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
          }`}>
            {index + 1}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Position #{index + 1}
            </h3>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              ID: {formatAddress(position.position.toString())}
            </p>
          </div>
        </div>

        {/* Chevron Icon */}
        <div className={`transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Col: Pool Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Pool Configuration
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                {position.poolInfo && (
                  <>
                    <DataRow label="Pool Address" value={formatAddress(position.poolInfo.poolAddress.toString())} />
                    <DataRow label="Token A Mint" value={formatAddress(position.poolInfo.tokenAMint.toString())} />
                    <DataRow label="Token B Mint" value={formatAddress(position.poolInfo.tokenBMint.toString())} />
                    <DataRow label="NFT Account" value={formatAddress(position.positionNftAccount.toString())} />
                  </>
                )}
              </div>
            </div>

            {/* Right Col: Fees & Action */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Accumulated Fees
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-3 text-center">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">Token A</div>
                    <div className="font-mono font-bold text-gray-800 dark:text-gray-100 truncate">
                      {position.unclaimedFees?.feeTokenA || "0"}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-3 text-center">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">Token B</div>
                    <div className="font-mono font-bold text-gray-800 dark:text-gray-100 truncate">
                      {position.unclaimedFees?.feeTokenB || "0"}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent clicking button from closing the accordion
                  onClaim(position);
                }}
                disabled={
                  isClaiming ||
                  (position.unclaimedFees?.feeTokenA === "0" && position.unclaimedFees?.feeTokenB === "0")
                }
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-800 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
              >
                {isClaiming ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Claim Rewards"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- Main Page Component ---

export default function DammV2Page() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [claimingPosition, setClaimingPosition] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && connected && publicKey) {
      handleLoadPositions();
    } else if (mounted) {
      setPositions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, connected, publicKey]);

  const handleLoadPositions = async () => {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const manager = new DammV2Manager(connection);
      const userPositions = await manager.getUserPositions(publicKey);
      setPositions(userPositions);
      if (userPositions.length === 0) {
        setError("No DAMM v2 positions found for this wallet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimFees = async (position: PositionInfo) => {
    if (!publicKey || !connected) {
      setError("Please connect wallet first");
      return;
    }
    if (!signTransaction) {
      setError("Wallet does not support transaction signing");
      return;
    }
    setClaimingPosition(position.position.toString());
    setError(null);
    setSuccessMessage(null);
    setTransactionSignature(null);
    try {
      const manager = new DammV2Manager(connection);
      const wallet = { publicKey, signTransaction };
      const signature = await manager.claimPositionFee(position, wallet);
      setTransactionSignature(signature);
      setSuccessMessage(`Fees claimed successfully for position ${position.position.toString().slice(0, 8)}...`);
      await handleLoadPositions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim fees");
    } finally {
      setClaimingPosition(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-2 sm:px-6 font-sans">
        <div className="max-w-3xl mx-auto space-y-10">
          <header className="relative text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 shadow-lg mb-2">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 32 32" stroke="currentColor">
                  <circle cx="16" cy="16" r="14" strokeWidth="2" className="opacity-40" />
                  <path d="M10 18l4-4 4 4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 22V14" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">My DAMM v2 Positions</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400">Expand a position to view details and claim your rewards.</p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-2 sm:px-6 font-sans transition-colors duration-500">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Enhanced Header Section */}
        <header className="relative text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 shadow-lg mb-2">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 32 32" stroke="currentColor">
                <circle cx="16" cy="16" r="14" strokeWidth="2" className="opacity-40" />
                <path d="M10 18l4-4 4 4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 22V14" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">My DAMM v2 Positions</h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">Expand a position to view details and claim your rewards.</p>
        </header>

        {/* Action Bar */}
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="scale-100 transform transition hover:scale-105">
              {mounted && <WalletMultiButton />}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3 shadow">
                <span className="text-red-500">⚠</span>
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow">
                <p className="text-green-800 dark:text-green-200 font-medium text-sm text-center">{successMessage}</p>
                {transactionSignature && (
                  <div className="text-center mt-2">
                    <a
                      href={`https://solscan.io/tx/${transactionSignature}?cluster=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 underline hover:text-green-800 dark:hover:text-green-300 transition-colors"
                    >
                      View on Solscan
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="flex space-x-2">
                <div className="h-4 w-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="h-4 w-4 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="h-4 w-4 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-gray-600 dark:text-gray-300 text-base mt-2">Loading positions...</span>
            </div>
          </div>
        )}

        {/* Positions List */}
        {!loading && connected && positions.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-base font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Active Positions <span className="ml-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">{positions.length}</span>
              </span>
              <button onClick={handleLoadPositions} className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded transition-all px-2 py-1">
                Refresh
              </button>
            </div>
            <div className="space-y-6">
              {positions.map((position, index) => (
                <PositionCard
                  key={position.position.toString()}
                  position={position}
                  index={index}
                  onClaim={handleClaimFees}
                  isClaiming={claimingPosition === position.position.toString()}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && connected && positions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" fill="none" viewBox="0 0 48 48" stroke="currentColor">
              <circle cx="24" cy="24" r="22" strokeWidth="2" className="opacity-30" />
              <path d="M16 28l8-8 8 8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 36V20" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <h2 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">No Positions Found</h2>
            <p className="text-gray-400 dark:text-gray-600 text-sm">You don&apos;t have any DAMM v2 positions in this wallet.</p>
          </div>
         )}
       </div>
     </div>
   );
 }