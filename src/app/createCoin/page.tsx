"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { TokenCreator } from "../../utils/tokenCreator";
import { useNetwork } from "../../contexts/NetworkContext";

export default function CreateCoinPage() {
    const { connection } = useConnection();
    const { publicKey, connected, signTransaction } = useWallet();
    const { network } = useNetwork();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
    const [mintAddress, setMintAddress] = useState<string | null>(null);

    // Form state
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState("9");
    const [initialSupply, setInitialSupply] = useState("");
    const [tokenDescription, setTokenDescription] = useState("");
    const [tokenUri, setTokenUri] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleCreateToken = async () => {
        if (!connected || !publicKey) {
            setError("Please connect your wallet first");
            return;
        }

        if (!signTransaction) {
            setError("Wallet does not support transaction signing");
            return;
        }

        if (!tokenName || !tokenSymbol) {
            setError("Please fill in token name and symbol");
            return;
        }

        if (!tokenUri) {
            setError("Please provide a metadata URI for your token");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setTransactionSignature(null);
        setMintAddress(null);

        try {
            const tokenCreator = new TokenCreator(connection);

            const wallet = {
                publicKey,
                signTransaction,
            };

            const result = await tokenCreator.createToken(
                {
                    name: tokenName,
                    symbol: tokenSymbol,
                    uri: tokenUri,
                    description: tokenDescription || undefined,
                    decimals: parseInt(tokenDecimals),
                    initialSupply: initialSupply ? parseFloat(initialSupply) : 0,
                },
                wallet
            );

            setMintAddress(result.mintAddress);
            setTransactionSignature(result.transactionSignature);
            setSuccessMessage(
                `Token created successfully! Mint address: ${result.mintAddress}`
            );

            // Reset form
            setTokenName("");
            setTokenSymbol("");
            setTokenDecimals("9");
            setInitialSupply("");
            setTokenDescription("");
            setTokenUri("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create token");
            console.error("Token creation error:", err);
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
                            Create Your Token
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                            Launch your own SPL token on Solana
                        </p>

                        {mounted && (
                            <div className="mb-4">
                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${network === "mainnet"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"
                                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                                    }`}>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <circle cx="10" cy="10" r="3" />
                                    </svg>
                                    Deploying on {network === "mainnet" ? "Mainnet" : "Devnet"}
                                </span>
                            </div>
                        )}

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
                                        <strong>Note:</strong> This feature allows you to create a
                                        new SPL token on the Solana blockchain. Make sure you have
                                        enough SOL for transaction fees. Use the network toggle in the navbar to switch between Mainnet and Devnet.
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
                            Token Information
                        </h2>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label
                                        htmlFor="tokenName"
                                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                    >
                                        Token Name *
                                    </label>
                                    <input
                                        id="tokenName"
                                        type="text"
                                        value={tokenName}
                                        onChange={(e) => setTokenName(e.target.value)}
                                        placeholder="e.g., My Token"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="tokenSymbol"
                                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                    >
                                        Token Symbol *
                                    </label>
                                    <input
                                        id="tokenSymbol"
                                        type="text"
                                        value={tokenSymbol}
                                        onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                                        placeholder="e.g., MTK"
                                        maxLength={10}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label
                                        htmlFor="tokenDecimals"
                                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                    >
                                        Decimals
                                    </label>
                                    <input
                                        id="tokenDecimals"
                                        type="number"
                                        value={tokenDecimals}
                                        onChange={(e) => setTokenDecimals(e.target.value)}
                                        min="0"
                                        max="9"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="initialSupply"
                                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                    >
                                        Initial Supply *
                                    </label>
                                    <input
                                        id="initialSupply"
                                        type="number"
                                        value={initialSupply}
                                        onChange={(e) => setInitialSupply(e.target.value)}
                                        placeholder="e.g., 1000000"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="tokenUri"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    Metadata URI *
                                </label>
                                <input
                                    id="tokenUri"
                                    type="url"
                                    value={tokenUri}
                                    onChange={(e) => setTokenUri(e.target.value)}
                                    placeholder="https://example.com/metadata.json"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    URL to your token&apos;s metadata JSON file
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="tokenDescription"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    Description (Optional)
                                </label>
                                <textarea
                                    id="tokenDescription"
                                    value={tokenDescription}
                                    onChange={(e) => setTokenDescription(e.target.value)}
                                    placeholder="Describe your token..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <button
                                onClick={handleCreateToken}
                                disabled={loading || !connected}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
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
                                {loading ? "Creating Token..." : "Create Token"}
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
                            {mintAddress && (
                                <div className="mt-3 space-y-2">
                                    <div>
                                        <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                                            Mint Address:
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-mono break-all">
                                                {mintAddress}
                                            </code>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(mintAddress)}
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
                                                href={`https://solscan.io/token/${mintAddress}${network === "devnet" ? "?cluster=devnet" : ""
                                                    }`}
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
                                    {transactionSignature && (
                                        <div>
                                            <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                                                Transaction ({network === "mainnet" ? "Mainnet" : "Devnet"}):
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-mono break-all">
                                                    {transactionSignature}
                                                </code>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(transactionSignature)}
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
                                                    href={`https://solscan.io/tx/${transactionSignature}${network === "devnet" ? "?cluster=devnet" : ""
                                                        }`}
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
                        </div>
                    )}

                    <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8 border border-purple-200 dark:border-purple-800">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            💡 Token Creation Tips
                        </h3>
                        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="text-purple-600 dark:text-purple-400">•</span>
                                <span>Choose a unique and memorable token name and symbol</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-600 dark:text-purple-400">•</span>
                                <span>Standard decimal value is 9 (same as SOL)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-600 dark:text-purple-400">•</span>
                                <span>Ensure you have enough SOL for transaction fees (~0.01 SOL)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-600 dark:text-purple-400">•</span>
                                <span>Initial supply can be minted to your wallet</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
