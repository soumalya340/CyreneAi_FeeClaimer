"use client";

import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWalletAuth } from "../hooks/useWalletAuth";

interface NetsepioCLaimProps {
  onAccessGranted: () => void;
}

const NetsepioClaim: React.FC<NetsepioCLaimProps> = ({ onAccessGranted }) => {
  const {
    isConnected,
    isWhitelisted,
    walletAddress,
    isLoading,
    error,
    clearError
  } = useWalletAuth();

  React.useEffect(() => {
    if (isConnected && isWhitelisted) {
      onAccessGranted();
    }
  }, [isConnected, isWhitelisted, onAccessGranted]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Netsepio Fee Claimer
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Connect your authorized wallet to access the fee claiming system
            </p>
          </div>

          {/* Connection Status */}
          {isConnected && (
            <div className="mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
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
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    Wallet Connected
                  </span>
                </div>
                <p className="text-green-600 dark:text-green-400 text-sm font-mono">
                  {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-600 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-700 dark:text-red-300 font-medium mb-1">
                      Access Denied
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </p>
                    <button
                      onClick={clearError}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm mt-2 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-600"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="text-blue-700 dark:text-blue-300">
                    Verifying wallet authorization...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connection Button */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Instructions:
              </h3>
              <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Connect your Solana wallet using the button above</li>
                <li>Ensure your wallet address is on the authorized list</li>
                <li>Wait for verification to complete</li>
                <li>Access will be granted automatically if authorized</li>
              </ol>
            </div>

            {/* Support Contact */}
            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Need access? Contact support with your wallet address
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetsepioClaim;