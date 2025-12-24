"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "DBC" },
  { href: "/dammv2", label: "DammV2" },
] as const;

export default function Navbar() {
  const pathname = usePathname();

  const getLinkClassName = (isActive: boolean) =>
    `px-4 py-2 rounded-lg font-semibold tracking-wider uppercase text-sm transition-colors text-white ${
      isActive
        ? "bg-gray-200 dark:bg-gray-700"
        : "hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16">
          <div className="flex items-center gap-6">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={getLinkClassName(pathname === href)}
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
