import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelPro Automotive — Catalog Image Operations",
  description: "Batch automotive product-image processing for parts sellers, distributors, dismantlers and ecommerce catalog teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
