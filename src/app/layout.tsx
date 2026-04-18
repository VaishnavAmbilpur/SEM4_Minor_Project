import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoFill AI",
  description: "AI-assisted form mapping, profile matching, and filled form generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
