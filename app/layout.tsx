import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zocyal",
  description: "Conosci persone, crea connessioni e vivi l'evento.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
