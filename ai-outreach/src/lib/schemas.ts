import { z } from 'zod';

/**
 * Shared contracts between the API routes and the UI.
 *
 * These schemas are the single source of truth: they validate inbound request
 * bodies, they are converted to JSON Schema for the model's structured output,
 * and their inferred types are what the React components consume.
 */

export const SEVERITY = ['high', 'medium', 'low'] as const;
export const EFFORT = ['low', 'medium', 'high'] as const;
export const CONFIDENCE = ['high', 'medium', 'low'] as const;

export const TONES = [
  'Direct & concise',
  'Consultative',
  'Friendly & casual',
  'Formal',
  'Bold / contrarian',
] as const;

export const LENGTHS = ['Short (60-90 words)', 'Medium (100-150 words)', 'Detailed (160-220 words)'] as const;

/* ------------------------------------------------------------------ */
/* Research                                                            */
/* ------------------------------------------------------------------ */

export const researchRequestSchema = z
  .object({
    companyName: z.string().trim().max(120).default(''),
    website: z.string().trim().max(300).default(''),
    model: z.string().trim().max(120).optional(),
  })
  .refine((value) => value.companyName.length > 0 || value.website.length > 0, {
    message: 'Provide a company name or a website.',
    path: ['companyName'],
  });

export type ResearchRequest = z.infer<typeof researchRequestSchema>;

const painPointSchema = z.object({
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  severity: z.enum(SEVERITY),
});

const opportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.string(),
});

const aiOpportunitySchema = z.object({
  title: z.string(),
  functionArea: z.string(),
  useCase: z.string(),
  howItHelps: z.string(),
  estimatedImpact: z.string(),
  effort: z.enum(EFFORT),
});

const productSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const companyResearchSchema = z.object({
  companyName: z.string(),
  website: z.string(),
  oneLiner: z.string(),
  industry: z.string(),
  businessModel: z.string(),
  companySizeEstimate: z.string(),
  hqLocation: z.string(),
  whatTheyDo: z.array(z.string()),
  products: z.array(productSchema),
  targetCustomers: z.array(z.string()),
  techSignals: z.array(z.string()),
  painPoints: z.array(painPointSchema),
  opportunities: z.array(opportunitySchema),
  aiOpportunities: z.array(aiOpportunitySchema),
  outreachAngles: z.array(z.string()),
  confidence: z.enum(CONFIDENCE),
  assumptions: z.array(z.string()),
});

export type CompanyResearch = z.infer<typeof companyResearchSchema>;
export type PainPoint = z.infer<typeof painPointSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type AiOpportunity = z.infer<typeof aiOpportunitySchema>;

export type ResearchSource = {
  kind: 'website' | 'web-search' | 'model-knowledge';
  label: string;
  detail: string;
};

export type ResearchResponse = {
  research: CompanyResearch;
  sources: ResearchSource[];
  model: string;
  elapsedMs: number;
};

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export const senderSchema = z.object({
  name: z.string().trim().max(120).default(''),
  role: z.string().trim().max(120).default(''),
  company: z.string().trim().max(120).default(''),
  offering: z.string().trim().max(600).default(''),
  proofPoint: z.string().trim().max(600).default(''),
  callToAction: z.string().trim().max(300).default(''),
  tone: z.enum(TONES).default('Direct & concise'),
  length: z.enum(LENGTHS).default('Short (60-90 words)'),
  includeFollowUps: z.boolean().default(true),
});

export type Sender = z.infer<typeof senderSchema>;

export const emailRequestSchema = z.object({
  research: companyResearchSchema,
  sender: senderSchema,
  model: z.string().trim().max(120).optional(),
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;

const followUpSchema = z.object({
  waitDays: z.number(),
  subject: z.string(),
  body: z.string(),
});

export const outreachEmailSchema = z.object({
  subject: z.string(),
  alternateSubjects: z.array(z.string()),
  body: z.string(),
  rationale: z.array(z.string()),
  followUps: z.array(followUpSchema),
});

export type OutreachEmail = z.infer<typeof outreachEmailSchema>;
export type FollowUp = z.infer<typeof followUpSchema>;

export type EmailResponse = {
  email: OutreachEmail;
  model: string;
  elapsedMs: number;
};

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type ApiError = {
  error: string;
  detail?: string;
};

/** Non-secret server configuration surfaced to the browser by `/api/config`. */
export type ClientConfig = {
  configured: boolean;
  defaultModel: string;
  models: string[];
  webSearch: boolean;
  scrapeCompanySite: boolean;
};

export const DEFAULT_SENDER: Sender = {
  name: '',
  role: '',
  company: '',
  offering: '',
  proofPoint: '',
  callToAction: '',
  tone: 'Direct & concise',
  length: 'Short (60-90 words)',
  includeFollowUps: true,
};
