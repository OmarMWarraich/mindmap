import assert from 'node:assert/strict';
import { join } from "node:path";
import test from "node:test";

import {
  mindmapAstFixture,
} from "./__fixtures__/generatedMindmap.ts";
import { generateMindmapFromAst } from "./from-ast.ts";

const snapshotDirectory = join(import.meta.dirname, "__snapshots__");
type SnapshotAssert = {
  fileSnapshot(value: string, path: string): void;
};

test("generateMindmapFromAst matches the base AST snapshot", (t) => {
  const generated = generateMindmapFromAst(mindmapAstFixture);
  const snapshotAssert = t.assert as typeof t.assert & SnapshotAssert;

  snapshotAssert.fileSnapshot(
    JSON.stringify(generated, null, 2),
    join(snapshotDirectory, "from-ast.base.snapshot.json"),
  );
});

test("generateMindmapFromAst matches the grouped-branch snapshot", (t) => {
  const generated = generateMindmapFromAst({
    root: {
      id: "root-messy",
      kind: "root",
      label: "  Cellular   respiration  ",
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: "@root: Cellular respiration",
      },
      branches: [
        {
          id: "branch-messy",
          kind: "branch",
          label: "  Electron   transport   chain  ",
          source: {
            line: 2,
            column: 1,
            indentLevel: 0,
            raw: "- @branch: Electron transport chain",
          },
          children: [
            "  NADH   oxidation  ",
            " Proton   pumping across inner membrane ",
            " ATP synthase rotor coupling ",
            " Chemiosmosis link to ATP output ",
            " Oxygen as terminal electron acceptor ",
            " Reactive oxygen species control ",
            " Extremely verbose label describing regulation of mitochondrial electron transport efficiency under stress conditions ",
          ].map((label, index) => ({
            id: `leaf-${index + 1}`,
            kind: "leaf" as const,
            label,
            source: {
              line: index + 3,
              column: 3,
              indentLevel: 1,
              raw: `  - ${label.trim()}`,
            },
            children: [],
          })),
        },
      ],
    },
  });
  const snapshotAssert = t.assert as typeof t.assert & SnapshotAssert;

  snapshotAssert.fileSnapshot(
    JSON.stringify(generated, null, 2),
    join(snapshotDirectory, "from-ast.grouped.snapshot.json"),
  );
});

test('generateMindmapFromAst preserves long leaf labels', () => {
  const generated = generateMindmapFromAst({
    root: {
      id: 'root-law',
      kind: 'root',
      label: 'Intro',
      source: {
        line: 1,
        column: 1,
        indentLevel: 0,
        raw: '@root: Intro',
      },
      branches: [
        {
          id: 'branch-definition',
          kind: 'branch',
          label: 'Definition',
          source: {
            line: 2,
            column: 1,
            indentLevel: 0,
            raw: '- @branch: Definition',
          },
          children: [
            {
              id: 'leaf-1',
              kind: 'leaf',
              label: 'Sir John William Salmond - legal scholar judge public servant - Law is the body of principles recognized and applied by the state in the administration of justice',
              source: {
                line: 3,
                column: 3,
                indentLevel: 1,
                raw: '  - Sir John William Salmond ...',
              },
              children: [],
            },
          ],
        },
      ],
    },
  });

  assert.equal(
    generated.nodes.find((node) => node.kind === 'leaf')?.label,
    'Sir John William Salmond - legal scholar judge public servant - Law is the body of principles recognized and applied by the state in the administration of justice',
  );
});