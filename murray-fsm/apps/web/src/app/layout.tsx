// Murray's FSM - Root Layout
// ============================

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Murray's FSM - Field Service Management",
  description: 'Offline-first field service management for garage door operators',
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Murray's FSM",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
