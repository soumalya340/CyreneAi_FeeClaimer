"use client";

export default function Hero() {
    return (
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 dark:from-purple-900 dark:via-blue-900 dark:to-cyan-900">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="relative container mx-auto px-4 py-20">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
                        Solana DeFi Power Suite
                    </h1>
                    <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
                        Advanced toolkit for managing Meteora Protocol positions and fees
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 mb-12">
                        <div className="bg-white/10 backdrop-blur-md rounded-lg px-6 py-3 border border-white/20">
                            <p className="text-white font-semibold">🚀 Track Fees</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-lg px-6 py-3 border border-white/20">
                            <p className="text-white font-semibold">💰 Claim Rewards</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-lg px-6 py-3 border border-white/20">
                            <p className="text-white font-semibold">⚡ Manage Pools</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
