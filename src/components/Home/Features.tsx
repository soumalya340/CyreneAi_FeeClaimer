"use client";

const features = [
    {
        title: "Dynamic Bonding Curve",
        description: "Track and claim fees from Meteora DBC pools with ease",
        icon: "📊",
        color: "blue",
    },
    {
        title: "DAMM V2",
        description: "Manage your DAMM V2 positions and liquidity",
        icon: "🌊",
        color: "purple",
    },
    {
        title: "Split Positions",
        description: "Split and manage your liquidity positions efficiently",
        icon: "✂️",
        color: "green",
    },
];

export default function Features() {
    return (
        <div className="py-16 bg-white dark:bg-gray-900">
            <div className="container mx-auto px-4">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
                        Powerful DeFi Tools
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:scale-105"
                            >
                                <div className="text-5xl mb-4">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
