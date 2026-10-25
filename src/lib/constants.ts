// Constantes compartilhadas entre servidor e cliente (não importar nada de servidor aqui).

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AGENCY_ADMIN: "Agência SEO",
  MANAGER: "Gestor",
  ASSISTANT: "Assistente",
  BROKER: "Corretor",
};

export const ORIGIN_LABELS: Record<string, string> = {
  SEO_ORGANICO: "SEO / Busca Orgânica",
  GOOGLE_ADS: "Google Ads",
  FACEBOOK_ADS: "Facebook Ads",
  INDICACAO: "Indicação",
  PORTAIS: "Portais",
  OLX: "OLX",
  SITE_DIRETO: "Site Direto",
  MANUAL: "Manual",
};

export const ORIGIN_SHORT: Record<string, string> = {
  SEO_ORGANICO: "Google Orgânico",
  GOOGLE_ADS: "Google Ads",
  FACEBOOK_ADS: "Facebook Ads",
  INDICACAO: "Indicação",
  PORTAIS: "Portais",
  OLX: "OLX",
  SITE_DIRETO: "Site",
  MANUAL: "Manual",
};

export const ORIGIN_BADGE: Record<string, string> = {
  SEO_ORGANICO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GOOGLE_ADS: "bg-amber-50 text-amber-700 ring-amber-200",
  FACEBOOK_ADS: "bg-blue-50 text-blue-700 ring-blue-200",
  INDICACAO: "bg-violet-50 text-violet-700 ring-violet-200",
  PORTAIS: "bg-orange-50 text-orange-700 ring-orange-200",
  OLX: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  SITE_DIRETO: "bg-sky-50 text-sky-700 ring-sky-200",
  MANUAL: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const ORIGINS = Object.keys(ORIGIN_LABELS);

export const EMPLOYMENT_LABELS: Record<string, string> = {
  CLT: "CLT (carteira assinada)",
  AUTONOMO: "Autônomo",
  EMPRESARIO: "Empresário",
  APOSENTADO: "Aposentado",
};

export const DEFAULT_STAGES = [
  { name: "Lead", color: "#64748B" },
  { name: "Qualificação", color: "#2563EB" },
  { name: "Visita agendada", color: "#0EA5E9" },
  { name: "Proposta", color: "#4F46E5" },
  { name: "Negociação", color: "#9333EA" },
  { name: "Documentação", color: "#F59E0B" },
  { name: "Fechado", color: "#16A34A", isWonStage: true },
];

/** Tarifas oficiais da Meta usadas na calculadora (BRL por mensagem entregue). */
export const META_PRICING: Record<string, number> = {
  MARKETING: 0.3217,
  UTILITY: 0.035,
  AUTHENTICATION: 0.035,
};

export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

/** Variáveis disponíveis no injetor de templates: chave -> rótulo. */
export const TEMPLATE_VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: "contact.firstName", label: "Contato - Nome", sample: "Mariana" },
  { key: "contact.phone", label: "Contato - Telefone", sample: "+55 (75) 99812-3344" },
  { key: "contact.email", label: "Contato - E-mail", sample: "mariana@email.com" },
  { key: "contact.cpfCnpj", label: "CPF/CNPJ", sample: "123.456.789-00" },
  { key: "contact.cityUf", label: "Cidade/UF", sample: "Feira de Santana/BA" },
  { key: "contact.neighborhood", label: "Bairro", sample: "Santa Mônica" },
  { key: "contact.profession", label: "Profissão", sample: "Professora" },
  { key: "contact.monthlyIncome", label: "Renda", sample: "R$ 4.500,00" },
  { key: "user.name", label: "Corretor - Nome", sample: "Márcio" },
  { key: "workspace.name", label: "Empresa - Nome", sample: "Imobiliária" },
];

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  UNREAD: "Não lida",
  NEEDS_REPLY: "A responder",
  WITH_AI: "Com o Téo",
  OPEN: "Em atendimento",
  CLOSED: "Encerrada",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  VISIT: "Visita",
  CALL: "Ligação",
  FOLLOW_UP: "Follow-up",
  DOCUMENTATION: "Documentação",
};

export const TASK_TYPE_COLORS: Record<string, string> = {
  VISIT: "bg-sky-100 text-sky-800 border-sky-200",
  CALL: "bg-violet-100 text-violet-800 border-violet-200",
  FOLLOW_UP: "bg-amber-100 text-amber-800 border-amber-200",
  DOCUMENTATION: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const CATALOG_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  RENTED: "Alugado",
  INACTIVE: "Inativo",
};

