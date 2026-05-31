export interface SourceMindmapGenerationPromptInput {
  sourceText: string;
  sourceMeaningfulLineCount: number;
  targetMinLineCount: number;
  targetMaxLineCount: number;
  detailLevel?: 'standard' | 'detailed';
  minimumChildrenPerBranch?: number;
  previousDslAttempt?: string;
  retryReason?: string;
  retryGuidance?: string;
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
- Rewrite raw note fragments into compact explanatory DSL lines instead of mirroring the notes verbatim.
- Do not repeat a source heading or bullet as a child line unless the term itself needs preservation.
- Prefer short phrase blocks over long sentences.
- Use symbols such as =, =>, +, -> when they shorten wording naturally.
- Never exceed 15 words on any DSL line.
- Expand the outline through additional valid child lines, not longer lines.

Minimum density rules:
- Every branch should normally contain at least {{MIN_CHILDREN_PER_BRANCH}} child lines when the source supports it.
- If a branch has no explicit sub-sub-topic, add compact explanation lines instead of leaving it empty.
- Do not stop at bare topic labels.
- If the source is a list of aspects or branches, explain what each aspect studies or why it matters.
- Prefer one more valid child line over an underdeveloped branch.
- In detailed mode, treat bare branch lists and copied headings as invalid unless they are rewritten into explanations.

Density target:
- Source meaningful non-empty line count: {{SOURCE_LINE_COUNT}}
- Target generated meaningful line count range: {{TARGET_MIN_LINE_COUNT}} to {{TARGET_MAX_LINE_COUNT}}
- Aim to stay within that range when the source supports it.
- Detail preference: {{DETAIL_PREFERENCE}}

Output rules:
- Use exactly one @root.
- If the source already has one clear umbrella topic, use it as the root.
- If the source has multiple top-level topics, invent one concise umbrella root for the whole set.
- If the source root label is generic, improve it to a clearer academic label when justified.
- Keep labels readable for mindmap nodes.
- Do not use markdown headings, code fences, or prose outside the DSL.

Validation requirements before you answer:
- The DSL must parse with one @root.
- Each generated line must stay within 15 words.
- The outline should approach the target range when the source supports it.
- Avoid outputs that are only bare branch lists.

{{RETRY_BLOCK}}

SOURCE NOTES:
{{SOURCE_TEXT}}

${sourceMindmapGenerationOutputContract}`;

export function createSourceMindmapGenerationPrompt(
  input: SourceMindmapGenerationPromptInput,
): SourceMindmapGenerationPrompt {
  const minimumChildrenPerBranch = input.minimumChildrenPerBranch
    ?? (input.detailLevel === 'detailed' ? 3 : 2);
  const detailPreference = input.detailLevel === 'detailed'
    ? 'detailed: prefer the upper half of the target range, rewrite source headings into explanations, and push branches beyond minimal coverage'
    : 'standard: meet the target range without padding';
  const retryGuidance = input.retryGuidance
    ?? [
      'Keep the same topic coverage while fixing the density problem.',
      'Add concise explanatory child lines only when the outline is too sparse.',
      'Condense overlapping points when the outline is too dense.',
      'Replace mirrored note labels with short explanatory rewrites wherever possible.',
    ].join('\n');
  const retryBlock = input.previousDslAttempt && input.retryReason
    ? `REVISION REQUIRED:
- Previous DSL attempt was too weak.
- Reason: ${input.retryReason}
- Fix the density and branch development problems.
${retryGuidance
  .split('\n')
  .map((line) => `  - ${line}`)
  .join('\n')}

PREVIOUS DSL ATTEMPT:
${input.previousDslAttempt}
`
    : '';

  return {
    system: sourceMindmapGenerationSystemPrompt,
    user: sourceMindmapGenerationUserPromptTemplate
      .replace('{{SOURCE_LINE_COUNT}}', String(input.sourceMeaningfulLineCount))
      .replace('{{TARGET_MIN_LINE_COUNT}}', String(input.targetMinLineCount))
      .replace('{{TARGET_MAX_LINE_COUNT}}', String(input.targetMaxLineCount))
      .replace('{{MIN_CHILDREN_PER_BRANCH}}', String(minimumChildrenPerBranch))
      .replace('{{DETAIL_PREFERENCE}}', detailPreference)
      .replace('{{RETRY_BLOCK}}', retryBlock)
      .replace('{{SOURCE_TEXT}}', input.sourceText),
  };
}