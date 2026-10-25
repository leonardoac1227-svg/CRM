// Copiloto interno do Téo: relatórios executivos gerados a partir dos dados reais do CRM.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { Session } from "../auth";
import { contactScope, conversationScope, taskScope } from "../rbac";
import { formatBRL, formatDate, formatPhone, toNumber, timeAgo } from "../utils";
import { META_PRICING, ORIGIN_SHORT, TASK_TYPE_LABELS } from "../constants";
import { llmAvailable, llmText } from "../ai/llm";
import { norm } from "../ai/extract";

export type CopilotAction = { label: string; href: string };
export type CopilotReport = { title: string; markdown: string; actions: CopilotAction[] };

export const COPILOT_SHORTCUTS = [
  { key: "relatorio-corretores", label: "Relatório dos corretores", description: "Desempenho e pendências de cada corretor" },
  { key: "leads-sem-resposta", label: "Leads sem resposta", description: "Clientes esperando retorno agora" },
  { key: "tarefas-atrasadas", label: "Tarefas atrasadas", description: "O que ficou para trás na agenda" },
  { key: "visitas-semana", label: "Visitas da semana", description: "Agenda de visitas dos próximos 7 dias" },
  { key: "leads-sem-responsavel", label: "Leads sem responsável", description: "Leads aguardando distribuição" },
  { key: "criar-campanha", label: "Criar campanha", description: "Sugestões de disparo por etapa do funil" },
] as const;

export type ShortcutKey = (typeof COPILOT_SHORTCUTS)[number]["key"];

