"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Network = "mainnet" | "devnet";

interface NetworkContextType {
    network: Network;
    toggleNetwork: () => void;
    endpoint: string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};

interface NetworkProviderProps {
    children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({
    children,
}) => {
    const [network, setNetwork] = useState<Network>("mainnet");

    const toggleNetwork = useCallback(() => {
        setNetwork((prev) => (prev === "mainnet" ? "devnet" : "mainnet"));
    }, []);

    const endpoint =
        network === "mainnet"
            ? "https://mainnet.helius-rpc.com/?api-key=7d2734a8-f8b4-4c00-ade1-4034d4d3eb75"
            : "https://devnet.helius-rpc.com/?api-key=7d2734a8-f8b4-4c00-ade1-4034d4d3eb75";

    return (
        <NetworkContext.Provider value={{ network, toggleNetwork, endpoint }}>
            {children}
        </NetworkContext.Provider>
    );
};
