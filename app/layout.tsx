import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lokalize | Oyun Metni Lokalizasyon Aracı",
  description: "Oyun metinlerinizi 22 dile RAG destekli AI ile lokalize edin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
