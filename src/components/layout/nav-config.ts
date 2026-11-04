import {
  BarChart3, Briefcase, Building2, CalendarDays, Globe, KanbanSquare, LayoutDashboard, ListChecks, Megaphone, MessagesSquare, Plug, Rocket, ShieldCheck, Sparkles, Users, Zap,
  type LucideIcon,
} from "lucide-react";

/** Contadores ao vivo que aparecem no menu lateral. */
export type BadgeKey = "reply" | "overdue" | "unassigned" | "attention" | "rejected" | "pendencias";

export type NavItem = {
  href: string;
  label: string;
  /** chave de módulo do RBAC; null = visível para todos */
  module: string | null;
  icon: LucideIcon;
  /** frase curta usada na Central (mapa da plataforma) e na busca */
  description: string;
  badge?: BadgeKey;
  /** usa o nome do assistente no rótulo */
  ai?: boolean;
  /** aparece no mapa de módulos da Central */
  inMap?: boolean;
  /** restringe a perfis específicos (ex.: só a agência) */
  roles?: string[];
};

export type NavGroup = { key: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "inicio",
    label: "Início",
    items: [
      { href: "/central", label: "Central", module: null, icon: LayoutDashboard, description: "Resumo do dia e acesso a tudo." },
    ],
  },
  {
    key: "vender",
    label: "Vender",
    items: [
      { href: "/atendimento", label: "Atendimento", module: "atendimento", icon: MessagesSquare, badge: "reply", inMap: true, description: "Todos os WhatsApps da empresa e dos corretores numa caixa só, com janela de 24h e modelos." },
      { href: "/contatos", label: "Contatos", module: "contatos", icon: Users, badge: "unassigned", inMap: true, description: "Ficha 360º, importação de planilha, etiquetas e ações em massa." },
      { href: "/funis", label: "Funis", module: "funis", icon: KanbanSquare, inMap: true, description: "Kanban de arrastar e soltar e análise por etapa e por corretor." },
      { href: "/agenda", label: "Agenda", module: "agenda", icon: CalendarDays, badge: "overdue", inMap: true, description: "Visitas, ligações e follow-ups, com lembrete automático da IA." },
      { href: "/imoveis", label: "Imóveis", module: "imoveis", icon: Building2, inMap: true, description: "Catálogo que a equipe e a IA usam para recomendar opções." },
    ],
  },
  {
    key: "crescer",
    label: "Crescer",
    items: [
      { href: "/campanhas", label: "Campanhas", module: "campanhas", icon: Megaphone, badge: "rejected", inMap: true, description: "Disparos oficiais da Meta por etapa do funil, com teste A/B e custo antes de enviar." },
      { href: "/site-seo", label: "Site & SEO", module: "site-seo", icon: Globe, inMap: true, description: "Descubra qual página do Google gerou cada conversa — e quanto ela vendeu." },
      { href: "/relatorios", label: "Relatórios", module: "relatorios", icon: BarChart3, inMap: true, description: "Leads, conversão, tempo de 1ª resposta e origem, por período." },
    ],
  },
  {
    key: "ia",
    label: "Inteligência",
    items: [
      { href: "/ia", label: "Copiloto", module: "teo", icon: Sparkles, ai: true, inMap: true, description: "Pergunte sobre leads, equipe e agenda. A resposta vem dos dados reais do CRM." },
      { href: "/ia/automacoes", label: "Automações", module: "teo", icon: Zap, inMap: true, description: "Qualificação no WhatsApp, lembretes, pós-visita, reengajamento e aniversários." },
      { href: "/ia/pendencias", label: "Pendências", module: "teo", icon: ListChecks, badge: "pendencias", description: "O que precisa da sua atenção agora." },
    ],
  },
  {
    key: "configurar",
    label: "Configurar",
    items: [
      { href: "/clientes", label: "Clientes", module: null, roles: ["AGENCY_ADMIN", "SUPER_ADMIN"], icon: Briefcase, inMap: true, description: "Empresas atendidas pela agência: crie um cliente e o acesso do gestor em um minuto." },
      { href: "/integracoes", label: "Integrações", module: "integracoes", icon: Plug, badge: "attention", inMap: true, description: "WhatsApp oficial e por QR Code, Facebook Lead Ads, Google Ads e portais." },
      { href: "/equipe", label: "Equipe", module: "equipe", icon: ShieldCheck, inMap: true, description: "Perfis de acesso, permissões por módulo e roleta de corretores." },
      { href: "/getting-started", label: "Primeiros passos", module: null, icon: Rocket, description: "Checklist de implantação e tour guiado." },
    ],
  },
];

/** O perfil pode ver este item? */
export function navAllowed(item: NavItem, me: { modules: string[]; user: { role: string } } | undefined) {
  if (!me) return !item.roles;
  if (item.roles && !item.roles.includes(me.user.role)) return false;
  return item.module === null || me.modules.includes(item.module);
}

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navLabel(item: NavItem, assistant: string) {
  return item.ai ? `${assistant} · ${item.label}` : item.label;
}

/** Item de navegação ativo para a rota atual (o prefixo mais longo vence). */
export function activeNavItem(pathname: string): NavItem | undefined {
  return [...ALL_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
}

export function groupOf(item: NavItem | undefined) {
  return item ? NAV_GROUPS.find((g) => g.items.includes(item)) : undefined;
}
