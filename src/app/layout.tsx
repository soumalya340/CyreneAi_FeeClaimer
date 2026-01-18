import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "../contexts/NetworkContext";
import WalletContextProvider from "../components/WalletContextProvider";
import Navbar from "../components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solana DeFi Power Suite | Meteora Protocol",
  description: "Advanced DeFi toolkit for Solana - Track, manage, and claim fees from Meteora Dynamic Bonding Curves, DAMM pools, and liquidity positions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NetworkProvider>
          <WalletContextProvider>
            <Navbar />
            {children}
          </WalletContextProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
