import { z } from "zod";

const money = z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
  if (v === null || v === undefined || v === "") return v === "" ? null : v;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
});
const optStr = z.string().nullable().optional().transform((v) => (v === "" ? null : v));

export const contactFields = z.object({
  name: optStr,
  phone: z.string().min(8).optional(),
  email: optStr,
  personType: z.enum(["PF", "PJ"]).optional(),
  cpfCnpj: optStr,
  birthDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : v === "" ? null : v)),
  address: optStr,
  city: optStr,
  state: optStr,
  neighborhood: optStr,
  profession: optStr,
  maritalStatus: optStr,
  monthlyIncome: money,
  downPaymentAvailable: money,
  fgtsBalance: money,
  hasProperty: z.boolean().nullable().optional(),
  employmentType: z.enum(["CLT", "AUTONOMO", "EMPRESARIO", "APOSENTADO"]).nullable().optional(),
  employmentYears: optStr,
  buyingAlone: optStr,
  interest: optStr,
  dealValue: money,
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  aiQualificationEnabled: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  origin: z.enum(["SEO_ORGANICO", "GOOGLE_ADS", "FACEBOOK_ADS", "INDICACAO", "PORTAIS", "OLX", "SITE_DIRETO", "MANUAL"]).optional(),
  seoLandingPage: optStr,
  seoReferrer: optStr,
  seoKeyword: optStr,
  utmSource: optStr,
  utmMedium: optStr,
  utmCampaign: optStr,
  trackingCode: optStr,
  pipelineId: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
});

export type ContactFields = z.infer<typeof contactFields>;

export const campaignFiltersSchema = z.object({
  pipelineId: z.string().nullable().optional(),
  stageIds: z.array(z.string()).optional(),
  assignedToIds: z.array(z.string()).optional(),
  origins: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
  excludeContactIds: z.array(z.string()).optional(),
});
