import type { Metadata, Viewport } from "next";
import "./globals.css";
import MotionProvider from "@/app/components/MotionProvider";

export const metadata: Metadata = {
  title: "Zocyal",
  description: "Conosci persone, crea connessioni e vivi l'evento.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050306",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
