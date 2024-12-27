"use client";

import { MainNav } from "@/components/ui/nav";
import { Toaster } from "sonner";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>O1 XML Parser</title>
        <meta
          name="description"
          content="A utility to parse XML from OpenAI's O1 model responses"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <div className="min-h-screen bg-gray-950">
          <MainNav />
          <main>{children}</main>
          <Toaster theme="dark" position="top-right" />
        </div>
      </body>
    </html>
  );
}
