import { z } from "zod";

import type {
  MindmapAstNode,
  MindmapAstNodeKind,
  MindmapAstSource,
} from "./ast.ts";

export type MindmapValidationSeverity = "warning" | "error";

export type MindmapValidationCode =
  | "missing-root"
  | "duplicate-root"
  | "branch-before-root"
  | "leaf-before-branch"
  | "invalid-branch-indentation"
  | "invalid-indentation"
  | "invalid-marker"
  | "missing-label"
  | "empty-line-skipped"
  | "recovered-structure";

export const mindmapValidationSeveritySchema = z.enum(["warning", "error"]);

export const mindmapValidationCodeSchema = z.enum([
  "missing-root",
  "duplicate-root",
  "branch-before-root",
  "leaf-before-branch",
  "invalid-branch-indentation",
  "invalid-indentation",
  "invalid-marker",
  "missing-label",
  "empty-line-skipped",
  "recovered-structure",
]);

export const mindmapAstSourceSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  indentLevel: z.number().int().nonnegative(),
  raw: z.string(),
}).strict();

export const mindmapValidationTargetSchema = z.object({
  nodeId: z.string().min(1).optional(),
  nodeKind: z.enum(["root", "branch", "leaf"]).optional(),
  source: mindmapAstSourceSchema.optional(),
}).strict();

export const mindmapValidationIssueSchema = z.object({
  severity: mindmapValidationSeveritySchema,
  code: mindmapValidationCodeSchema,
  message: z.string().min(1),
  target: mindmapValidationTargetSchema,
}).strict();

export const mindmapValidationWarningSchema = mindmapValidationIssueSchema.extend({
  severity: z.literal("warning"),
});

export const mindmapValidationErrorSchema = mindmapValidationIssueSchema.extend({
  severity: z.literal("error"),
});

export interface MindmapValidationTarget {
  nodeId?: string;
  nodeKind?: MindmapAstNodeKind;
  source?: MindmapAstSource;
}

export interface MindmapValidationIssue {
  severity: MindmapValidationSeverity;
  code: MindmapValidationCode;
  message: string;
  target: MindmapValidationTarget;
}

export interface MindmapValidationWarning extends MindmapValidationIssue {
  severity: "warning";
}

export interface MindmapValidationError extends MindmapValidationIssue {
  severity: "error";
}

export interface MindmapValidationResult {
  ast: MindmapAstNode | null;
  warnings: MindmapValidationWarning[];
  errors: MindmapValidationError[];
}

export function createValidationTarget(
  node?: MindmapAstNode,
  source?: MindmapAstSource,
): MindmapValidationTarget {
  if (!node && !source) {
    return {};
  }

  return {
    nodeId: node?.id,
    nodeKind: node?.kind,
    source: source ?? node?.source,
  };
}