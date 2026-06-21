import type { ModelProvider } from './catalog.ts';
import type { PublicModel } from './public-catalog.ts';

export interface ModelProviderGroup {
  provider: ModelProvider;
  label: string;
  models: PublicModel[];
}

// Display names for known providers. `satisfies` forces a label whenever a new
// provider is added to the catalog; `formatProviderLabel` still degrades
// gracefully for any unexpected value.
const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
} satisfies Record<ModelProvider, string>;

export function formatProviderLabel(provider: string): string {
  if (provider in PROVIDER_LABELS) {
    return PROVIDER_LABELS[provider as ModelProvider];
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

// Groups models by provider, preserving the order in which each provider first
// appears (and the model order within each group). Pure so the selector UI stays
// declarative and the grouping is unit-testable without a DOM.
export function groupModelsByProvider(
  models: readonly PublicModel[],
): ModelProviderGroup[] {
  const groups: ModelProviderGroup[] = [];
  const byProvider = new Map<string, ModelProviderGroup>();

  for (const model of models) {
    let group = byProvider.get(model.provider);

    if (!group) {
      group = {
        provider: model.provider,
        label: formatProviderLabel(model.provider),
        models: [],
      };
      byProvider.set(model.provider, group);
      groups.push(group);
    }

    group.models.push(model);
  }

  return groups;
}
