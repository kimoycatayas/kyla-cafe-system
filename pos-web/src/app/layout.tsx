import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionBoundary } from "@/components/auth/AuthSessionBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { NotificationProvider } from "@/lib/notifications/notificationContext";
import { OrderNotification } from "@/components/notifications/OrderNotification";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kyla Cafe System",
    template: "%s | Kyla Cafe System",
  },
  description: "Point of sale platform crafted for growing Philippine cafes.",
  manifest: "/manifest.json",
  themeColor: "#0ea5e9",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kyla POS",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <AuthSessionBoundary>
          <NotificationProvider>
            {children}
            <OrderNotification />
          </NotificationProvider>
        </AuthSessionBoundary>
        <OfflineIndicator />
      </body>
    </html>
  );
}
