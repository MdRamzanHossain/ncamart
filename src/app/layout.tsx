import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ThemeProvider, ThemeScript } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "NCAMart — High-Trust Dual-Tier Tech Accessories",
  description:
    "Direct importer & Nawabpur wholesale hub for 100% Authentic and Budget Smart tested tech accessories in Bangladesh.",
  keywords: [
    "tech accessories",
    "Nawabpur",
    "Dhaka",
    "authentic electronics",
    "holographic seal",
    "preorder",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn-BD" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider defaultTheme="dark">
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