function table(head: string[], rows: (string | number)[][]) {
  if (!rows.length) return "_Nada encontrado._";
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

async function brokersReport(s: Session): Promise<CopilotReport> {
  const since = new Date(Date.now() - 30 * 86400000);
  const userWhere: Prisma.UserWhereInput = { workspaceId: s.workspace.id, role: { in: ["BROKER", "MANAGER"] }, isActive: true };
  if (s.user.role === "BROKER") userWhere.id = s.user.id;
  const users = await prisma.user.findMany({ where: userWhere, orderBy: { name: "asc" } });
  const rows = await Promise.all(
    users.map(async (u) => {
      const [received, pending, overdue, won] = await Promise.all([
        prisma.contact.count({ where: { workspaceId: s.workspace.id, assignedToId: u.id, createdAt: { gte: since } } }),
        prisma.conversation.count({ where: { workspaceId: s.workspace.id, assignedToId: u.id, status: { in: ["UNREAD", "NEEDS_REPLY"] } } }),
        prisma.task.count({ where: { workspaceId: s.workspace.id, assignedToId: u.id, isCompleted: false, dueDate: { lt: new Date() } } }),
        prisma.contact.aggregate({ where: { workspaceId: s.workspace.id, assignedToId: u.id, status: "WON" }, _count: { _all: true }, _sum: { dealValue: true } }),
      ]);
      return { u, received, pending, overdue, won: won._count._all, value: toNumber(won._sum.dealValue) };
    }),
  );
  const best = [...rows].sort((a, b) => b.value - a.value)[0];
  const worst = [...rows].sort((a, b) => b.pending - a.pending)[0];
  const md = [
    `**Resumo dos últimos 30 dias** — ${rows.reduce((a, r) => a + r.received, 0)} leads recebidos, ${rows.reduce((a, r) => a + r.won, 0)} vendas fechadas (${formatBRL(rows.reduce((a, r) => a + r.value, 0))}).`,
    "",
    table(["Corretor", "Leads (30d)", "A responder", "Tarefas atrasadas", "Vendas", "Valor gerado"], rows.map((r) => [r.u.name, r.received, r.pending, r.overdue, r.won, formatBRL(r.value)])),
    "",
    best && best.value > 0 ? `🏆 **Destaque:** ${best.u.name} lidera em valor gerado (${formatBRL(best.value)}).` : "",
    worst && worst.pending > 0 ? `⚠️ **Atenção:** ${worst.u.name} tem ${worst.pending} conversa(s) aguardando resposta.` : "✅ Nenhum corretor com conversas pendentes.",
  ].filter(Boolean).join("\n");
  return { title: "Relatório dos corretores", markdown: md, actions: [{ label: "Ver ranking no funil", href: "/funis" }] };
}

async function unansweredLeads(s: Session): Promise<CopilotReport> {
  const convs = await prisma.conversation.findMany({
    where: { ...conversationScope(s), status: { in: ["UNREAD", "NEEDS_REPLY"] } },
    include: { contact: true, assignedTo: true },
    orderBy: { lastContactMessageAt: "asc" },
    take: 25,
  });
  const md = [
    `Há **${convs.length} conversa(s)** aguardando resposta da equipe.${convs.length ? " As mais antigas primeiro:" : ""}`,
    "",
    table(["Lead", "Telefone", "Responsável", "Esperando há", "Última mensagem"], convs.map((c) => [c.contact.name ?? "Sem nome", formatPhone(c.contact.phone), c.assignedTo?.name ?? "—", timeAgo(c.lastContactMessageAt ?? c.lastMessageAt), (c.lastMessagePreview ?? "").slice(0, 50)])),
    "",
    convs.length ? "💡 Leads respondidos em até 5 minutos convertem até 9x mais. Priorize os primeiros da lista." : "",
  ].join("\n");
  return { title: "Leads sem resposta", markdown: md, actions: [{ label: "Abrir aba A responder", href: "/atendimento?aba=responder" }] };
}

async function overdueTasks(s: Session): Promise<CopilotReport> {
  const tasks = await prisma.task.findMany({
    where: { ...taskScope(s), isCompleted: false, dueDate: { lt: new Date() } },
    include: { contact: true, assignedTo: true },
    orderBy: { dueDate: "asc" },
    take: 30,
  });
  const md = [
    `Existem **${tasks.length} tarefa(s) atrasada(s)**.`,
    "",
    table(["Tarefa", "Tipo", "Contato", "Responsável", "Venceu em"], tasks.map((t) => [t.title, TASK_TYPE_LABELS[t.type], t.contact?.name ?? "—", t.assignedTo?.name ?? "—", formatDate(t.dueDate, true)])),
  ].join("\n");
  return { title: "Tarefas atrasadas", markdown: md, actions: [{ label: "Abrir agenda", href: "/agenda" }] };
}

async function weekVisits(s: Session): Promise<CopilotReport> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400000);
  const tasks = await prisma.task.findMany({
    where: { ...taskScope(s), type: "VISIT", dueDate: { gte: start, lt: end } },
    include: { contact: true, assignedTo: true },
    orderBy: { dueDate: "asc" },
  });
  const md = [
    `**${tasks.length} visita(s)** agendada(s) para os próximos 7 dias.`,
    "",
    table(["Quando", "Cliente", "Corretor", "Assunto", "Status"], tasks.map((t) => [formatDate(t.dueDate, true), t.contact?.name ?? "—", t.assignedTo?.name ?? "—", t.title, t.isCompleted ? "✅ Feita" : "Pendente"])),
  ].join("\n");
  return { title: "Visitas da semana", markdown: md, actions: [{ label: "Ver agenda", href: "/agenda" }] };
}

