import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steward Table",
  description: "Order management and fulfillment for churches and ministries",
  other: {
    // "only light" prevents Chrome's Auto Dark Mode flag from overriding colors,
    // which can cause a black GPU canvas artifact on Windows Chrome.
    "color-scheme": "only light",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white" style={{ backgroundColor: "white", colorScheme: "only light" }}>
      <head>
        {/*
          Synchronous inline script — runs during HTML parsing, before Chrome creates
          any GPU compositing layers. "only light" forbids Chrome Auto Dark Mode from
          overriding the canvas color, which causes a black artifact on Windows Chrome.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'document.documentElement.style.backgroundColor="white";document.documentElement.style.colorScheme="only light"',
          }}
        />
      </head>
      <body className="bg-white" style={{ backgroundColor: "white" }}>{children}</body>
    </html>
  );
}
