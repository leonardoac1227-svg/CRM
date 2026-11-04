"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Megaphone, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/campanhas/modelos", label: "Modelos de mensagem", icon: FileText },
  { href: "/campanhas/formularios", label: "Formulários", icon: ClipboardList },
];

export default function CampanhasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-app">
      <div className="sticky top-[var(--topbar-h)] z-20 border-b bg-background/85 px-4 backdrop-blur-xl md:px-8">
        <nav aria-label="Seções de campanhas" className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto py-2.5 scrollbar-thin">
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={pathname === i.href ? "page" : undefined} className={cn("flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-bold transition-colors", pathname === i.href ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:border-primary/50 hover:text-foreground")}>
              <i.icon className="h-4 w-4" /> {i.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