// ---------------------------------------------------------------------------
// Téo — presets, campos e automações
// ---------------------------------------------------------------------------

export const AI_PRESET_LABELS: Record<string, string> = {
  MCMV_ECONOMICO: "MCMV / Econômico",
  MEDIO_PADRAO: "Médio padrão",
  ALTO_PADRAO: "Alto padrão",
  LOCACAO: "Locação",
  LANCAMENTO: "Lançamento",
  TERRENO: "Terreno",
  VENDA_E_LOCACAO: "Venda e locação",
  SERVICOS_SEO: "Serviços / SEO Geral",
  DO_ZERO: "Do zero",
};

export const AI_FOCUS_LABELS: Record<string, string> = { VENDAS: "Vendas", LOCACAO: "Locação", AMBOS: "Venda e locação" };
export const AI_TONE_LABELS: Record<string, string> = { INFORMAL: "Informal", NO_MEIO: "No meio", FORMAL: "Formal" };
export const AI_EMOJI_LABELS: Record<string, string> = { NENHUM: "Nenhum", POUCOS: "Poucos", MUITOS: "Muitos" };
export const AI_LENGTH_LABELS: Record<string, string> = { CURTAS_UMA_A_UMA: "Curtas, uma a uma", MEDIAS: "Médias", LONGAS: "Longas" };
export const DISTRIBUTION_LABELS: Record<string, string> = {
  ROULETTE: "Roleta de corretores",
  MANAGER_MANUAL: "Gestor distribui manualmente",
  FIXED_USER: "Usuário específico",
};

/** Campos do contato que uma pergunta de qualificação pode preencher. */
export const AI_TARGET_FIELDS: { key: string; label: string }[] = [
  { key: "employmentType", label: "Tipo de trabalho (CLT/Autônomo)" },
  { key: "monthlyIncome", label: "Renda familiar" },
  { key: "hasProperty", label: "Tem imóvel no nome" },
  { key: "employmentYears", label: "Tempo de carteira" },
  { key: "downPaymentAvailable", label: "Valor de entrada" },
  { key: "buyingAlone", label: "Compra sozinho ou acompanhado" },
  { key: "fgtsBalance", label: "Saldo de FGTS" },
  { key: "neighborhood", label: "Bairro de interesse" },
  { key: "interest", label: "Interesse / tipo de imóvel" },
  { key: "profession", label: "Profissão" },
  { key: "maritalStatus", label: "Estado civil" },
  { key: "dealValue", label: "Orçamento / valor do negócio" },
];

type PresetQuestion = { questionText: string; requirementMode: "SE_DER" | "OBRIGATORIA"; targetField: string | null };

const MCMV: PresetQuestion[] = [
  { questionText: "Trabalha de carteira assinada ou é autônomo?", requirementMode: "OBRIGATORIA", targetField: "employmentType" },
  { questionText: "Qual a renda bruta da família, mais ou menos?", requirementMode: "OBRIGATORIA", targetField: "monthlyIncome" },
  { questionText: "Já tem imóvel no nome?", requirementMode: "SE_DER", targetField: "hasProperty" },
  { questionText: "Tem mais de 3 anos de carteira assinada, somando tudo?", requirementMode: "SE_DER", targetField: "employmentYears" },
  { questionText: "Qual o valor que tem de entrada?", requirementMode: "SE_DER", targetField: "downPaymentAvailable" },
  { questionText: "Vai comprar sozinho ou com alguém?", requirementMode: "SE_DER", targetField: "buyingAlone" },
];

