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