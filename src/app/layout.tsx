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
      <head>
        {/* Google Fonts for slide rendering */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&family=Instrument+Serif:wght@400;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        {children}
      </body>
    </html>
  );
}
