/**
 * `npm run sei:graph` — generates `.sei/graph.json` (§19).
 *
 * The graph is derived output. This script reads the repository and writes the
 * file; it never edits the graph, and it carries no state between runs.
 *
 * Run: node scripts/sei-graph.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../src/graph/build.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, '.sei');
const outputPath = path.join(outputDir, 'graph.json');

const { graph, filesRead } = buildGraph({ repoRoot });

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

const nodes = Object.values(graph.nodes);
const edges = Object.values(graph.edges);

const countBy = (items: { type: string }[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

const tokenNodes = nodes.filter((n) => n.type === 'token');
const layers = tokenNodes.reduce<Record<string, number>>((acc, node) => {
  const layer = node.type === 'token' ? node.layer : 'unknown';
  acc[layer] = (acc[layer] ?? 0) + 1;
  return acc;
}, {});

const warnings = graph.diagnostics.filter((d) => d.level === 'warning');
const infos = graph.diagnostics.filter((d) => d.level === 'info');

console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
console.log(
  `  read     ${filesRead.css.length} css, ${filesRead.ts.length} ts/tsx`,
);
console.log(`  nodes    ${nodes.length}  ${JSON.stringify(countBy(nodes))}`);
console.log(`  edges    ${edges.length}  ${JSON.stringify(countBy(edges))}`);
console.log(
  `  tokens   ${tokenNodes.length}  ${JSON.stringify(layers)}  ` +
    `(${tokenNodes.filter((t) => t.type === 'token' && t.origin === 'undeclared').length} referenced but undeclared)`,
);
console.log(`  diagnostics  ${warnings.length} warning, ${infos.length} info`);

for (const diagnostic of graph.diagnostics) {
  const mark = diagnostic.level === 'warning' ? 'warn' : 'info';
  const where = diagnostic.source
    ? ` ${diagnostic.source.file}${diagnostic.source.line ? `:${diagnostic.source.line}` : ''}`
    : '';
  console.log(`    [${mark}] ${diagnostic.code}${where}`);
}