import { AppShell } from "@/components/AppShell";
import type { Metadata } from "next";
import { Instrument_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "AI Interview Platform",
  description: "Advanced AI-powered interview conversations, feedback, and coaching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${instrumentSans.variable} ${spaceGrotesk.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
