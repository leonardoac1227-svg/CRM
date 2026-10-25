/* eslint-disable no-console */
// Seed de demonstração: agência white-label, 2 workspaces, equipe com RBAC, WhatsApp, funil de 7 etapas,
// conversas com o Téo, contatos com origem SEO, catálogo, agenda, modelos Meta e campanhas.
import { PrismaClient, type LeadOrigin, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AI_PRESET_QUESTIONS, AUTOMATION_DEFS, DEFAULT_FAQS, DEFAULT_STAGES, META_PRICING } from "../src/lib/constants";

const prisma = new PrismaClient();

// PRNG determinístico (mulberry32) para dados reprodutíveis
let seed = 20261025;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000);

const FIRST = ["Mariana", "João", "Ana Paula", "Carlos", "Fernanda", "Lucas", "Juliana", "Pedro", "Aline", "Rodrigo", "Patrícia", "Bruno", "Larissa", "Diego", "Camila", "Thiago", "Vanessa", "Felipe", "Daniela", "Gustavo", "Renata", "André", "Tatiane", "Marcelo", "Priscila", "Leandro", "Gabriela", "Vinícius", "Simone", "Eduardo", "Jéssica", "Ricardo", "Luana", "Matheus", "Adriana", "Fábio", "Natália", "Wesley", "Carla", "Robson"];
const LAST = ["Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Barbosa", "Cerqueira", "Moreira", "Bastos", "Pinheiro", "Rocha"];
const HOODS = ["Santa Mônica", "SIM", "Papagaio", "Tomba", "Conceição", "Muchila", "Brasília", "Capuchinhos", "Ponto Central", "Centro", "Cidade Nova", "Mangabeira"];
const PROFESSIONS = ["Professor(a)", "Enfermeiro(a)", "Vendedor(a)", "Motorista", "Autônomo", "Técnico(a) de TI", "Auxiliar administrativo", "Comerciante", "Policial", "Cabeleireiro(a)"];
const SEO_PAGES = [
  "https://horizonteimoveis.com.br/blog/minha-casa-minha-vida-feira-de-santana",
  "https://horizonteimoveis.com.br/imoveis/apartamento-2-quartos-santa-monica",
  "https://horizonteimoveis.com.br/blog/como-usar-fgts-na-compra-do-imovel",
  "https://horizonteimoveis.com.br/imoveis/casa-condominio-sim",
  "https://horizonteimoveis.com.br/blog/simulacao-financiamento-caixa-2026",
  "https://horizonteimoveis.com.br/lancamentos/residencial-jardim-papagaio",
];
const SEO_KEYWORDS = ["minha casa minha vida feira de santana", "apartamento 2 quartos santa mônica", "usar fgts entrada imóvel", "casa em condomínio feira de santana", "simulação financiamento caixa", "lançamento papagaio feira"];
const TAG_POOL = ["mcmv", "investidor", "urgente", "primeiro-imóvel", "fgts", "permuta", "alto-padrão", "vip"];

