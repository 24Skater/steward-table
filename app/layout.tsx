import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steward Table",
  description: "Order management and fulfillment for churches and ministries",
  other: {
    // Tells Chrome's compositor to use a light canvas before any CSS loads.
    // Prevents the black scrollbar-gutter flash on Windows Chrome on first paint.
    "color-scheme": "light",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white" style={{ backgroundColor: "white", colorScheme: "light" }}>
      <head>
        {/*
          Synchronous inline script — runs during HTML parsing, before Chrome creates
          any GPU compositing layers. Sets background on <html> immediately so the
          scrollbar-gutter and canvas never flash black on Windows Chrome.
          The React inline styles above only apply after JS hydration, which is too late.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'document.documentElement.style.backgroundColor="white";document.documentElement.style.colorScheme="light"',
          }}
        />
      </head>
      <body className="bg-white" style={{ backgroundColor: "white" }}>{children}</body>
    </html>
  );
}
