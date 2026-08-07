import { describe, expect, it } from 'vitest';
import { companyResearchJsonSchema, outreachEmailJsonSchema } from '../json-schemas';
import { companyResearchSchema, outreachEmailSchema } from '../schemas';

type JsonSchemaObject = {
  type: string;
  properties: Record<string, JsonSchemaObject>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaObject;
};

/** Walks every object node so nested items are checked too. */
function eachObjectNode(node: JsonSchemaObject, visit: (node: JsonSchemaObject) => void): void {
  if (node.type === 'object') {
    visit(node);
    for (const child of Object.values(node.properties ?? {})) {
      eachObjectNode(child, visit);
    }
  }
  if (node.type === 'array' && node.items) {
    eachObjectNode(node.items, visit);
  }
}

const schemas: Array<[string, JsonSchemaObject]> = [
  ['companyResearch', companyResearchJsonSchema as unknown as JsonSchemaObject],
  ['outreachEmail', outreachEmailJsonSchema as unknown as JsonSchemaObject],
];

describe.each(schemas)('%s JSON Schema', (_name, schema) => {
  it('satisfies OpenRouter strict mode', () => {
    eachObjectNode(schema, (node) => {
      // Strict mode requires every property to be required and no extras.
      expect(node.additionalProperties).toBe(false);
      expect(new Set(node.required ?? [])).toEqual(new Set(Object.keys(node.properties)));
    });
  });
});

describe('JSON Schema / Zod parity', () => {
  it('companyResearch top-level keys match the Zod schema', () => {
    const jsonKeys = Object.keys((companyResearchJsonSchema as unknown as JsonSchemaObject).properties);
    expect(new Set(jsonKeys)).toEqual(new Set(Object.keys(companyResearchSchema.shape)));
  });

  it('outreachEmail top-level keys match the Zod schema', () => {
    const jsonKeys = Object.keys((outreachEmailJsonSchema as unknown as JsonSchemaObject).properties);
    expect(new Set(jsonKeys)).toEqual(new Set(Object.keys(outreachEmailSchema.shape)));
  });

  it('a schema-shaped object validates', () => {
    const candidate = {
      companyName: 'Acme',
      website: 'https://acme.com',
      oneLiner: 'Freight brokerage.',
      industry: 'Logistics',
      businessModel: 'Take rate',
      companySizeEstimate: '50-200 employees',
      hqLocation: 'Leeds, UK',
      whatTheyDo: ['Books freight'],
      products: [{ name: 'Portal', description: 'Shipper booking portal' }],
      targetCustomers: ['Mid-market shippers'],
      techSignals: [],
      painPoints: [
        { title: 'Manual quoting', description: 'a', evidence: 'b', severity: 'high' },
      ],
      opportunities: [{ title: 'Self-serve quotes', description: 'a', impact: 'b' }],
      aiOpportunities: [
        {
          title: 'Quote automation',
          functionArea: 'Sales',
          useCase: 'a',
          howItHelps: 'b',
          estimatedImpact: 'c',
          effort: 'medium',
        },
      ],
      outreachAngles: ['Quoting turnaround'],
      confidence: 'medium',
      assumptions: [],
    };

    expect(companyResearchSchema.safeParse(candidate).success).toBe(true);
  });
});
