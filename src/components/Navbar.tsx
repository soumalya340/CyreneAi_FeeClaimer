"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/createCoin", label: "Create Coin" },
  { href: "/dbc", label: "DBC" },
  { href: "/dammv2", label: "DammV2" },
  { href: "/splitPosition", label: "Split Position" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { network, toggleNetwork } = useNetwork();

  // Ensure we only use pathname after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const getLinkClassName = (isActive: boolean) =>
    `px-4 py-2 rounded-lg font-medium transition-colors ${isActive
      ? "bg-blue-600 text-white"
      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
    }`;

  if (!mounted) {
    // SSR/initial render: show navbar without active states
    return (
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              {navItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-4 py-2 rounded-lg font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={getLinkClassName(isActive)}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {network === "mainnet" ? "Mainnet" : "Devnet"}
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={network === "mainnet"}
                onChange={toggleNetwork}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>
    </nav>
  );
}
