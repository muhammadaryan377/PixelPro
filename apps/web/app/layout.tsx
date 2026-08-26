import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelPro — Product Image Automation",
  description: "Turn raw product photos into consistent marketplace-ready assets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
