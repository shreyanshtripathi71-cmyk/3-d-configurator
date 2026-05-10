import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-local",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenSpec — Real-time pricing for windows, doors & garage doors",
  description:
    "OpenSpec is the online configurator and real-time pricing platform for window, door, and garage door manufacturers, dealers, and factories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
