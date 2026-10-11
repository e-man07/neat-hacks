import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Night Shift — the on-call engineer for your AI agents",
  description:
    "Night Shift detects incidents in production AI agents, traces them to the change and the coding-agent prompt behind it, prices the damage, contains it within a pre-approved policy, and only wakes you for decisions that can't be undone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
