import { CONFIDENCE, EFFORT, SEVERITY } from './schemas';

/**
 * Hand-written JSON Schemas for OpenRouter structured outputs.
 *
 * Strict mode requires every property to be listed in `required` and
 * `additionalProperties: false` on every object, so these are written by hand
 * rather than derived from the Zod schemas (whose generated output allows
 * optionals that strict mode rejects). `src/lib/__tests__` asserts the two
 * stay in sync.
 */

type JsonSchema = Record<string, unknown>;

const str = (description: string): JsonSchema => ({ type: 'string', description });

const strArray = (description: string): JsonSchema => ({
  type: 'array',
  description,
  items: { type: 'string' },
});

const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const companyResearchJsonSchema: JsonSchema = object({
  companyName: str('Official company name.'),
  website: str('Primary website URL, or an empty string if unknown.'),
  oneLiner: str('One sentence describing the company, as a prospect would recognise it.'),
  industry: str('Primary industry or vertical.'),
  businessModel: str('How the company makes money (e.g. B2B SaaS subscription, marketplace take-rate).'),
  companySizeEstimate: str('Rough headcount band, e.g. "50-200 employees". Say "Unknown" if unclear.'),
  hqLocation: str('Headquarters city and country, or "Unknown".'),
  whatTheyDo: strArray('3-6 bullets covering what the company actually does day to day.'),
  products: {
    type: 'array',
    description: 'Named products or service lines.',
    items: object({
      name: str('Product or service name.'),
      description: str('One sentence on what it does.'),
    }),
  },
  targetCustomers: strArray('Who they sell to: segments, roles, company types.'),
  techSignals: strArray('Observable technology, tooling, hiring or stack signals. Empty array if none found.'),
  painPoints: {
    type: 'array',
    description: '3-5 operational or commercial pain points this company likely faces.',
    items: object({
      title: str('Short label for the pain point.'),
      description: str('Two sentences on the pain and why it exists for this company specifically.'),
      evidence: str('What the inference is based on. Say "Inferred from industry pattern" when there is no direct signal.'),
      severity: { type: 'string', enum: [...SEVERITY], description: 'How acute the pain likely is.' },
    }),
  },
  opportunities: {
    type: 'array',
    description: '3-5 growth or efficiency opportunities.',
    items: object({
      title: str('Short label.'),
      description: str('Two sentences describing the opportunity.'),
      impact: str('The business outcome if captured, quantified where reasonable.'),
    }),
  },
  aiOpportunities: {
    type: 'array',
    description: '3-6 concrete places AI or automation would help this specific company.',
    items: object({
      title: str('Short label for the AI/automation play.'),
      functionArea: str('Business function, e.g. Sales, Support, Ops, Finance, Marketing, Engineering.'),
      useCase: str('The concrete workflow being automated or augmented.'),
      howItHelps: str('Mechanically how it changes the workflow and what it removes.'),
      estimatedImpact: str('Expected impact, quantified where reasonable (hours saved, cost, conversion).'),
      effort: { type: 'string', enum: [...EFFORT], description: 'Implementation effort.' },
    }),
  },
  outreachAngles: strArray('3-5 specific hooks a cold email could open with, each tied to a finding above.'),
  confidence: {
    type: 'string',
    enum: [...CONFIDENCE],
    description: 'Confidence in this analysis given the evidence available.',
  },
  assumptions: strArray('Assumptions made where evidence was thin. Be honest here.'),
});

export const outreachEmailJsonSchema: JsonSchema = object({
  subject: str('The recommended subject line. Under 60 characters, lowercase-ish, no clickbait.'),
  alternateSubjects: strArray('Exactly 3 alternative subject lines.'),
  body: str('The email body as plain text with real line breaks. No subject line, no markdown, no placeholders in brackets.'),
  rationale: strArray('3-4 bullets explaining why this angle was chosen, referencing the research.'),
  followUps: {
    type: 'array',
    description: 'Follow-up emails in the sequence. Empty array if follow-ups were not requested.',
    items: object({
      waitDays: { type: 'number', description: 'Days to wait after the previous email.' },
      subject: str('Subject line; usually a reply on the same thread.'),
      body: str('Follow-up body as plain text. Shorter than the first email.'),
    }),
  },
});
