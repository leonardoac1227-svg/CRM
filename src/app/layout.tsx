import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Téo CRM", template: "%s · Téo CRM" },
  description: "CRM Omnichannel com IA integrada ao WhatsApp, campanhas oficiais da Meta e rastreamento de SEO.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
