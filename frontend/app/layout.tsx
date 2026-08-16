import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notch",
  description: "Feature requests, and the platform that ships them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/" className="brand">
            Notch
          </Link>
          <Link href="/features">Feature requests</Link>
          <Link href="/login">Sign in</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
