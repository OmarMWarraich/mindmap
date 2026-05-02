export const MINDMAP_DSL_ROOT_PREFIX = "@root: ";
export const MINDMAP_DSL_BRANCH_PREFIX = "- @branch: ";
export const MINDMAP_DSL_LEAF_PREFIX = "- ";
export const MINDMAP_DSL_INDENT = "  ";

export const mindmapDslRules = {
  root: {
    description: "The first non-empty line must be the single @root declaration.",
    format: `${MINDMAP_DSL_ROOT_PREFIX}<label>`,
  },
  branch: {
    description: "Top-level branches hang directly off the root and cannot be indented.",
    format: `${MINDMAP_DSL_BRANCH_PREFIX}<label>`,
  },
  leaf: {
    description: "Leaf nodes use list syntax and can nest under branches or other leaves.",
    format: `${MINDMAP_DSL_LEAF_PREFIX}<label>`,
  },
  indentation: {
    description: "Indentation uses spaces only, with two spaces per nesting level.",
    unit: MINDMAP_DSL_INDENT,
  },
} as const;

export const mindmapDslStarterOutline = `@root: Photosynthesis
- @branch: Overview
  - Definition
  - Why it matters
- @branch: Light-dependent reactions
  - Location: thylakoid membrane
  - Inputs: light, H2O, ADP, NADP+
  - Outputs: O2, ATP, NADPH
- @branch: Calvin cycle
  - Location: stroma
  - Steps
    - Fixation
    - Reduction
    - Regeneration
`;