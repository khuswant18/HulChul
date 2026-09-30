import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { HealthBadge } from "@/components/HealthBadge";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Career Operator",
  description: "Give it a job-hunting goal. It applies through the browser, keeps your tracker current and shows its evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} style={{ ["--font-sans" as string]: "var(--font-inter), system-ui, sans-serif", ["--font-mono" as string]: "var(--font-jetbrains), ui-monospace, monospace" }} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="topbar">
          <Link href="/" className="wordmark">
            <i aria-hidden="true" />
            Career Operator
          </Link>
          <nav>
            <Link href="/">Runs</Link>
            <a href="http://localhost:4010/jobs" target="_blank" rel="noreferrer">
              Kaamkaaj
            </a>
            <a href="http://localhost:4020" target="_blank" rel="noreferrer">
              Postbox
            </a>
          </nav>
          <HealthBadge />
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
