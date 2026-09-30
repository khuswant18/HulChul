import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { HealthBadge } from "@/components/HealthBadge";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Career Operator",
  description: "Give it a job-hunting goal. It applies through the browser, keeps your tracker current and shows its evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="wordmark">
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
