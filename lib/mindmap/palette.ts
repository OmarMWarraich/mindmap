export const mindmapBranchColorTokens = [
  "amber",
  "emerald",
  "sky",
  "violet",
  "rose",
  "teal",
] as const;

export type MindmapBranchColorToken =
  (typeof mindmapBranchColorTokens)[number];

export const mindmapTintTones = ["strong", "base", "soft", "subtle"] as const;

export type MindmapTintTone = (typeof mindmapTintTones)[number];

export interface MindmapTintRule {
  maxLevel: number | null;
  tone: MindmapTintTone;
}

export const mindmapTintRules: readonly MindmapTintRule[] = [
  { maxLevel: 1, tone: "strong" },
  { maxLevel: 2, tone: "base" },
  { maxLevel: 3, tone: "soft" },
  { maxLevel: null, tone: "subtle" },
];

export function getMindmapBranchColorToken(
  branchIndex: number,
): MindmapBranchColorToken {
  return mindmapBranchColorTokens[branchIndex % mindmapBranchColorTokens.length];
}

export function getMindmapTintTone(level: number): MindmapTintTone {
  for (const rule of mindmapTintRules) {
    if (rule.maxLevel === null || level <= rule.maxLevel) {
      return rule.tone;
    }
  }

  return "subtle";
}