export const AI_PRESET_QUESTIONS: Record<string, PresetQuestion[]> = {
  MCMV_ECONOMICO: MCMV,
  MEDIO_PADRAO: [
    { questionText: "Você procura casa ou apartamento?", requirementMode: "OBRIGATORIA", targetField: "interest" },
    { questionText: "Tem preferência de bairro?", requirementMode: "SE_DER", targetField: "neighborhood" },
    { questionText: "Até quanto pretende investir no imóvel?", requirementMode: "OBRIGATORIA", targetField: "dealValue" },
    { questionText: "Pretende financiar? Qual a renda familiar, mais ou menos?", requirementMode: "SE_DER", targetField: "monthlyIncome" },
    { questionText: "Quanto tem disponível de entrada?", requirementMode: "SE_DER", targetField: "downPaymentAvailable" },
    { questionText: "Vai comprar sozinho ou com alguém?", requirementMode: "SE_DER", targetField: "buyingAlone" },
  ],
  ALTO_PADRAO: [
    { questionText: "Qual tipo de imóvel você busca (casa em condomínio, cobertura, apartamento)?", requirementMode: "OBRIGATORIA", targetField: "interest" },
    { questionText: "Tem preferência de bairro ou condomínio?", requirementMode: "SE_DER", targetField: "neighborhood" },
    { questionText: "Qual a faixa de investimento que faz sentido pra você?", requirementMode: "OBRIGATORIA", targetField: "dealValue" },
    { questionText: "A compra seria à vista, financiada ou com permuta?", requirementMode: "SE_DER", targetField: null },
    { questionText: "É para moradia ou investimento?", requirementMode: "SE_DER", targetField: null },
  ],
  LOCACAO: [
    { questionText: "Procura casa ou apartamento para alugar?", requirementMode: "OBRIGATORIA", targetField: "interest" },
    { questionText: "Qual bairro você prefere?", requirementMode: "SE_DER", targetField: "neighborhood" },
    { questionText: "Até quanto pode pagar de aluguel por mês?", requirementMode: "OBRIGATORIA", targetField: "dealValue" },
    { questionText: "Qual a renda mensal, mais ou menos? (a imobiliária costuma pedir 3x o aluguel)", requirementMode: "SE_DER", targetField: "monthlyIncome" },
    { questionText: "Tem fiador, seguro-fiança ou prefere caução?", requirementMode: "SE_DER", targetField: null },
    { questionText: "Para quando precisa se mudar?", requirementMode: "SE_DER", targetField: null },
  ],
  LANCAMENTO: [
    { questionText: "Você conheceu o lançamento por onde?", requirementMode: "SE_DER", targetField: null },
    { questionText: "Prefere quantos quartos?", requirementMode: "SE_DER", targetField: "interest" },
    { questionText: "Qual a renda familiar, mais ou menos?", requirementMode: "OBRIGATORIA", targetField: "monthlyIncome" },
    { questionText: "Quanto consegue dar de entrada (ou parcelar durante a obra)?", requirementMode: "SE_DER", targetField: "downPaymentAvailable" },
    { questionText: "Pretende usar FGTS? Sabe mais ou menos o saldo?", requirementMode: "SE_DER", targetField: "fgtsBalance" },
  ],
  TERRENO: [
    { questionText: "O terreno é para construir moradia ou investimento?", requirementMode: "SE_DER", targetField: "interest" },
    { questionText: "Qual região ou bairro você procura?", requirementMode: "OBRIGATORIA", targetField: "neighborhood" },
    { questionText: "Qual tamanho mínimo de terreno?", requirementMode: "SE_DER", targetField: null },
    { questionText: "Qual a faixa de valor que pretende investir?", requirementMode: "OBRIGATORIA", targetField: "dealValue" },
    { questionText: "Seria à vista ou parcelado?", requirementMode: "SE_DER", targetField: null },
  ],
  VENDA_E_LOCACAO: [
    { questionText: "Você quer comprar ou alugar?", requirementMode: "OBRIGATORIA", targetField: "interest" },
    { questionText: "Qual bairro você prefere?", requirementMode: "SE_DER", targetField: "neighborhood" },
    { questionText: "Qual valor máximo (de compra ou de aluguel)?", requirementMode: "OBRIGATORIA", targetField: "dealValue" },
    { questionText: "Qual a renda familiar, mais ou menos?", requirementMode: "SE_DER", targetField: "monthlyIncome" },
    { questionText: "Para quando precisa do imóvel?", requirementMode: "SE_DER", targetField: null },
  ],
  SERVICOS_SEO: [
    { questionText: "Qual serviço você está procurando?", requirementMode: "OBRIGATORIA", targetField: "interest" },
    { questionText: "É para você ou para sua empresa?", requirementMode: "SE_DER", targetField: null },
    { questionText: "Em qual cidade/bairro você está?", requirementMode: "SE_DER", targetField: "neighborhood" },
    { questionText: "Tem um orçamento previsto?", requirementMode: "SE_DER", targetField: "dealValue" },
    { questionText: "Para quando você precisa?", requirementMode: "SE_DER", targetField: null },
  ],
  DO_ZERO: [],
};

