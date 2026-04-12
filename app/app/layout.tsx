import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentOS — AI Dashboard",
  description: "Your intelligent agent workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
