import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotelOS — Hotel & Restaurant Management",
  description:
    "Complete hotel chain and restaurant management platform. Track rooms, sales, expenses, salaries, and profits in real-time.",
  manifest: "/manifest.json",
  keywords: ["hotel management", "restaurant POS", "hospitality SaaS"],
  openGraph: {
    title: "HotelOS — Hotel & Restaurant Management",
    description: "Complete hotel chain and restaurant management platform.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