async function main() {
  console.log("🧹 Limpando banco...");
  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.messageTemplate.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.task.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.trackingSession.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.catalogItem.deleteMany(),
    prisma.aiQuestion.deleteMany(),
    prisma.aiFaq.deleteMany(),
    prisma.aiAssistantConfig.deleteMany(),
    prisma.aiAutomationRule.deleteMany(),
    prisma.copilotMessage.deleteMany(),
    prisma.whatsAppChannel.deleteMany(),
    prisma.stage.deleteMany(),
    prisma.pipeline.deleteMany(),
    prisma.quickReply.deleteMany(),
    prisma.integration.deleteMany(),
    prisma.leadForm.deleteMany(),
    prisma.user.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.agency.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("teo123456", 10);

  // ---------------------------------------------------------------- Agência e workspaces
  const agency = await prisma.agency.create({
    data: { name: "Rank Alto SEO", slug: "rankalto", logoUrl: null, primaryColor: "#2563EB", secondaryColor: "#4F46E5", assistantDefaultName: "Téo" },
  });
  const ws = await prisma.workspace.create({
    data: {
      agencyId: agency.id,
      name: "Horizonte Imóveis",
      niche: "IMOBILIARIO",
      city: "Feira de Santana",
      state: "BA",
      siteUrl: "https://horizonteimoveis.com.br",
      onboardingProgress: { whatsapp: true, catalog: true, team: true, contact: true, seoScript: false },
    },
  });
  const ws2 = await prisma.workspace.create({
    data: { agencyId: agency.id, name: "Clínica Sorriso Feira", niche: "CLINICA", city: "Feira de Santana", state: "BA", onboardingProgress: { whatsapp: false } },
  });

  // ---------------------------------------------------------------- Usuários (RBAC)
  await prisma.user.create({ data: { name: "Super Admin", email: "admin@teocrm.com.br", passwordHash, role: "SUPER_ADMIN" } });
  await prisma.user.create({ data: { name: "Lucas Rank (Agência)", email: "agencia@rankalto.com.br", passwordHash, role: "AGENCY_ADMIN", agencyId: agency.id, phone: "5571999990000" } });
  const manager = await prisma.user.create({ data: { workspaceId: ws.id, name: "Patrícia Andrade", email: "gestor@horizonte.com.br", passwordHash, role: "MANAGER", phone: "5575999110001" } });
  const assistant = await prisma.user.create({
    data: {
      workspaceId: ws.id, name: "Juliana Reis", email: "assistente@horizonte.com.br", passwordHash, role: "ASSISTANT", phone: "5575999110002",
      permissions: { atendimento: true, contatos: true, funis: true, imoveis: true, agenda: true, teo: true, campanhas: true, relatorios: false, "site-seo": false, integracoes: false, equipe: false, verTodosLeads: true },
    },
  });
  const brokersData = [
    { name: "Márcio Lima", email: "marcio@horizonte.com.br", phone: "5575999220001", inRoulette: true, rouletteWeight: 2 },
    { name: "Camila Souza", email: "camila@horizonte.com.br", phone: "5575999220002", inRoulette: true, rouletteWeight: 1 },
    { name: "Rafael Torres", email: "rafael@horizonte.com.br", phone: "5575999220003", inRoulette: true, rouletteWeight: 1 },
    { name: "Beatriz Nunes", email: "corretor@horizonte.com.br", phone: "5575999220004", inRoulette: false, rouletteWeight: 1 },
  ];
  const brokers = [];
  for (const [i, b] of brokersData.entries()) {
    brokers.push(await prisma.user.create({ data: { ...b, workspaceId: ws.id, passwordHash, role: "BROKER", lastAssignedAt: hoursAgo(10 - i * 2) } }));
  }
  const [marcio, camila, rafael, beatriz] = brokers;
  await prisma.user.create({ data: { workspaceId: ws2.id, name: "Dra. Helena Prado", email: "gestor@sorrisofeira.com.br", passwordHash, role: "MANAGER" } });

  // ---------------------------------------------------------------- WhatsApp
  const company = await prisma.whatsAppChannel.create({
    data: {
      workspaceId: ws.id, name: "Horizonte • Comercial", phoneNumber: "5575998001000", provider: "META_OFFICIAL", accountType: "COMPANY", status: "CONNECTED",
      metaWabaId: "demo-waba-102938", metaPhoneNumberId: "demo-pnid-556677", metaAccessToken: "demo-token", lastActivityAt: minutesAgo(3),
    },
  });
  const chMarcio = await prisma.whatsAppChannel.create({
    data: { workspaceId: ws.id, userId: marcio.id, name: "Márcio Lima", phoneNumber: marcio.phone!, provider: "EVOLUTION_QR", accountType: "BROKER", status: "CONNECTED", evolutionInstance: "horizonte-marcio", lastActivityAt: hoursAgo(1) },
  });
  const chCamila = await prisma.whatsAppChannel.create({
    data: { workspaceId: ws.id, userId: camila.id, name: "Camila Souza", phoneNumber: camila.phone!, provider: "EVOLUTION_QR", accountType: "BROKER", status: "ATTENTION", evolutionInstance: "horizonte-camila", lastActivityAt: daysAgo(2) },
  });
  await prisma.whatsAppChannel.create({
    data: { workspaceId: ws.id, userId: rafael.id, name: "Rafael Torres", phoneNumber: rafael.phone!, provider: "EVOLUTION_QR", accountType: "BROKER", status: "DISCONNECTED", evolutionInstance: "horizonte-rafael" },
  });

  // ---------------------------------------------------------------- Funis
  const sales = await prisma.pipeline.create({
    data: { workspaceId: ws.id, name: "Funil de vendas", isDefault: true, stages: { create: DEFAULT_STAGES.map((s, i) => ({ name: s.name, color: s.color, order: i, isWonStage: !!s.isWonStage })) } },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  const rent = await prisma.pipeline.create({
    data: {
      workspaceId: ws.id, name: "Funil de aluguel",
      stages: { create: [
        { name: "Lead", color: "#64748B", order: 0 }, { name: "Qualificação", color: "#2563EB", order: 1 }, { name: "Visita agendada", color: "#0EA5E9", order: 2 },
        { name: "Análise cadastral", color: "#4F46E5", order: 3 }, { name: "Contrato", color: "#F59E0B", order: 4 }, { name: "Alugado", color: "#16A34A", order: 5, isWonStage: true },
      ] },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  await prisma.pipeline.create({ data: { workspaceId: ws2.id, name: "Funil de pacientes", isDefault: true, stages: { create: DEFAULT_STAGES.map((s, i) => ({ name: s.name, color: s.color, order: i, isWonStage: !!s.isWonStage })) } } });
  const S = sales.stages;

  // ---------------------------------------------------------------- Catálogo
  const catalogData = [
    { title: "Apartamento 2/4 no Santa Mônica", code: "AP-201", category: "Apartamento", price: 189000, neighborhood: "Santa Mônica", bedrooms: 2, areaM2: 54 },
    { title: "Residencial Jardim Papagaio (Lançamento MCMV)", code: "LC-310", category: "Lançamento", price: 159900, neighborhood: "Papagaio", bedrooms: 2, areaM2: 48 },
    { title: "Casa em condomínio no SIM", code: "CA-114", category: "Casa", price: 420000, neighborhood: "SIM", bedrooms: 3, areaM2: 120 },
    { title: "Apartamento 3/4 com suíte no Capuchinhos", code: "AP-322", category: "Apartamento", price: 365000, neighborhood: "Capuchinhos", bedrooms: 3, areaM2: 86 },
    { title: "Casa térrea no Tomba", code: "CA-087", category: "Casa", price: 175000, neighborhood: "Tomba", bedrooms: 2, areaM2: 70 },
    { title: "Cobertura duplex no Ponto Central", code: "CB-501", category: "Cobertura", price: 890000, neighborhood: "Ponto Central", bedrooms: 4, areaM2: 210 },
    { title: "Terreno 300m² na Mangabeira", code: "TE-045", category: "Terreno", price: 98000, neighborhood: "Mangabeira", areaM2: 300 },
    { title: "Apartamento 2/4 na Conceição (aluguel)", code: "AL-210", category: "Locação", price: 1350, neighborhood: "Conceição", bedrooms: 2, areaM2: 58 },
    { title: "Casa 3/4 na Cidade Nova", code: "CA-133", category: "Casa", price: 245000, neighborhood: "Cidade Nova", bedrooms: 3, areaM2: 95 },
    { title: "Sala comercial no Centro", code: "SC-012", category: "Comercial", price: 2200, neighborhood: "Centro", areaM2: 40, status: "RENTED" as const },
  ];
  const catalog = [];
  for (const c of catalogData) {
    catalog.push(await prisma.catalogItem.create({
      data: {
        workspaceId: ws.id, ...c, city: "Feira de Santana",
        description: `${c.title}. Imóvel com documentação regularizada, próximo a comércio, escolas e transporte. Agende sua visita!`,
        images: [`https://picsum.photos/seed/${c.code}/800/600`, `https://picsum.photos/seed/${c.code}b/800/600`],
      },
    }));
  }

  // ---------------------------------------------------------------- Téo (IA)
  const aiConfig = await prisma.aiAssistantConfig.create({
    data: {
      workspaceId: ws.id, isActive: true, preset: "MCMV_ECONOMICO", focus: "VENDAS", assistantName: "Téo", roleTitle: "Assistente virtual",
      tone: "NO_MEIO", emojiLevel: "POUCOS", messageLength: "CURTAS_UMA_A_UMA", regionCity: "Feira de Santana - BA",
      initialGreeting: "Olá{{nome_cliente}}! Aqui é o {{nome_assistente}} da equipe {{nome_empresa}}. Tudo bem?",
      qualificationObjective: "COMPRA",
      customPromptContext: "Trabalhamos principalmente com Minha Casa Minha Vida e imóveis até R$ 450 mil em Feira de Santana. Não informe taxas de juros exatas.",
      targetPipelineId: sales.id, targetStageId: S[0].id, qualifiedStageId: S[1].id, distributionMode: "ROULETTE", inactivityTimeoutHours: 24,
      questions: { create: AI_PRESET_QUESTIONS.MCMV_ECONOMICO.map((q, i) => ({ ...q, order: i + 1 })) },
      faqs: { create: DEFAULT_FAQS },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  const Q = aiConfig.questions;
  for (const def of AUTOMATION_DEFS) {
    const enabled = ["WHATSAPP_QUALIFICATION", "VISIT_REMINDER", "BROKER_FOLLOWUP"].includes(def.type);
    const configJson: Prisma.InputJsonValue =
      def.type === "VISIT_REMINDER" ? { hoursBefore: 24, channelId: company.id } :
      def.type === "BROKER_FOLLOWUP" ? { minutesWithoutReply: 30 } :
      def.type === "LEAD_REENGAGEMENT" ? { inactiveDays: 15 } :
      def.type === "WHATSAPP_QUALIFICATION" ? { channelIds: [company.id, chMarcio.id] } : {};
    await prisma.aiAutomationRule.create({ data: { workspaceId: ws.id, type: def.type as never, isEnabled: enabled, configJson } });
  }

  // ---------------------------------------------------------------- Contatos
  const stageWeights = [14, 10, 7, 5, 4, 3, 7]; // distribuição por etapa
  const originPool: LeadOrigin[] = ["SEO_ORGANICO", "SEO_ORGANICO", "SEO_ORGANICO", "SEO_ORGANICO", "FACEBOOK_ADS", "FACEBOOK_ADS", "GOOGLE_ADS", "INDICACAO", "OLX", "PORTAIS", "SITE_DIRETO", "MANUAL"];
  const contacts = [];
  let idx = 0;
  for (const [si, count] of stageWeights.entries()) {
    for (let k = 0; k < count; k++) {
      idx++;
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const origin = pick(originPool);
      const stage = S[si];
      const won = stage.isWonStage;
      const broker = si === 0 && rand() < 0.45 ? null : pick([marcio, marcio, camila, rafael, beatriz]);
      const income = pick([1800, 2400, 3200, 4100, 4800, 5500, 7200, 9800]);
      const created = daysAgo(between(0, 85), between(0, 20));
      const isSeo = origin === "SEO_ORGANICO";
      const pageIdx = between(0, SEO_PAGES.length - 1);
      const trackingCode = isSeo ? `#SEO-${String(1000 + idx * 37).slice(-4)}` : origin === "GOOGLE_ADS" ? `#ADS-${String(2000 + idx * 13).slice(-4)}` : null;
      const contact = await prisma.contact.create({
        data: {
          workspaceId: ws.id, name, phone: `55759${String(91000000 + idx * 7919).slice(0, 8)}`, email: rand() < 0.6 ? `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${idx}@email.com` : null,
          assignedToId: broker?.id ?? null, pipelineId: sales.id, stageId: stage.id, stageChangedAt: daysAgo(between(0, 20)),
          personType: "PF", city: "Feira de Santana", state: "BA", neighborhood: pick(HOODS), profession: pick(PROFESSIONS),
          maritalStatus: pick(["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)"]),
          monthlyIncome: si >= 1 ? income : null, downPaymentAvailable: si >= 1 ? pick([0, 5000, 10000, 15000, 25000, 40000]) : null,
          fgtsBalance: si >= 2 && rand() < 0.5 ? pick([4000, 8000, 12000, 22000]) : null, hasProperty: si >= 1 ? rand() < 0.15 : null,
          employmentType: si >= 1 ? pick(["CLT", "CLT", "AUTONOMO", "EMPRESARIO", "APOSENTADO"] as const) : null,
          buyingAlone: si >= 1 ? pick(["Sozinho(a)", "Com cônjuge/parceiro(a)", "Com familiar"]) : null,
          dealValue: si >= 3 ? pick([159900, 175000, 189000, 245000, 365000, 420000]) : si >= 1 ? pick([150000, 180000, 200000]) : null,
          status: won ? "WON" : si === 0 && rand() < 0.1 ? "LOST" : "OPEN",
          aiQualificationEnabled: true,
          aiQualificationSummary: null,
          tags: rand() < 0.5 ? [pick(TAG_POOL)] : rand() < 0.3 ? [pick(TAG_POOL), pick(TAG_POOL)].filter((v, i, a) => a.indexOf(v) === i) : [],
          origin,
          seoLandingPage: isSeo ? SEO_PAGES[pageIdx] : origin === "GOOGLE_ADS" ? "https://horizonteimoveis.com.br/lp/feirao-mcmv" : null,
          seoReferrer: isSeo ? "https://www.google.com/" : null,
          seoKeyword: isSeo ? SEO_KEYWORDS[pageIdx] : origin === "GOOGLE_ADS" ? "imóvel mcmv feira de santana" : null,
          utmSource: origin === "FACEBOOK_ADS" ? "facebook" : origin === "GOOGLE_ADS" ? "google" : null,
          utmMedium: origin === "FACEBOOK_ADS" || origin === "GOOGLE_ADS" ? "cpc" : null,
          utmCampaign: origin === "FACEBOOK_ADS" ? "leads-mcmv-out" : origin === "GOOGLE_ADS" ? "search-mcmv" : null,
          trackingCode,
          birthDate: rand() < 0.4 ? new Date(between(1970, 2000), between(0, 11), between(1, 28)) : null,
          cpfCnpj: si >= 4 ? `${between(100, 999)}.${between(100, 999)}.${between(100, 999)}-${between(10, 99)}` : null,
          lastInteractionAt: hoursAgo(between(1, 24 * 20)),
          createdAt: created,
        },
      });
      contacts.push(contact);
      if (trackingCode) {
        await prisma.trackingSession.create({
          data: {
            workspaceId: ws.id, code: trackingCode.slice(1), origin, landingPage: contact.seoLandingPage!, referrer: contact.seoReferrer, keyword: contact.seoKeyword,
            utmSource: contact.utmSource, utmMedium: contact.utmMedium, utmCampaign: contact.utmCampaign, event: "whatsapp_message", contactId: contact.id, createdAt: created,
          },
        });
      }
      if (si > 0) {
        await prisma.activity.create({ data: { workspaceId: ws.id, contactId: contact.id, userId: broker?.id, type: "STAGE_CHANGE", title: `Etapa alterada de ${S[si - 1].name} para ${stage.name}`, createdAt: contact.stageChangedAt } });
      }
      if (broker) await prisma.activity.create({ data: { workspaceId: ws.id, contactId: contact.id, userId: broker.id, type: "ASSIGNMENT", title: `Lead atribuído a ${broker.name} (roleta)`, metaJson: { via: "ROULETTE" }, createdAt: created } });
    }
  }
  // sessões de rastreio de visitas que ainda não viraram lead
  for (let i = 0; i < 40; i++) {
    const p = between(0, SEO_PAGES.length - 1);
    await prisma.trackingSession.create({ data: { workspaceId: ws.id, code: `SEO-${String(5000 + i * 17)}`, origin: "SEO_ORGANICO", landingPage: SEO_PAGES[p], referrer: "https://www.google.com/", keyword: SEO_KEYWORDS[p], createdAt: daysAgo(between(0, 60)) } });
  }
  // contatos de aluguel
  for (let i = 0; i < 8; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    contacts.push(await prisma.contact.create({
      data: {
        workspaceId: ws.id, name, phone: `55759${String(87000000 + i * 3571).slice(0, 8)}`, pipelineId: rent.id, stageId: rent.stages[i % rent.stages.length].id,
        assignedToId: pick([camila, beatriz]).id, origin: pick(["SEO_ORGANICO", "OLX", "PORTAIS"] as const), dealValue: pick([1100, 1350, 1800, 2200]),
        status: rent.stages[i % rent.stages.length].isWonStage ? "WON" : "OPEN", tags: ["locação"], createdAt: daysAgo(between(1, 40)), lastInteractionAt: daysAgo(between(0, 10)),
      },
    }));
  }

  // ---------------------------------------------------------------- Conversas
  type M = { from: "c" | "ai" | "u" | "sys"; text: string; ago: number; user?: typeof marcio; mediaType?: "TEXT" | "AUDIO" | "IMAGE" | "TEMPLATE" };
  async function conversation(opts: {
    contactIdx: number; channel: typeof company; status: "UNREAD" | "NEEDS_REPLY" | "WITH_AI" | "OPEN" | "CLOSED"; aiActive?: boolean; aiState?: Prisma.InputJsonValue;
    messages: M[]; unread?: number; name?: string; summary?: string; assignTo?: typeof marcio | null; stageIdx?: number;
  }) {
    const ct = contacts[opts.contactIdx];
    const patch: Prisma.ContactUpdateInput = {};
    if (opts.name) patch.name = opts.name;
    if (opts.summary) { patch.aiQualificationSummary = opts.summary; patch.aiQualifiedAt = minutesAgo(opts.messages[opts.messages.length - 1].ago); }
    if (opts.assignTo !== undefined) patch.assignedTo = opts.assignTo ? { connect: { id: opts.assignTo.id } } : { disconnect: true };
    if (opts.stageIdx !== undefined) patch.stage = { connect: { id: S[opts.stageIdx].id } };
    const contact = Object.keys(patch).length ? await prisma.contact.update({ where: { id: ct.id }, data: patch }) : ct;
    const lastContact = [...opts.messages].reverse().find((m) => m.from === "c");
    const last = opts.messages[opts.messages.length - 1];
    const conv = await prisma.conversation.create({
      data: {
        workspaceId: ws.id, contactId: contact.id, channelId: opts.channel.id, assignedToId: contact.assignedToId, status: opts.status, aiActive: !!opts.aiActive,
        aiState: opts.aiState ?? {}, unreadCount: opts.unread ?? 0,
        lastContactMessageAt: lastContact ? minutesAgo(lastContact.ago) : null,
        metaWindowExpiresAt: lastContact ? new Date(minutesAgo(lastContact.ago).getTime() + 86400000) : null,
        lastMessagePreview: last.text.slice(0, 120), lastMessageAt: minutesAgo(last.ago), createdAt: minutesAgo(opts.messages[0].ago),
      },
    });
    for (const m of opts.messages) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: m.from === "c" ? "CONTACT" : m.from === "ai" ? "AI_AGENT" : m.from === "sys" ? "SYSTEM" : "USER",
          senderName: m.from === "c" ? contact.name : m.from === "ai" ? "IA: Téo" : m.from === "sys" ? "Campanha" : (m.user ?? marcio).name,
          senderUserId: m.from === "u" ? (m.user ?? marcio).id : null,
          content: m.text, mediaType: m.mediaType ?? "TEXT", status: m.from === "c" ? "DELIVERED" : "READ", createdAt: minutesAgo(m.ago),
        },
      });
    }
    await prisma.contact.update({ where: { id: contact.id }, data: { lastInteractionAt: minutesAgo(last.ago) } });
    return conv;
  }

  // 1) Téo qualificando agora (em andamento)
  await conversation({
    contactIdx: 0, channel: company, status: "WITH_AI", aiActive: true, name: "Mariana Cerqueira", assignTo: null,
    aiState: { step: "QUALIFYING", currentQuestionId: Q[2].id, answered: { [Q[0].id]: "CLT", [Q[1].id]: "R$ 3.800,00" }, skipped: [], attempts: {}, collected: { employmentType: "CLT", monthlyIncome: 3800 } },
    messages: [
      { from: "c", text: "Oi, vi no Google o apartamento de 2 quartos no Santa Mônica. Ainda tem?\n\n[Ref: #SEO-1037]", ago: 14 },
      { from: "ai", text: "Olá Mariana! Aqui é o Téo da equipe Horizonte Imóveis. Tudo bem? 😊", ago: 14 },
      { from: "ai", text: "Vou te fazer algumas perguntas rápidas pra entender o que você procura e te encaminhar para o corretor ideal.", ago: 14 },
      { from: "ai", text: "Trabalha de carteira assinada ou é autônomo?", ago: 14 },
      { from: "c", text: "Carteira assinada, sou auxiliar administrativa", ago: 11 },
      { from: "ai", text: "Perfeito!", ago: 11 },
      { from: "ai", text: "Qual a renda bruta da família, mais ou menos?", ago: 11 },
      { from: "c", text: "uns 3.800", ago: 6 },
      { from: "ai", text: "Ótimo!", ago: 6 },
      { from: "ai", text: "Já tem imóvel no nome?", ago: 6 },
    ],
  });
  // 2) Téo concluiu e passou para o Márcio (a responder)
  const summary2 = `🤖 Relatório de qualificação — Téo
Temperatura: Quente (90/100)

PERFIL
• Trabalho: CLT (carteira assinada)
• 3+ anos de carteira: Sim (5 anos)
• Renda familiar: R$ 4.500,00 — Faixa 2 (até R$ 4.700)
• Imóvel no nome: Não
• Compra: Com cônjuge/parceiro(a)

FINANCEIRO
• Entrada disponível: R$ 15.000,00
• FGTS: R$ 12.000,00
• Poder de compra estimado: ~R$ 230.000,00

ORIGEM: SEO / Busca Orgânica — página https://horizonteimoveis.com.br/blog/minha-casa-minha-vida-feira-de-santana — palavra-chave "minha casa minha vida feira de santana" (#SEO-1074)
Encerramento: qualificação concluída`;
  await conversation({
    contactIdx: 1, channel: company, status: "NEEDS_REPLY", unread: 1, name: "João Pedro Almeida", assignTo: marcio, stageIdx: 1, summary: summary2,
    aiState: { step: "DONE", handoffReason: "COMPLETED", answered: Object.fromEntries(Q.map((q) => [q.id, "ok"])), skipped: [], attempts: {}, collected: { employmentType: "CLT", monthlyIncome: 4500 } },
    messages: [
      { from: "c", text: "Boa tarde! Li o artigo de vocês sobre Minha Casa Minha Vida e queria saber se me encaixo\n\n[Ref: #SEO-1074]", ago: 95 },
      { from: "ai", text: "Olá João! Aqui é o Téo da equipe Horizonte Imóveis. Tudo bem? 😊", ago: 95 },
      { from: "ai", text: "Trabalha de carteira assinada ou é autônomo?", ago: 95 },
      { from: "c", text: "carteira assinada", ago: 92 },
      { from: "ai", text: "Qual a renda bruta da família, mais ou menos?", ago: 92 },
      { from: "c", text: "eu e minha esposa juntos uns 4500", ago: 88 },
      { from: "ai", text: "Já tem imóvel no nome?", ago: 88 },
      { from: "c", text: "não", ago: 86 },
      { from: "ai", text: "Tem mais de 3 anos de carteira assinada, somando tudo?", ago: 86 },
      { from: "c", text: "sim, 5 anos", ago: 85 },
      { from: "ai", text: "Qual o valor que tem de entrada?", ago: 85 },
      { from: "c", text: "Posso usar meu FGTS? tenho uns 12 mil", ago: 83 },
      { from: "ai", text: "Pode sim! O FGTS pode ser usado na entrada ou para amortizar o financiamento, desde que você tenha 3 anos de carteira assinada (somando todos os empregos) e não tenha imóvel no nome na mesma cidade.", ago: 83 },
      { from: "ai", text: "E voltando: Qual o valor que tem de entrada?", ago: 83 },
      { from: "c", text: "15 mil guardado", ago: 80 },
      { from: "ai", text: "Vai comprar sozinho ou com alguém?", ago: 80 },
      { from: "c", text: "com minha esposa", ago: 78 },
      { from: "ai", text: "Perfeito! Obrigado pelas informações 😊", ago: 78 },
      { from: "ai", text: "Perfeito! Já passei suas informações para um dos nossos corretores, que vai continuar seu atendimento por aqui em instantes. 😊", ago: 78 },
      { from: "c", text: "Show, fico no aguardo!", ago: 40 },
    ],
  });
  // 3) Janela de 24h expirada (precisa de modelo aprovado)
  await conversation({
    contactIdx: 20, channel: company, status: "OPEN", name: "Fernanda Bastos", assignTo: camila, stageIdx: 2,
    messages: [
      { from: "c", text: "Oi, queria agendar uma visita na casa do Tomba", ago: 60 * 52 },
      { from: "u", user: camila, text: "Olá Fernanda! Claro, pode ser sábado às 10h?", ago: 60 * 51 },
      { from: "c", text: "Pode sim, combinado", ago: 60 * 50 },
      { from: "u", user: camila, text: "Agendado! Te mando a localização na sexta. 🏡", ago: 60 * 49 },
    ],
  });
  // 4) Não lida no número do Márcio (Evolution QR)
  await conversation({
    contactIdx: 30, channel: chMarcio, status: "UNREAD", unread: 2, name: "Carlos Eduardo Rocha", assignTo: marcio, stageIdx: 3,
    messages: [
      { from: "u", user: marcio, text: "Carlos, segue a proposta do apartamento no Capuchinhos conforme conversamos.", ago: 60 * 20 },
      { from: "c", text: "Recebi! Vou ver com minha esposa", ago: 60 * 3 },
      { from: "c", text: "Conseguem baixar um pouco a entrada?", ago: 25 },
    ],
  });
  // 5) Áudio transcrito
  await conversation({
    contactIdx: 5, channel: company, status: "WITH_AI", aiActive: true, name: "Larissa Moreira", assignTo: null,
    aiState: { step: "QUALIFYING", currentQuestionId: Q[1].id, answered: { [Q[0].id]: "Autônomo" }, skipped: [], attempts: {}, collected: { employmentType: "AUTONOMO" } },
    messages: [
      { from: "c", text: "Olá, quero saber do lançamento no Papagaio", ago: 33 },
      { from: "ai", text: "Olá Larissa! Aqui é o Téo da equipe Horizonte Imóveis. Tudo bem? 😊", ago: 33 },
      { from: "ai", text: "Trabalha de carteira assinada ou é autônomo?", ago: 33 },
      { from: "c", text: "🎙️ Transcrição: eu sou autônoma, tenho um salão de beleza aqui no bairro", ago: 29, mediaType: "AUDIO" },
      { from: "ai", text: "Legal!", ago: 29 },
      { from: "ai", text: "Qual a renda bruta da família, mais ou menos?", ago: 29 },
    ],
  });
  // 6) Resposta a campanha
  await conversation({
    contactIdx: 45, channel: company, status: "NEEDS_REPLY", unread: 1, name: "Ricardo Pinheiro", assignTo: rafael, stageIdx: 6,
    messages: [
      { from: "sys", text: "Olá Ricardo! Que alegria ter você como cliente Horizonte. 🏡 Você conhece alguém que também quer sair do aluguel? Indique 5 amigos e ganhe um vale-presente de R$ 200!", ago: 60 * 6, mediaType: "TEMPLATE" },
      { from: "c", text: "Eu quero! Vou te mandar uns contatos", ago: 60 * 2 },
    ],
  });
  // 7..12) conversas diversas
  const misc: [number, typeof company, "OPEN" | "CLOSED" | "NEEDS_REPLY", typeof marcio, string, string][] = [
    [8, company, "OPEN", camila, "Pode me mandar mais fotos da cozinha?", "Claro! Te envio agora mesmo."],
    [12, chMarcio, "OPEN", marcio, "Qual o valor do condomínio?", "O condomínio é R$ 280 com água inclusa."],
    [16, company, "CLOSED", beatriz, "Obrigada, por enquanto não tenho interesse", "Tudo bem! Fico à disposição."],
    [25, chCamila, "NEEDS_REPLY", camila, "Aceitam permuta com um carro?", ""],
    [33, company, "OPEN", rafael, "Vou levar os documentos amanhã", "Perfeito, te espero às 9h no escritório."],
    [38, company, "NEEDS_REPLY", beatriz, "Bom dia! Ainda tem a casa da Cidade Nova?", ""],
  ];
  for (const [i, [cidx, ch, status, user, cText, uText]] of misc.entries()) {
    const msgs: M[] = [{ from: "c", text: cText, ago: 60 * (i + 2) + 30 }];
    if (uText) msgs.push({ from: "u", user, text: uText, ago: 60 * (i + 2) });
    await conversation({ contactIdx: cidx, channel: ch, status, assignTo: user, unread: uText ? 0 : 1, messages: msgs });
  }

  // ---------------------------------------------------------------- Agenda
  const taskDefs = [
    { c: 20, u: camila, title: "Visita casa no Tomba (CA-087)", type: "VISIT" as const, due: daysAgo(-1, -10) },
    { c: 30, u: marcio, title: "Retornar contraproposta", type: "CALL" as const, due: daysAgo(1) },
    { c: 1, u: marcio, title: "Ligar para João Pedro (lead quente do Téo)", type: "CALL" as const, due: hoursAgo(-2) },
    { c: 33, u: rafael, title: "Conferir documentação para financiamento", type: "DOCUMENTATION" as const, due: daysAgo(-1) },
    { c: 8, u: camila, title: "Visita AP-201 Santa Mônica", type: "VISIT" as const, due: daysAgo(-2, -6) },
    { c: 12, u: marcio, title: "Visita Residencial Jardim Papagaio", type: "VISIT" as const, due: daysAgo(-3, -4) },
    { c: 38, u: beatriz, title: "Follow-up: enviar opções de casas", type: "FOLLOW_UP" as const, due: daysAgo(2) },
    { c: 40, u: rafael, title: "Visita cobertura Ponto Central", type: "VISIT" as const, due: daysAgo(-5, -3) },
    { c: 15, u: marcio, title: "Enviar simulação Caixa", type: "FOLLOW_UP" as const, due: daysAgo(3) },
    { c: 22, u: camila, title: "Visita realizada CA-133", type: "VISIT" as const, due: daysAgo(1), done: true },
  ];
  for (const t of taskDefs) {
    await prisma.task.create({ data: { workspaceId: ws.id, contactId: contacts[t.c].id, assignedToId: t.u.id, title: t.title, type: t.type, dueDate: t.due, isCompleted: !!t.done, completedAt: t.done ? daysAgo(1) : null } });
  }
  await prisma.activity.create({ data: { workspaceId: ws.id, contactId: contacts[30].id, userId: marcio.id, type: "NOTE", title: "Anotação", body: "Cliente pediu desconto na entrada. Verificar com o proprietário se aceita 10% em vez de 15%." } });

  // ---------------------------------------------------------------- Modelos Meta e campanhas
  const tpl = async (data: Omit<Prisma.MessageTemplateUncheckedCreateInput, "workspaceId">) => prisma.messageTemplate.create({ data: { workspaceId: ws.id, channelId: company.id, ...data } });
  const tWelcome = await tpl({ name: "boas_vindas_lead", category: "UTILITY", bodyText: "Olá {{1}}, aqui é da Horizonte Imóveis! Recebemos seu contato e o corretor {{2}} vai te atender. Podemos continuar por aqui?", variableMappings: { "1": "contact.firstName", "2": "user.name" }, footerText: "Horizonte Imóveis • Feira de Santana", buttonsJson: [{ type: "QUICK_REPLY", text: "Sim, pode falar" }, { type: "QUICK_REPLY", text: "Agora não" }], metaStatus: "APPROVED" });
  const tPromo = await tpl({ name: "feirao_mcmv_novembro", category: "MARKETING", headerType: "IMAGE", headerContent: "https://picsum.photos/seed/feirao/800/400", bodyText: "Oi {{1}}! 🏡 Feirão Minha Casa Minha Vida da Horizonte: entrada facilitada e uso do FGTS. Quer ver as opções no bairro {{2}}?", variableMappings: { "1": "contact.firstName", "2": "contact.neighborhood" }, footerText: "Responda SAIR para não receber mais", buttonsJson: [{ type: "QUICK_REPLY", text: "Eu quero!" }, { type: "URL", text: "Ver imóveis", value: "https://horizonteimoveis.com.br/mcmv" }], metaStatus: "APPROVED" });
  await tpl({ name: "lembrete_visita", category: "UTILITY", bodyText: "Olá {{1}}, lembrando da sua visita agendada com {{2}}. Confirma presença?", variableMappings: { "1": "contact.firstName", "2": "user.name" }, buttonsJson: [{ type: "QUICK_REPLY", text: "Confirmo" }, { type: "QUICK_REPLY", text: "Preciso remarcar" }], metaStatus: "APPROVED" });
  const tRef = await tpl({ name: "pedido_indicacao", category: "MARKETING", bodyText: "Olá {{1}}! Que alegria ter você como cliente Horizonte. 🏡 Você conhece alguém que também quer sair do aluguel? Indique 5 amigos e ganhe um vale-presente de R$ 200!", variableMappings: { "1": "contact.firstName" }, metaStatus: "APPROVED" });
  await tpl({ name: "reengajamento_leads", category: "MARKETING", bodyText: "Oi {{1}}, tudo bem? Chegaram novas opções de imóveis com parcelas a partir de R$ 900. Quer que eu te mande?", variableMappings: { "1": "contact.firstName" }, metaStatus: "PENDING" });
  void tWelcome;

  const wonContacts = contacts.filter((c) => c.stageId === S[6].id);
  const camp1 = await prisma.campaign.create({
    data: {
      workspaceId: ws.id, name: "Indicações — clientes que fecharam", channelId: company.id, templateId: tRef.id, sendScheduleType: "NOW", routeRepliesToAi: false,
      filtersJson: { pipelineId: sales.id, stageIds: [S[6].id] }, totalRecipients: wonContacts.length, estimatedCost: wonContacts.length * META_PRICING.MARKETING,
      sentCount: wonContacts.length, deliveredCount: wonContacts.length, readCount: Math.round(wonContacts.length * 0.8), repliedCount: 2, status: "COMPLETED", startedAt: hoursAgo(6), completedAt: hoursAgo(6), createdAt: hoursAgo(7),
    },
  });
  for (const [i, c] of wonContacts.entries()) {
    await prisma.campaignRecipient.create({ data: { campaignId: camp1.id, contactId: c.id, status: i < 2 ? "REPLIED" : "READ", sentAt: hoursAgo(6), repliedAt: i < 2 ? hoursAgo(2) : null } });
  }
  const visitContacts = contacts.filter((c) => c.stageId === S[2].id);
  await prisma.campaign.create({
    data: {
      workspaceId: ws.id, name: "Feirão MCMV — Visita agendada", channelId: company.id, templateId: tPromo.id, abTestEnabled: false, sendScheduleType: "SCHEDULED", scheduledAt: daysAgo(-2), allowedSendUntilHour: "18:00", routeRepliesToAi: true,
      filtersJson: { pipelineId: sales.id, stageIds: [S[2].id] }, totalRecipients: visitContacts.length, estimatedCost: visitContacts.length * META_PRICING.MARKETING, status: "SCHEDULED",
    },
  });
  await prisma.campaign.create({
    data: { workspaceId: ws.id, name: "Carteira do Márcio — reengajamento", channelId: chMarcio.id, templateId: tPromo.id, filtersJson: { assignedToIds: [marcio.id] }, status: "DRAFT", routeRepliesToAi: true },
  });

  // ---------------------------------------------------------------- Diversos
  await prisma.quickReply.createMany({
    data: [
      { workspaceId: ws.id, shortcut: "/docs", content: "Para a análise de crédito: RG, CPF, comprovante de residência, estado civil e os 3 últimos contracheques." },
      { workspaceId: ws.id, shortcut: "/visita", content: "Que tal agendarmos uma visita? Tenho horários amanhã às 10h ou às 15h. Qual fica melhor pra você?" },
      { workspaceId: ws.id, shortcut: "/endereco", content: "Nosso escritório fica na Av. Getúlio Vargas, 1200 – Centro, Feira de Santana. Funcionamos de seg a sex, 8h às 18h, e sábado até 12h." },
      { workspaceId: ws.id, shortcut: "/simulacao", content: "Vou fazer uma simulação na Caixa pra você. Me confirma: renda bruta, data de nascimento e se tem 3 anos de FGTS?" },
    ],
  });
  await prisma.integration.createMany({
    data: [
      { workspaceId: ws.id, type: "FACEBOOK_LEAD_ADS", name: "Formulário MCMV Outubro", isEnabled: true, leadsReceived: 38, lastEventAt: hoursAgo(5), configJson: { pageName: "Horizonte Imóveis", formId: "fb-form-88231", fieldMap: { full_name: "name", phone_number: "phone", email: "email", "qual_sua_renda?": "monthlyIncome" }, pipelineId: sales.id, stageId: S[0].id } },
      { workspaceId: ws.id, type: "GOOGLE_ADS", name: "Lead Form Search MCMV", isEnabled: true, leadsReceived: 12, lastEventAt: daysAgo(1), configJson: { customerId: "123-456-7890", pipelineId: sales.id, stageId: S[0].id } },
      { workspaceId: ws.id, type: "PORTAL_OLX", name: "Grupo OLX (ZAP + Viva Real)", isEnabled: true, leadsReceived: 21, lastEventAt: hoursAgo(9), configJson: { pipelineId: sales.id, stageId: S[0].id } },
      { workspaceId: ws.id, type: "PORTAL_CHAVES_NA_MAO", name: "Chaves na Mão", isEnabled: false, configJson: {} },
      { workspaceId: ws.id, type: "PORTAL_IMOVELWEB", name: "Imovelweb", isEnabled: false, configJson: {} },
    ],
  });
  await prisma.leadForm.create({
    data: { workspaceId: ws.id, name: "Simulação MCMV (site)", pipelineId: sales.id, stageId: S[0].id, submissions: 27, fieldsJson: [{ key: "name", label: "Nome", type: "text", required: true }, { key: "phone", label: "WhatsApp", type: "tel", required: true }, { key: "monthlyIncome", label: "Renda familiar", type: "number", required: false }] },
  });
  for (const u of [manager, assistant, marcio]) {
    await prisma.notification.create({ data: { workspaceId: ws.id, userId: u.id, title: "Novo lead qualificado pelo Téo: João Pedro Almeida", body: "Quente (90/100) · Renda R$ 4.500 · Entrada R$ 15.000", link: `/atendimento?contato=${contacts[1].id}` } });
  }
  await prisma.notification.create({ data: { workspaceId: ws.id, userId: manager.id, title: "Número de Camila Souza requer atenção", body: "Reconecte o QR Code em Integrações.", link: "/integracoes" } });

  console.log("✅ Seed concluído!");
  console.log("   Login (senha teo123456): gestor@horizonte.com.br · assistente@horizonte.com.br · corretor@horizonte.com.br · marcio@horizonte.com.br · agencia@rankalto.com.br");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
