"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function MainNav() {
  const pathname = usePathname();

  const routes = [
    {
      href: "/",
      label: "O1 XML Parser",
    },
  ];

  const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.nav
      className="flex items-center space-x-6 border-b border-gray-800 px-6 bg-gray-900/50"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      <div className="flex items-center space-x-6 h-16">
        {routes.map((route) => (
          <motion.div key={route.href} variants={itemVariants}>
            <Link
              href={route.href}
              className={cn(
                "text-lg font-medium transition-colors hover:text-gray-100",
                pathname === route.href ? "text-gray-100" : "text-gray-400"
              )}
            >
              {route.label}
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.nav>
  );
}
