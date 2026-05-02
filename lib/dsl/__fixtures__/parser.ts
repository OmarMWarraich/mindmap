import { mindmapDslStarterOutline } from "../mvp.ts";

export const validMindmapDslFixture = mindmapDslStarterOutline;

export interface ParserFixture {
  name: string;
  outline: string;
}

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

export const validMindmapDslFixtures: ParserFixture[] = [
  {
    name: "starter outline",
    outline: validMindmapDslFixture,
  },
  {
    name: "blank lines between sections",
    outline: `@root: Ecosystems

- @branch: Components
  - Biotic
  - Abiotic

- @branch: Energy flow
  - Producers
  - Consumers
`,
  },
  {
    name: "deep leaf nesting",
    outline: `@root: Algebra
- @branch: Equations
  - Solving steps
    - Isolate variable
      - Inverse operations
        - Preserve equality
`,
  },
];

export const malformedMindmapDslFixtures: ParserFixture[] = [
  {
    name: "mixed malformed structure",
    outline: malformedMindmapDslFixture,
  },
  {
    name: "malformed markers",
    outline: malformedMarkerMindmapDslFixture,
  },
  {
    name: "missing root declaration",
    outline: `- @branch: Overview
  - Definition
`,
  },
  {
    name: "duplicate root declaration",
    outline: `@root: Physics
- @branch: Motion
  - Speed
@root: Replacement
`,
  },
  {
    name: "empty branch and leaf labels",
    outline: `@root: Biology
- @branch:
- @branch: Cells
  -
`,
  },
];

export const edgeCaseMindmapDslFixtures: ParserFixture[] = [
  {
    name: "invalid indentation width",
    outline: invalidIndentationMindmapDslFixture,
  },
  {
    name: "invalid hierarchy parent resolution",
    outline: invalidHierarchyMindmapDslFixture,
  },
  {
    name: "tabs are rejected",
    outline: "@root: Geography\n- @branch: Maps\n\t- Latitude\n",
  },
  {
    name: "content before first branch",
    outline: `@root: History
- Prelude
- @branch: Ancient era
  - Mesopotamia
`,
  },
  {
    name: "blank document",
    outline: `

`,
  },
];