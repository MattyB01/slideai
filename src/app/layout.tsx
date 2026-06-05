import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlideAI — AI-Powered Presentation Designer",
  description: "Upload, style, and export PowerPoint presentations with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        {children}
      </body>
    </html>
  );
}