export const DEFAULT_FAQS: { questionTitle: string; answerText: string; keywords: string[]; isEnabled: boolean }[] = [
  {
    questionTitle: "Posso usar meu FGTS?",
    answerText: "Pode sim! O FGTS pode ser usado na entrada ou para amortizar o financiamento, desde que você tenha 3 anos de carteira assinada (somando todos os empregos) e não tenha imóvel no nome na mesma cidade.",
    keywords: ["fgts", "fundo de garantia"],
    isEnabled: true,
  },
  {
    questionTitle: "Quais documentos vai precisar separar?",
    answerText: "Para a análise de crédito geralmente pedimos: RG e CPF, comprovante de residência, comprovante de estado civil, os 3 últimos contracheques (ou extratos, se for autônomo) e a carteira de trabalho. O corretor confirma a lista certinha com você.",
    keywords: ["documento", "documentos", "papelada", "papéis"],
    isEnabled: true,
  },
  {
    questionTitle: "Tem escritura, consegue financiar?",
    answerText: "Sim! Trabalhamos com imóveis com documentação regularizada (escritura e matrícula), o que permite financiar normalmente pela Caixa ou por outros bancos.",
    keywords: ["escritura", "financiar", "financiamento", "matrícula"],
    isEnabled: true,
  },
  {
    questionTitle: "Aceita permuta (troca)?",
    answerText: "Em alguns imóveis o proprietário aceita permuta, sim. Me conta qual bem você teria para oferecer que o corretor avalia com você.",
    keywords: ["permuta", "troca", "trocar"],
    isEnabled: false,
  },
];

export const AUTOMATION_DEFS: { type: string; name: string; description: string }[] = [
  { type: "WHATSAPP_QUALIFICATION", name: "Atendimento no WhatsApp", description: "O Téo responde novos leads na hora, faz as perguntas de qualificação e passa para o corretor." },
  { type: "VISIT_REMINDER", name: "Lembrete de visita", description: "Envia lembrete ao cliente e ao corretor antes de cada visita agendada." },
  { type: "BROKER_FOLLOWUP", name: "Acompanhamento do corretor", description: "Cobra o corretor quando um lead fica sem resposta além do tempo combinado." },
  { type: "POST_VISIT", name: "Pós-visita", description: "Pergunta ao cliente o que achou do imóvel no dia seguinte à visita." },
  { type: "LEAD_REENGAGEMENT", name: "Reengajamento de leads", description: "Retoma conversas com leads parados há muitos dias com uma mensagem leve." },
  { type: "ANNUAL_DATES", name: "Datas anuais", description: "Parabeniza clientes no aniversário e no aniversário de compra do imóvel." },
];

export const ONBOARDING_STEPS = [
  { key: "whatsapp", title: "Conectar WhatsApp", description: "Conecte o número oficial da empresa ou o WhatsApp dos corretores.", href: "/integracoes" },
  { key: "catalog", title: "Cadastrar o primeiro imóvel/serviço", description: "O Téo usa o catálogo para recomendar opções aos clientes.", href: "/imoveis" },
  { key: "team", title: "Convidar a equipe", description: "Adicione gestores, assistentes e corretores e monte a roleta.", href: "/equipe" },
  { key: "contact", title: "Criar um contato", description: "Cadastre ou importe sua base de clientes.", href: "/contatos" },
  { key: "seoScript", title: "Configurar o site (Script SEO)", description: "Instale o script de rastreio para saber qual página do Google gerou cada lead.", href: "/site-seo" },
] as const;

export type ModuleKey =
  | "atendimento"
  | "contatos"
  | "funis"
  | "imoveis"
  | "agenda"
  | "teo"
  | "relatorios"
  | "campanhas"
  | "site-seo"
  | "integracoes"
  | "equipe";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  atendimento: "Atendimento",
  contatos: "Contatos",
  funis: "Funis",
  imoveis: "Imóveis",
  agenda: "Agenda",
  teo: "Téo",
  relatorios: "Relatórios",
  campanhas: "Campanhas",
  "site-seo": "Site & SEO",
  integracoes: "Integrações",
  equipe: "Equipe",
};

export const DEFAULT_ASSISTANT_PERMISSIONS: Record<ModuleKey | "verTodosLeads", boolean> = {
  atendimento: true,
  contatos: true,
  funis: true,
  imoveis: true,
  agenda: true,
  teo: true,
  relatorios: false,
  campanhas: true,
  "site-seo": false,
  integracoes: false,
  equipe: false,
  verTodosLeads: true,
};

export const BROKER_MODULES: ModuleKey[] = ["atendimento", "contatos", "funis", "imoveis", "agenda", "teo"];
