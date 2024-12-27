"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav() {
  const pathname = usePathname();

  const routes = [
    {
      href: "/",
      label: "Home",
    },
    {
      href: "/browser",
      label: "File Browser",
    },
    {
      href: "/apply",
      label: "Apply Changes",
    },
  ];

  return (
    <nav className="flex items-center space-x-6 border-b border-gray-800 px-6 bg-gray-900/50">
      <div className="flex items-center space-x-6 h-16">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-gray-100",
              pathname === route.href ? "text-gray-100" : "text-gray-400"
            )}
          >
            {route.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
