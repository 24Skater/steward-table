import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steward Table",
  description: "Order management and fulfillment for churches and ministries",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
