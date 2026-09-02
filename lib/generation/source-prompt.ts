export type SourceMindmapReadabilityMode = 'compact' | 'plain' | 'detailed';

export interface SourceMindmapGenerationPromptInput {
  sourceText: string;
  sourceMeaningfulLineCount: number;
  targetMinLineCount: number;
  targetMaxLineCount: number;
  detailLevel?: 'standard' | 'detailed' | 'compact' | 'plain';
  readabilityMode?: SourceMindmapReadabilityMode;
  minimumChildrenPerBranch?: number;
  // 'expand' (default): enrich smaller sources toward a density target.
  // 'distill': condense a large source into a bounded, structured outline.
  mode?: 'expand' | 'distill';
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
Keep every generated DSL content line at 45 words or fewer.`;

export const sourceMindmapGenerationOutputContract = `Return a JSON object with this shape:
{
  "dsl": string
}`;

// Detection-first preamble shared by both modes: organize before writing DSL, and
// infer the hierarchy from meaning even when the source has no explicit structure.
export const sourceMindmapHierarchyDetectionGuidance = `First, detect the topic hierarchy in the source before writing any DSL:
- Identify the single overarching umbrella topic — it becomes the @root (main topic).
- Identify the major sub-topics — they become "- @branch:" lines.
- Identify deeper sub-topics and supporting points — they become nested leaf lines (two spaces per level).
- The source may be flat or unstructured (a wall of text, raw subtitles, or a plain bullet dump) with no headings; infer the hierarchy from meaning, not from any existing indentation.
- Group related points under the sub-topic they belong to.
Only once the hierarchy is clear, produce the DSL.`;

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
{{READABILITY_GUIDANCE}}
- Never exceed 45 words on any DSL line.
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
- Each generated line must stay within 45 words.
- The outline should approach the target range when the source supports it.
- Avoid outputs that are only bare branch lists.

{{RETRY_BLOCK}}

SOURCE NOTES:
{{SOURCE_TEXT}}

${sourceMindmapGenerationOutputContract}`;

// Distillation variant: used when the source is large. The goal is to condense
// and organize, not to expand — so the density rules invert and there is no
// per-branch minimum to pad toward.
export const sourceMindmapDistillationUserPromptTemplate = `Condense the long source below into a compact, well-structured mindmap DSL for this app.

App constraints:
- The parser accepts exactly one @root block.
- Branch lines must use: - @branch: label
- Child lines must use standard nested leaf bullets.
- Output only valid DSL inside the JSON field.

Condensation goals:
- This source is large: summarize and organize it. Do NOT expand it or add new facts.
- Select the most important topics and points; drop repetition, filler, and asides.
- Group related points under the sub-topic they belong to; keep the hierarchy clean.
- Rewrite long passages into short phrase-style labels.
- Prefer fewer, stronger lines over many weak ones.
- Never exceed 45 words on any DSL line.

Size target (condensation, not expansion):
- Source meaningful non-empty line count: {{SOURCE_LINE_COUNT}}
- Target generated meaningful line count range: {{TARGET_MIN_LINE_COUNT}} to {{TARGET_MAX_LINE_COUNT}}
- Stay at or below the upper bound; condense further if the outline runs over.
- Detail preference: {{DETAIL_PREFERENCE}}

Output rules:
- Use exactly one @root as the umbrella topic; invent a concise one if the source has several themes.
- Improve a generic root label to a clearer academic label when justified.
- Keep labels readable for mindmap nodes.
- Do not use markdown headings, code fences, or prose outside the DSL.

Validation requirements before you answer:
- The DSL must parse with one @root.
- Each generated line must stay within 45 words.
- The outline must stay within the target range; condense further if it is over.

{{RETRY_BLOCK}}

SOURCE NOTES:
{{SOURCE_TEXT}}

${sourceMindmapGenerationOutputContract}`;

function resolveDetailPreference(
  mode: 'expand' | 'distill',
  detailLevel: SourceMindmapGenerationPromptInput['detailLevel'],
): string {
  if (mode === 'distill') {
    return detailLevel === 'detailed'
      ? 'detailed: keep more supporting sub-points while still condensing'
      : 'standard: keep only the essential structure and key points';
  }

  return detailLevel === 'detailed'
    ? 'detailed: prefer the upper half of the target range, rewrite source headings into explanations, and push branches beyond minimal coverage'
    : 'standard: meet the target range without padding';
}

function resolveReadabilityGuidance(readabilityMode: SourceMindmapReadabilityMode): string {
  switch (readabilityMode) {
    case 'plain':
      return 'Prefer plain-language labels and explanatory phrasing. Avoid symbols such as =, +, =>, and -> unless a shorthand is essential. Add rich explanatory child lines and make branch labels easy to read in plain English.';
    case 'detailed':
      return 'Prefer plain-language labels and rich explanatory child lines. Keep labels readable, avoid compressed symbols, and give each branch enough detail to explain the concept clearly.';
    case 'compact':
    default:
      return 'Use symbols such as =, =>, +, -> when they shorten wording naturally.';
  }
}

export function createSourceMindmapGenerationPrompt(
  input: SourceMindmapGenerationPromptInput,
): SourceMindmapGenerationPrompt {
  const mode = input.mode ?? 'expand';
  const readabilityMode = input.readabilityMode ?? 'compact';
  const minimumChildrenPerBranch = input.minimumChildrenPerBranch
    ?? (input.detailLevel === 'detailed' ? 3 : 2);
  const detailPreference = resolveDetailPreference(mode, input.detailLevel);
  const readabilityGuidance = resolveReadabilityGuidance(readabilityMode);
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

  const template = mode === 'distill'
    ? sourceMindmapDistillationUserPromptTemplate
    : sourceMindmapGenerationUserPromptTemplate;
  // Use function replacers (not string replacements) for values that may contain
  // arbitrary user or model content: a literal "$&", "$$", etc. in source text or
  // a previous DSL attempt would otherwise be misinterpreted as a replacement
  // pattern by String.prototype.replace and corrupt the prompt.
  const body = template
    .replace('{{SOURCE_LINE_COUNT}}', String(input.sourceMeaningfulLineCount))
    .replace('{{TARGET_MIN_LINE_COUNT}}', String(input.targetMinLineCount))
    .replace('{{TARGET_MAX_LINE_COUNT}}', String(input.targetMaxLineCount))
    .replace('{{MIN_CHILDREN_PER_BRANCH}}', String(minimumChildrenPerBranch))
    .replace('{{DETAIL_PREFERENCE}}', detailPreference)
    .replace('{{READABILITY_GUIDANCE}}', readabilityGuidance)
    .replace('{{RETRY_BLOCK}}', () => retryBlock)
    .replace('{{SOURCE_TEXT}}', () => input.sourceText);

  return {
    system: sourceMindmapGenerationSystemPrompt,
    user: `${sourceMindmapHierarchyDetectionGuidance}\n\n${body}`,
  };
}