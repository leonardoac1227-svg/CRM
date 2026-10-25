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
    <div className="flex min-h-app">
      <aside className="hidden w-56 shrink-0 border-r bg-white p-3 md:block">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium", pathname === i.href ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted")}>
            <i.icon className="h-4 w-4" /> {i.label}
          </Link>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex gap-1 border-b bg-white px-4 py-2 md:hidden">
          {ITEMS.map((i) => <Link key={i.href} href={i.href} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", pathname === i.href ? "bg-primary/10 text-primary" : "text-slate-600")}>{i.label}</Link>)}
        </div>
        {children}
      </div>
    </div>
  );
}
