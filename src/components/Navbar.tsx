"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "DBC" },
  { href: "/dammv2", label: "DammV2" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Ensure we only use pathname after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const getLinkClassName = (isActive: boolean) =>
    `px-4 py-2 rounded-lg font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
    }`;

  // During SSR and initial render, don't mark any link as active
  // Only use pathname after mount to ensure SSR/client match
  const currentPathname = mounted ? pathname : null;

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16">
          <div className="flex items-center gap-6">
            {navItems.map(({ href, label }) => {
              // Only check if active after component has mounted
              const isActive = mounted && currentPathname === href;
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
        </div>
      </div>
    </nav>
  );
}
