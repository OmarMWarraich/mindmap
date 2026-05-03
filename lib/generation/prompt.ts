import type { GeneratedMindmap } from '../mindmap/schema.ts';

export interface MindmapGenerationPromptInput {
  astSummary: string;
  rawDsl: string;
  deterministicMindmap: GeneratedMindmap;
}

export interface MindmapGenerationPrompt {
  system: string;
  user: string;
}

export const mindmapGenerationSystemPrompt = `You are an AI study-map editor working on top of an existing deterministic mindmap.
Your job is to improve wording clarity, suggest safe sibling grouping hints, and identify missing study subtopics without breaking the deterministic structure.

You MUST return one JSON object that follows the requested schema exactly.
Do not wrap the JSON in markdown.
Do not add commentary.
Do not invent node ids.
Do not remove existing branches or nodes.
If a field has nothing useful to report, return an empty array for that field.`;

export const mindmapGenerationOutputContract = `Return a JSON object with this shape:
{
  "title": string,
  "labelRewrites": [
    {
      "nodeId": string,
      "label": string,
      "reason": string
    }
  ],
  "groupingSuggestions": [
    {
      "parentNodeId": string,
      "groupLabel": string,
      "childNodeIds": [string],
      "reason": string
    }
  ],
  "suggestedMissingSubtopics": [
    {
      "parentNodeId": string,
      "label": string,
      "reason": string
    }
  ]
}`;

export const mindmapGenerationUserPromptTemplate = `The user wrote study notes in the mindmap DSL below.
You are given:
1. the raw DSL
2. an AST summary
3. the deterministic generated mindmap JSON that the app already trusts

Your output is an enrichment overlay, not a replacement graph.

Rules:
- Keep the same topic and branch intent.
- Prefer cleaner, more study-friendly labels over longer labels.
- Only suggest grouping when multiple sibling nodes are obviously part of the same tight cluster.
- Only suggest missing subtopics that would help a student cover an obvious nearby gap.
- Never invent new ids.
- Never reference node ids that are absent from the deterministic mindmap.
- Keep labels concise, factual, and suitable for a mindmap node.
- Do not duplicate existing node labels.
- Use empty arrays when there is nothing useful to change.

AST SUMMARY:
{{AST_SUMMARY}}

RAW DSL:
{{RAW_DSL}}

DETERMINISTIC MINDMAP JSON:
{{DETERMINISTIC_MINDMAP_JSON}}

${mindmapGenerationOutputContract}`;

export function createMindmapGenerationPrompt(
  input: MindmapGenerationPromptInput,
): MindmapGenerationPrompt {
  return {
    system: mindmapGenerationSystemPrompt,
    user: mindmapGenerationUserPromptTemplate
      .replace('{{AST_SUMMARY}}', input.astSummary)
      .replace('{{RAW_DSL}}', input.rawDsl)
      .replace(
        '{{DETERMINISTIC_MINDMAP_JSON}}',
        JSON.stringify(input.deterministicMindmap, null, 2),
      ),
  };
}