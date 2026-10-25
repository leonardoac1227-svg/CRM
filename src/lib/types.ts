// Tipos de resposta usados no frontend (Decimal já serializado como number, datas como string)
export type Role = "SUPER_ADMIN" | "AGENCY_ADMIN" | "MANAGER" | "ASSISTANT" | "BROKER";

export type Me = {
  user: { id: string; name: string; email: string; role: Role; phone: string | null; workspaceId: string | null; permissions: Record<string, boolean>; inRoulette: boolean };
  workspace: { id: string; name: string; niche: string; city: string | null; state: string | null; trackerKey: string; siteUrl: string | null; onboardingProgress: Record<string, boolean> };
  agency: { id: string; name: string; slug: string; logoUrl: string | null; primaryColor: string; secondaryColor: string; assistantDefaultName: string; customDomain: string | null };
  modules: string[];
  seesOnlyOwn: boolean;
  assistantName: string;
  workspaces: { id: string; name: string; niche: string }[];
  demoMode: boolean;
};

export type UserLite = { id: string; name: string };

export type Stage = { id: string; pipelineId: string; name: string; order: number; color: string; isWonStage: boolean };
export type Pipeline = { id: string; name: string; isDefault: boolean; stages: Stage[]; contactsCount?: number };

export type Contact = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  personType: "PF" | "PJ";
  cpfCnpj: string | null;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  profession: string | null;
  maritalStatus: string | null;
  monthlyIncome: number | null;
  downPaymentAvailable: number | null;
  fgtsBalance: number | null;
  hasProperty: boolean | null;
  employmentType: string | null;
  employmentYears: string | null;
  buyingAlone: string | null;
  interest: string | null;
  dealValue: number | null;
  status: "OPEN" | "WON" | "LOST";
  aiQualificationEnabled: boolean;
  aiQualificationSummary: string | null;
  aiQualifiedAt: string | null;
  tags: string[];
  origin: string;
  seoLandingPage: string | null;
  seoReferrer: string | null;
  seoKeyword: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trackingCode: string | null;
  lastInteractionAt: string | null;
  createdAt: string;
  stageChangedAt: string;
  pipelineId: string | null;
  stageId: string | null;
  assignedToId: string | null;
  assignedTo?: UserLite | null;
  stage?: { id: string; name: string; color: string } | null;
  pipeline?: { id: string; name: string } | null;
  conversations?: { id: string }[];
};

export type Message = {
  id: string;
  senderType: "CONTACT" | "USER" | "AI_AGENT" | "SYSTEM";
  senderName: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "TEMPLATE";
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  createdAt: string;
};

export type Channel = {
  id: string;
  name: string;
  phoneNumber: string;
  provider: "META_OFFICIAL" | "EVOLUTION_QR";
  accountType: "COMPANY" | "BROKER";
  status: "CONNECTED" | "ATTENTION" | "DISCONNECTED";
  userId: string | null;
  user?: UserLite | null;
  lastActivityAt: string | null;
  metaWabaId?: string | null;
  metaPhoneNumberId?: string | null;
  evolutionInstance?: string | null;
  qrCode?: string | null;
  hasToken?: boolean;
  _count?: { conversations: number };
};

export type ConversationListItem = {
  id: string;
  status: "UNREAD" | "NEEDS_REPLY" | "WITH_AI" | "OPEN" | "CLOSED";
  aiActive: boolean;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  metaWindowExpiresAt: string | null;
  windowOpen: boolean;
  contact: { id: string; name: string | null; phone: string; origin: string; tags: string[]; stageId: string | null };
  channel: { id: string; name: string; phoneNumber: string; provider: string; accountType: string } | null;
  assignedTo: UserLite | null;
};

export type ConversationDetail = Omit<ConversationListItem, "contact"> & {
  contact: Contact & { pipeline: (Pipeline & { stages: Stage[] }) | null; stage: Stage | null };
  messages: Message[];
  aiState: { step?: string | null; currentQuestionId?: string | null; answered?: Record<string, string>; skipped?: string[] };
};

export type Template = {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerContent: string | null;
  bodyText: string;
  variableMappings: Record<string, string>;
  footerText: string | null;
  buttonsJson: { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value?: string }[];
  metaStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  channelId: string | null;
  channel?: { id: string; name: string; phoneNumber: string } | null;
  createdAt: string;
  _count?: { campaigns: number };
};

export type AiQuestion = { id?: string; order?: number; questionText: string; requirementMode: "SE_DER" | "OBRIGATORIA"; targetField: string | null };
export type AiFaq = { id?: string; questionTitle: string; answerText: string; keywords: string[]; isEnabled: boolean };
export type AiConfig = {
  id: string;
  isActive: boolean;
  preset: string;
  focus: "VENDAS" | "LOCACAO" | "AMBOS";
  assistantName: string;
  roleTitle: string;
  tone: "INFORMAL" | "NO_MEIO" | "FORMAL";
  emojiLevel: "NENHUM" | "POUCOS" | "MUITOS";
  messageLength: "CURTAS_UMA_A_UMA" | "MEDIAS" | "LONGAS";
  regionCity: string | null;
  initialGreeting: string;
  enableAudioTranscription: boolean;
  enableImageAnalysis: boolean;
  enableCatalogSend: boolean;
  qualificationObjective: string;
  customPromptContext: string | null;
  handoffMessage: string;
  inactivityTimeoutHours: number;
  targetPipelineId: string | null;
  targetStageId: string | null;
  qualifiedStageId: string | null;
  distributionMode: "ROULETTE" | "MANAGER_MANUAL" | "FIXED_USER";
  fixedUserId: string | null;
  notifyBrokerOnWhatsApp: boolean;
  questions: AiQuestion[];
  faqs: AiFaq[];
};

export type CatalogItem = {
  id: string;
  title: string;
  code: string;
  category: string;
  price: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  areaM2: number | null;
  description: string | null;
  images: string[];
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED" | "INACTIVE";
  _count?: { interestedContacts: number };
};

export type Task = {
  id: string;
  title: string;
  type: "VISIT" | "CALL" | "FOLLOW_UP" | "DOCUMENTATION";
  dueDate: string;
  isCompleted: boolean;
  notes: string | null;
  contactId: string | null;
  assignedToId: string | null;
  contact?: { id: string; name: string | null; phone: string } | null;
  assignedTo?: UserLite | null;
};

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  inRoulette: boolean;
  rouletteWeight: number;
  lastAssignedAt: string | null;
  permissions: Record<string, boolean>;
  leadsCount: number;
  channels: { id: string; phoneNumber: string; status: string }[];
};