async function unassignedLeads(s: Session): Promise<CopilotReport> {
  const contacts = await prisma.contact.findMany({
    where: { ...contactScope(s), assignedToId: null, status: "OPEN" },
    include: { stage: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const md = [
    `**${contacts.length} lead(s)** estão sem responsável.`,
    "",
    table(["Lead", "Telefone", "Etapa", "Origem", "Criado"], contacts.map((c) => [c.name ?? "Sem nome", formatPhone(c.phone), c.stage?.name ?? "—", ORIGIN_SHORT[c.origin], timeAgo(c.createdAt)])),
    "",
    contacts.length ? "💡 Ative a **Roleta de corretores** em Equipe para distribuir automaticamente." : "",
  ].join("\n");
  return { title: "Leads sem responsável", markdown: md, actions: [{ label: "Configurar roleta", href: "/equipe" }, { label: "Ver contatos", href: "/contatos?responsavel=none" }] };
}

async function campaignSuggestions(s: Session): Promise<CopilotReport> {
  const pipeline = await prisma.pipeline.findFirst({ where: { workspaceId: s.workspace.id, isDefault: true }, include: { stages: { orderBy: { order: "asc" } } } });
  if (!pipeline) return { title: "Criar campanha", markdown: "Nenhum funil encontrado.", actions: [] };
  const counts = await prisma.contact.groupBy({ by: ["stageId"], where: { ...contactScope(s), pipelineId: pipeline.id }, _count: { _all: true } });
  const c = (name: RegExp) => {
    const st = pipeline.stages.find((x) => name.test(x.name));
    return { stage: st, count: counts.find((k) => k.stageId === st?.id)?._count._all ?? 0 };
  };
  const ideas = [
    { ...c(/visita/i), idea: "Reagendar visitas de quem faltou", tip: "Use um modelo de Utilidade (mais barato) lembrando a visita." },
    { ...c(/proposta/i), idea: "Destravar propostas paradas", tip: "Ofereça uma condição especial válida até o fim do mês." },
    { ...c(/fechado/i), idea: "Pedir 5 indicações para clientes que fecharam", tip: "Clientes satisfeitos indicam em média 2 novos leads." },
    { ...c(/^lead$/i), idea: "Reengajar leads novos que não responderam", tip: "Marque 'Entregar ao Téo quem responder' para qualificar na hora." },
  ].filter((i) => i.stage);
  const md = [
    "Sugestões de campanha com base nas etapas do funil:",
    "",
    table(
      ["Ideia", "Etapa", "Contatos", "Custo (Marketing)", "Custo (Utilidade)"],
      ideas.map((i) => [i.idea, i.stage!.name, i.count, formatBRL(i.count * META_PRICING.MARKETING), formatBRL(i.count * META_PRICING.UTILITY)]),
    ),
    "",
    ...ideas.map((i) => `- **${i.idea}:** ${i.tip}`),
  ].join("\n");
  return {
    title: "Criar campanha",
    markdown: md,
    actions: ideas.filter((i) => i.count > 0).map((i) => ({ label: `Campanha: ${i.stage!.name}`, href: `/campanhas?novo=1&pipeline=${pipeline.id}&stage=${i.stage!.id}` })),
  };
}

export async function runShortcut(s: Session, key: ShortcutKey): Promise<CopilotReport> {
  switch (key) {
    case "relatorio-corretores":
      return brokersReport(s);
    case "leads-sem-resposta":
      return unansweredLeads(s);
    case "tarefas-atrasadas":
      return overdueTasks(s);
    case "visitas-semana":
      return weekVisits(s);
    case "leads-sem-responsavel":
      return unassignedLeads(s);
    case "criar-campanha":
      return campaignSuggestions(s);
  }
}

function routeQuestion(q: string): ShortcutKey | null {
  const t = norm(q);
  if (/corretor|equipe|desempenho|ranking|vendedor/.test(t)) return "relatorio-corretores";
  if (/sem resposta|respond|esperando|aguardando/.test(t)) return "leads-sem-resposta";
  if (/atrasad|vencid/.test(t)) return "tarefas-atrasadas";
  if (/visita/.test(t)) return "visitas-semana";
  if (/sem responsavel|distribu|roleta/.test(t)) return "leads-sem-responsavel";
  if (/campanha|disparo|template|modelo/.test(t)) return "criar-campanha";
  return null;
}

async function snapshot(s: Session) {
  const scope = contactScope(s);
  const [byStage, byOrigin, pending, overdue, won, open, stages] = await Promise.all([
    prisma.contact.groupBy({ by: ["stageId"], where: scope, _count: { _all: true } }),
    prisma.contact.groupBy({ by: ["origin"], where: scope, _count: { _all: true } }),
    prisma.conversation.count({ where: { ...conversationScope(s), status: { in: ["UNREAD", "NEEDS_REPLY"] } } }),
    prisma.task.count({ where: { ...taskScope(s), isCompleted: false, dueDate: { lt: new Date() } } }),
    prisma.contact.aggregate({ where: { ...scope, status: "WON" }, _sum: { dealValue: true }, _count: { _all: true } }),
    prisma.contact.count({ where: { ...scope, status: "OPEN" } }),
    prisma.stage.findMany({ where: { pipeline: { workspaceId: s.workspace.id } } }),
  ]);
  return {
    empresa: s.workspace.name,
    usuario: { nome: s.user.name, perfil: s.user.role },
    leadsPorEtapa: byStage.map((b) => ({ etapa: stages.find((x) => x.id === b.stageId)?.name ?? "Sem etapa", total: b._count._all })),
    leadsPorOrigem: byOrigin.map((o) => ({ origem: ORIGIN_SHORT[o.origin], total: o._count._all })),
    conversasAguardandoResposta: pending,
    tarefasAtrasadas: overdue,
    negociosEmAberto: open,
    vendasFechadas: won._count._all,
    valorFechado: toNumber(won._sum.dealValue),
  };
}

export async function answerQuestion(s: Session, question: string, history: { role: "user" | "assistant"; content: string }[]): Promise<CopilotReport> {
  const routed = routeQuestion(question);
  const base = routed ? await runShortcut(s, routed) : null;
  if (llmAvailable()) {
    const data = await snapshot(s);
    const text = await llmText({
      system: `Você é o Téo, copiloto de um CRM imobiliário. Responda em português, de forma executiva e objetiva, usando Markdown (tabelas quando útil). Use SOMENTE os dados fornecidos; se faltar dado, diga isso. Dados atuais do CRM (JSON): ${JSON.stringify(data)}${base ? `\n\nRelatório relacionado já calculado:\n${base.markdown}` : ""}`,
      messages: [...history.slice(-8), { role: "user", content: question }],
    });
    if (text) return { title: base?.title ?? "Resposta do Téo", markdown: text, actions: base?.actions ?? [] };
  }
  if (base) return base;
  const d = await snapshot(s);
  return {
    title: "Visão geral do CRM",
    markdown: [
      `Não encontrei um relatório específico para essa pergunta, mas aqui está o panorama atual de **${d.empresa}**:`,
      "",
      table(["Indicador", "Valor"], [
        ["Negócios em aberto", d.negociosEmAberto],
        ["Conversas aguardando resposta", d.conversasAguardandoResposta],
        ["Tarefas atrasadas", d.tarefasAtrasadas],
        ["Vendas fechadas", d.vendasFechadas],
        ["Valor fechado", formatBRL(d.valorFechado)],
      ]),
      "",
      "**Leads por etapa:** " + d.leadsPorEtapa.map((e) => `${e.etapa} (${e.total})`).join(", "),
      "",
      "_Dica: pergunte sobre corretores, leads sem resposta, tarefas atrasadas, visitas ou campanhas._",
    ].join("\n"),
    actions: [],
  };
}

/** Pendências exibidas no menu lateral do Téo. */
export async function pendencies(s: Session) {
  const [unanswered, overdue, unassigned, attention, rejected] = await Promise.all([
    prisma.conversation.count({ where: { ...conversationScope(s), status: { in: ["UNREAD", "NEEDS_REPLY"] }, lastContactMessageAt: { lt: new Date(Date.now() - 30 * 60000) } } }),
    prisma.task.count({ where: { ...taskScope(s), isCompleted: false, dueDate: { lt: new Date() } } }),
    prisma.contact.count({ where: { ...contactScope(s), assignedToId: null, status: "OPEN" } }),
    prisma.whatsAppChannel.count({ where: { workspaceId: s.workspace.id, status: { in: ["ATTENTION", "DISCONNECTED"] } } }),
    prisma.messageTemplate.count({ where: { workspaceId: s.workspace.id, metaStatus: "REJECTED" } }),
  ]);
  const items = [
    { key: "leads-sem-resposta", label: "Conversas sem resposta há mais de 30 min", count: unanswered, href: "/atendimento?aba=responder" },
    { key: "tarefas-atrasadas", label: "Tarefas atrasadas", count: overdue, href: "/agenda" },
    { key: "leads-sem-responsavel", label: "Leads sem responsável", count: unassigned, href: "/contatos?responsavel=none" },
    { key: "numeros", label: "Números de WhatsApp que requerem atenção", count: attention, href: "/integracoes" },
    { key: "modelos", label: "Modelos de mensagem rejeitados pela Meta", count: rejected, href: "/campanhas/modelos" },
  ];
  return { total: items.reduce((a, i) => a + i.count, 0), items };
}
