import { z } from 'zod';

const requiredString = z.string().trim().min(1);

export const MODEL_PROVIDERS = ['openai', 'anthropic'] as const;
export const modelProviderSchema = z.enum(MODEL_PROVIDERS);
export type ModelProvider = z.infer<typeof modelProviderSchema>;

export const MODEL_WIRE_FORMATS = ['openai-compatible', 'anthropic-messages'] as const;
export const modelWireFormatSchema = z.enum(MODEL_WIRE_FORMATS);
export type ModelWireFormat = z.infer<typeof modelWireFormatSchema>;

export const MODEL_ROLES = ['completion', 'generation'] as const;
export const modelRoleSchema = z.enum(MODEL_ROLES);
export type ModelRole = z.infer<typeof modelRoleSchema>;

export const STRUCTURED_OUTPUT_STRATEGIES = ['response_format', 'tool', 'prompt'] as const;
export const structuredOutputStrategySchema = z.enum(STRUCTURED_OUTPUT_STRATEGIES);
export type StructuredOutputStrategy = z.infer<typeof structuredOutputStrategySchema>;

export const modelCapabilitiesSchema = z.object({
  structuredOutput: structuredOutputStrategySchema,
  contextWindow: z.number().int().positive(),
}).strict();
export type ModelCapabilities = z.infer<typeof modelCapabilitiesSchema>;

export const modelDefaultsSchema = z.object({
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
}).strict();
export type ModelDefaults = z.infer<typeof modelDefaultsSchema>;

export const modelCatalogEntrySchema = z.object({
  id: requiredString,
  provider: modelProviderSchema,
  wireFormat: modelWireFormatSchema,
  label: requiredString,
  roles: z.array(modelRoleSchema).min(1),
  capabilities: modelCapabilitiesSchema,
  defaults: modelDefaultsSchema,
}).strict();
export type ModelCatalogEntry = z.infer<typeof modelCatalogEntrySchema>;

export const modelCatalogSchema = z
  .array(modelCatalogEntrySchema)
  .min(1)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate model id: ${entry.id}`,
          path: [index, 'id'],
        });
      }
      seen.add(entry.id);
    });
  });

// Static, developer-maintained source of truth. Adding a new model is just a new
// entry here (plus its provider credential). `defaults` are model-level hints;
// role-specific call sites may override token budgets per request.
const rawModelCatalog: ModelCatalogEntry[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    wireFormat: 'openai-compatible',
    label: 'GPT-4o mini',
    roles: ['completion', 'generation'],
    capabilities: { structuredOutput: 'response_format', contextWindow: 128_000 },
    defaults: { temperature: 0.2, maxTokens: 1024 },
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    wireFormat: 'openai-compatible',
    label: 'GPT-4o',
    roles: ['completion', 'generation'],
    capabilities: { structuredOutput: 'response_format', contextWindow: 128_000 },
    defaults: { temperature: 0.2, maxTokens: 4096 },
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    wireFormat: 'anthropic-messages',
    label: 'Claude Haiku 4.5',
    roles: ['completion', 'generation'],
    capabilities: { structuredOutput: 'tool', contextWindow: 200_000 },
    defaults: { temperature: 0.2, maxTokens: 1024 },
  },
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    wireFormat: 'anthropic-messages',
    label: 'Claude Sonnet 4.5',
    roles: ['completion', 'generation'],
    capabilities: { structuredOutput: 'tool', contextWindow: 200_000 },
    defaults: { temperature: 0.2, maxTokens: 4096 },
  },
];

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = Object.freeze(
  modelCatalogSchema.parse(rawModelCatalog),
);

const modelCatalogById: ReadonlyMap<string, ModelCatalogEntry> = new Map(
  MODEL_CATALOG.map((entry) => [entry.id, entry]),
);

export function getModelById(modelId: string): ModelCatalogEntry | undefined {
  return modelCatalogById.get(modelId);
}

export function isKnownModelId(modelId: string): boolean {
  return modelCatalogById.has(modelId);
}

export function listModels(): readonly ModelCatalogEntry[] {
  return MODEL_CATALOG;
}

export function listModelsForRole(role: ModelRole): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((entry) => entry.roles.includes(role));
}

export function listModelsForProvider(provider: ModelProvider): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((entry) => entry.provider === provider);
}

export const knownModelIdSchema = z
  .string()
  .refine(isKnownModelId, { message: 'Unknown model id' });
