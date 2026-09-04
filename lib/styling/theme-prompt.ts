export interface MindmapThemePromptInput {
  stylePrompt: string;
  mindmapTitle?: string;
  branchLabels?: string[];
  previousAttempt?: string;
  previousAttemptIssues?: string;
}

export interface MindmapThemePrompt {
  system: string;
  user: string;
}

export const mindmapThemeGenerationSystemPrompt = `You design visual themes for a mindmap study app.

Return one JSON object that matches the requested theme schema exactly.
Do not wrap the JSON in markdown.
Do not add commentary.
Pick harmonious, readable colors: node text must stay legible on node fills, and node fills must contrast with the background.
Never use background kind "image" — you cannot produce image data. Use "solid", "gradient", or "grid" only.
All colors must be CSS hex values like #0f172a.`;

export const mindmapThemeOutputContract = `Return a JSON object with this exact shape (no extra keys):
{
  "version": 1,
  "name": string (short display name for the theme),
  "background": { "kind": "grid" }
    | { "kind": "solid", "color": string }
    | { "kind": "gradient", "from": string, "to": string, "angle": number 0-360 },
  "typography": {
    "fontFamily": string (CSS font-family stack),
    "rootFontScale": number 0.5-3,
    "nodeFontScale": number 0.5-3
  },
  "node": {
    "fillOpacity": number 0-1,
    "cornerRadiusScale": number 0.2-3,
    "strokeWidthScale": number 0.2-3,
    "frostOpacity": number 0-1 (white backing behind nodes; use >0.6 on dark or busy backgrounds),
    "root"?: { "fill"?: string, "stroke"?: string, "text"?: string, "accent"?: string },
    "branch"?: { "fill"?: string, "stroke"?: string, "text"?: string, "accent"?: string },
    "leaf"?: { "fill"?: string, "stroke"?: string, "text"?: string, "accent"?: string }
  },
  "edge": {
    "strokeWidthScale": number 0.2-3,
    "opacity": number 0-1,
    "colorMode": "branch" | "mono",
    "monoColor"?: string (required when colorMode is "mono")
  }
}
Omit "root"/"branch"/"leaf" overrides to keep the app's per-branch color palette; set them only when the style demands fixed colors.`;

export function createMindmapThemePrompt(input: MindmapThemePromptInput): MindmapThemePrompt {
  const contextLines: string[] = [];

  if (input.mindmapTitle) {
    contextLines.push(`MINDMAP TITLE: ${input.mindmapTitle}`);
  }

  if (input.branchLabels && input.branchLabels.length > 0) {
    contextLines.push(`MAIN BRANCHES: ${input.branchLabels.join(' | ')}`);
  }

  const retryLines = input.previousAttempt
    ? [
        'Your previous response was rejected. Fix these problems and return corrected JSON:',
        input.previousAttemptIssues ?? 'The JSON did not match the schema.',
        'PREVIOUS RESPONSE:',
        input.previousAttempt,
        '',
      ]
    : [];

  const user = [
    ...retryLines,
    'Design a mindmap theme for this style request:',
    `STYLE REQUEST: ${input.stylePrompt}`,
    ...(contextLines.length > 0 ? ['', ...contextLines] : []),
    '',
    mindmapThemeOutputContract,
  ].join('\n');

  return {
    system: mindmapThemeGenerationSystemPrompt,
    user,
  };
}
