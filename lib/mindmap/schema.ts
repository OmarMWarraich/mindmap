import { z } from "zod";

import {
  mindmapValidationErrorSchema,
  mindmapValidationWarningSchema,
} from "../dsl/validation.ts";
import {
  mindmapBranchColorTokens,
  mindmapTintTones,
} from "./palette.ts";

export const mindmapNodeKindSchema = z.enum(["root", "branch", "leaf"]);

export const mindmapEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

export const mindmapNodeStyleSchema = z.object({
  branchKey: z.string().min(1).optional(),
  branchIndex: z.number().int().nonnegative().optional(),
  colorToken: z.enum(mindmapBranchColorTokens).optional(),
  tintTone: z.enum(mindmapTintTones).optional(),
}).strict();

export const mindmapNodeLayoutSchema = z.object({
  minWidth: z.number().int().positive(),
  minHeight: z.number().int().positive(),
  paddingX: z.number().int().nonnegative(),
  paddingY: z.number().int().nonnegative(),
  siblingGap: z.number().int().positive(),
}).strict();

export const mindmapNodeSchema = z.object({
  id: z.string().min(1),
  kind: mindmapNodeKindSchema,
  label: z.string().trim().min(1),
  level: z.number().int().nonnegative(),
  parentId: z.string().min(1).nullable(),
  branchId: z.string().min(1),
  childIds: z.array(z.string().min(1)),
  style: mindmapNodeStyleSchema.optional(),
  layout: mindmapNodeLayoutSchema,
}).strict();

export const mindmapLayoutDefaultsSchema = z.object({
  canvasPadding: z.number().int().positive(),
  levelGap: z.number().int().positive(),
  siblingGap: z.number().int().positive(),
  branchGap: z.number().int().positive(),
  nodePaddingX: z.number().int().nonnegative(),
  nodePaddingY: z.number().int().nonnegative(),
  branchWidthHint: z.number().int().positive(),
  branchHeightHint: z.number().int().positive(),
  leafWidthHint: z.number().int().positive(),
  leafHeightHint: z.number().int().positive(),
}).strict();

export const mindmapMetadataSchema = z.object({
  title: z.string().trim().min(1),
  rootId: z.string().min(1),
  branchOrder: z.array(z.string().min(1)),
  layout: mindmapLayoutDefaultsSchema,
  generatedAt: z.string().datetime().optional(),
  source: z.object({
    format: z.literal("mindmap-dsl"),
    version: z.literal("mvp-v1"),
  }).strict(),
}).strict();

export const generatedMindmapSchema = z.object({
  version: z.literal("1.0"),
  metadata: mindmapMetadataSchema,
  nodes: z.array(mindmapNodeSchema),
  edges: z.array(mindmapEdgeSchema),
  warnings: z.array(mindmapValidationWarningSchema),
  errors: z.array(mindmapValidationErrorSchema),
}).strict().superRefine((mindmap, ctx) => {
   const nodeIds = new Set<string>();
   const duplicateNodeIds = new Set<string>();
   mindmap.nodes.forEach((node) => {
     if (nodeIds.has(node.id)) {
       duplicateNodeIds.add(node.id);
       return;
     }
     nodeIds.add(node.id);
   });
   mindmap.nodes.forEach((node, nodeIndex) => {
     if (!duplicateNodeIds.has(node.id)) {
       return;
     }
     ctx.addIssue({
       code: z.ZodIssueCode.custom,
       path: ["nodes", nodeIndex, "id"],
       message: `Duplicate node id "${node.id}"`,
     });
   });
   if (!nodeIds.has(mindmap.metadata.rootId)) {
     ctx.addIssue({
       code: z.ZodIssueCode.custom,
       path: ["metadata", "rootId"],
       message: `Root node "${mindmap.metadata.rootId}" does not exist in nodes`,
     });
   }
   mindmap.edges.forEach((edge, edgeIndex) => {
     if (!nodeIds.has(edge.from)) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["edges", edgeIndex, "from"],
         message: `Edge source "${edge.from}" does not exist in nodes`,
       });
     }
     if (!nodeIds.has(edge.to)) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["edges", edgeIndex, "to"],
         message: `Edge target "${edge.to}" does not exist in nodes`,
       });
     }
   });
   mindmap.nodes.forEach((node, nodeIndex) => {
     node.childIds.forEach((childId, childIndex) => {
       if (nodeIds.has(childId)) {
         return;
       }
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["nodes", nodeIndex, "childIds", childIndex],
         message: `Child node "${childId}" does not exist in nodes`,
       });
     });
   });
 });

export type MindmapNodeKind = z.infer<typeof mindmapNodeKindSchema>;
export type MindmapEdge = z.infer<typeof mindmapEdgeSchema>;
export type MindmapNodeStyle = z.infer<typeof mindmapNodeStyleSchema>;
export type MindmapNodeLayout = z.infer<typeof mindmapNodeLayoutSchema>;
export type MindmapNode = z.infer<typeof mindmapNodeSchema>;
export type MindmapLayoutDefaults = z.infer<typeof mindmapLayoutDefaultsSchema>;
export type MindmapMetadata = z.infer<typeof mindmapMetadataSchema>;
export type GeneratedMindmap = z.infer<typeof generatedMindmapSchema>;

export function validateGeneratedMindmap(input: unknown): GeneratedMindmap {
  return generatedMindmapSchema.parse(input);
}