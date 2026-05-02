import { mindmapDslStarterOutline } from "../mvp.ts";

export const validMindmapDslFixture = mindmapDslStarterOutline;

export const malformedMindmapDslFixture = `- @branch: Overview
@root: Photosynthesis
Not a valid marker
- @branch:
- @branch: Valid branch
  - Valid leaf
       - Too deep too fast
`;

export const malformedMarkerMindmapDslFixture = `- @root: Photosynthesis
@branch: Overview
@root Photosynthesis
- @branch Overview
`;

export const invalidIndentationMindmapDslFixture = `@root: Biology
- @branch: Cells
  - Organelles
      - Mitochondria
 - Misaligned spacing
  - Recovery sibling
`;

export const invalidHierarchyMindmapDslFixture = `@root: Chemistry
- @branch: Matter
  - States
    - Solid
      - Crystal lattice
    - Liquid
      - Flow
        - Viscosity
    - Gas
        - No exact parent level
`;