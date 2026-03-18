import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentProfile } from "@/lib/supabase-server";
import { AdminNav } from "@/components/AdminNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Idene — Family Transparency Platform",
  description: "Automated family communication for Assisted Living Facilities",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();
  const showNav = profile && ['admin', 'director', 'staff', 'nurse'].includes(profile.role);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {showNav && <AdminNav role={profile.role} />}
        {children}
      </body>
    </html>
  );
}
