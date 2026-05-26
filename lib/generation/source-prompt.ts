export interface SourceMindmapGenerationPromptInput {
  sourceText: string;
  sourceMeaningfulLineCount: number;
  targetMinLineCount: number;
  targetMaxLineCount: number;
}

export interface SourceMindmapGenerationPrompt {
  system: string;
  user: string;
}

export const sourceMindmapGenerationSystemPrompt = `You convert raw study notes into the app's single-root mindmap DSL.

Return one JSON object that matches the requested schema exactly.
Do not wrap the JSON in markdown.
Do not add commentary.
The DSL inside the JSON must use exactly one @root line.
If the source contains several top-level themes, synthesize one concise umbrella root and turn those themes into branches.
Use only spaces for indentation, never tabs.
Keep every generated DSL content line at 15 words or fewer.`;

export const sourceMindmapGenerationOutputContract = `Return a JSON object with this shape:
{
  "dsl": string
}`;

export const sourceMindmapGenerationUserPromptTemplate = `Convert the source notes below into compact mindmap DSL for this app.

App constraints:
- The parser accepts exactly one @root block.
- Branch lines must use: - @branch: label
- Child lines must use standard nested leaf bullets.
- Output only valid DSL inside the JSON field.

Content goals:
- Preserve the source meaning and hierarchy as faithfully as possible.
- Detect main topics, sub-topics, and deeper sub-topics from the notes.
- Add concise explanations and examples where they improve clarity.
- Prefer short phrase blocks over long sentences.
- Use symbols such as =, =>, +, -> when they shorten wording naturally.
- Never exceed 15 words on any DSL line.
- Expand the outline through additional valid child lines, not longer lines.

Density target:
- Source meaningful non-empty line count: {{SOURCE_LINE_COUNT}}
- Target generated meaningful line count range: {{TARGET_MIN_LINE_COUNT}} to {{TARGET_MAX_LINE_COUNT}}
- Aim to stay within that range when the source supports it.

Output rules:
- Use exactly one @root.
- If the source already has one clear umbrella topic, use it as the root.
- If the source has multiple top-level topics, invent one concise umbrella root for the whole set.
- Keep labels readable for mindmap nodes.
- Do not use markdown headings, code fences, or prose outside the DSL.

SOURCE NOTES:
{{SOURCE_TEXT}}

${sourceMindmapGenerationOutputContract}`;

export function createSourceMindmapGenerationPrompt(
  input: SourceMindmapGenerationPromptInput,
): SourceMindmapGenerationPrompt {
  return {
    system: sourceMindmapGenerationSystemPrompt,
    user: sourceMindmapGenerationUserPromptTemplate
      .replace('{{SOURCE_LINE_COUNT}}', String(input.sourceMeaningfulLineCount))
      .replace('{{TARGET_MIN_LINE_COUNT}}', String(input.targetMinLineCount))
      .replace('{{TARGET_MAX_LINE_COUNT}}', String(input.targetMaxLineCount))
      .replace('{{SOURCE_TEXT}}', input.sourceText),
  };
}