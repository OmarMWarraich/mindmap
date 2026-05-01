import "server-only";

import { z } from "zod";

const requiredValue = (name: string) =>
  z
    .string()
    .trim()
    .min(1, `${name} is required`)
    .refine((value) => !value.startsWith("replace-with-"), {
      message: `${name} must be set to a real value`,
    });

const modelProviderEnvSchema = z.object({
  MODEL_PROVIDER: z.enum(["openai", "azure-openai", "openrouter"]),
  MODEL_API_KEY: requiredValue("MODEL_API_KEY"),
  MODEL_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url("MODEL_BASE_URL must be a valid URL").optional(),
  ),
  MODEL_COMPLETION_MODEL: requiredValue("MODEL_COMPLETION_MODEL"),
  MODEL_GENERATION_MODEL: requiredValue("MODEL_GENERATION_MODEL"),
});

export type ModelProviderEnv = z.infer<typeof modelProviderEnvSchema>;

export type ModelProviderEnvStatus =
  | { isValid: true; env: ModelProviderEnv }
  | { isValid: false; error: string };

let cachedModelProviderEnv: ModelProviderEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "environment";
      return `- ${key}: ${issue.message}`;
    })
    .join("\n");
}

export function validateModelProviderEnv(
  env: NodeJS.ProcessEnv = process.env,
): ModelProviderEnv {
  const parsed = modelProviderEnvSchema.safeParse({
    MODEL_PROVIDER: env.MODEL_PROVIDER,
    MODEL_API_KEY: env.MODEL_API_KEY,
    MODEL_BASE_URL: env.MODEL_BASE_URL,
    MODEL_COMPLETION_MODEL: env.MODEL_COMPLETION_MODEL,
    MODEL_GENERATION_MODEL: env.MODEL_GENERATION_MODEL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid model provider environment variables:\n${formatIssues(parsed.error)}`,
    );
  }

  return parsed.data;
}

export function getModelProviderEnv(): ModelProviderEnv {
  if (cachedModelProviderEnv) {
    return cachedModelProviderEnv;
  }

  cachedModelProviderEnv = Object.freeze(validateModelProviderEnv());
  return cachedModelProviderEnv;
}

export function getModelProviderEnvStatus(
  env: NodeJS.ProcessEnv = process.env,
): ModelProviderEnvStatus {
  try {
    return {
      isValid: true,
      env: validateModelProviderEnv(env),
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown model provider configuration error",
    };
  }
}