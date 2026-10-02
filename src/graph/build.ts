/**
 * Graph build orchestration (§19).
 *
 * Reads the repository, runs every analyzer, and produces the canonical Sei
 * Graph. The output is fully derived: nothing here is maintained by hand, and
 * building twice from unchanged source produces the same structure (§19).
 *
 * The pipeline is deliberately ordered, because later steps read what earlier
 * ones established:
 *
 *   1. parse CSS           — structure only, no graph writes
 *   2. create TS program   — one program, so symbols resolve across files
 *   3. components          — node identity + stylesheet ownership
 *   4. tokens              — declaration nodes, layers, alias edges
 *   5. usage               — token → component edges, which need step 3
 *   6. CSS variants        — merged with TS variant evidence from step 3
 *   7. composition         — needs component ids from step 3
 *   8. stories             — needs component ids and variant nodes to exist
 */

import fs from 'node:fs';
import path from 'node:path';
import { SeiGraphBuilder } from './graph';
import { analyzeTokens } from './analyzers/css/tokens';
import { analyzeUsage } from './analyzers/css/usage';
import { analyzeCssVariants } from './analyzers/css/variants';
import { parseCss, type ParsedCss } from './analyzers/css/parse';
import { analyzeComponents } from './analyzers/ts/components';
import { analyzeStories } from './analyzers/ts/stories';
import { createProgram } from './analyzers/ts/program';
import { componentId } from './ids';
import type { SeiGraph } from './types';
import type { RepoPath } from './types';

export type BuildOptions = {
  repoRoot: string;
  /** Where to search for source. Defaults to `<repoRoot>/src`. */
  sourceDir?: string;
};

export type BuildResult = {
  graph: SeiGraph;
  /** Files that were read, for the report. */
  filesRead: { css: RepoPath[]; ts: RepoPath[] };
};

/** Recursively list files under `dir` matching `predicate`, POSIX-relative. */
function listFiles(repoRoot: string, dir: string, predicate: (file: string) => boolean): RepoPath[] {
  const out: RepoPath[] = [];
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(repoRoot, full, predicate));
      continue;
    }
    if (predicate(entry.name)) {
      out.push(path.relative(repoRoot, full).split(path.sep).join('/'));
    }
  }

  return out.sort();
}

export function buildGraph(options: BuildOptions): BuildResult {
  const repoRoot = path.resolve(options.repoRoot);
  const sourceDir = options.sourceDir ?? path.join(repoRoot, 'src');

  const cssFiles = listFiles(repoRoot, sourceDir, (name) => name.endsWith('.css'));
  const componentFiles = listFiles(repoRoot, sourceDir, (name) => /\.tsx$/.test(name) && !/\.stories\.tsx$/.test(name));
  const storyFiles = listFiles(repoRoot, sourceDir, (name) => name.endsWith('.stories.tsx'));

  const builder = new SeiGraphBuilder();

  // --- 1. parse CSS ------------------------------------------------------
  const stylesheets: ParsedCss[] = cssFiles.map((file) =>
    parseCss(fs.readFileSync(path.join(repoRoot, file), 'utf8'), file),
  );

  // Rules whose declarations only apply inside an at-rule (@media, @supports,
  // ...). A token declared in one of those has a scope this analyzer does not
  // resolve, so tokens.ts reports it rather than treating it as a plain `:root`
  // definition.
  const conditionalSelectors = new Set<string>();
  for (const sheet of stylesheets) {
    for (const rule of sheet.rules) {
      if (rule.conditional) conditionalSelectors.add(`${sheet.file} ${rule.selector}`);
    }
  }

  // --- 2. TypeScript program --------------------------------------------
  const program = createProgram(repoRoot, path.join(repoRoot, 'tsconfig.json'));
  const checker = program.getTypeChecker();

  // --- 3. components + stylesheet ownership -----------------------------
  const components = analyzeComponents(builder, program, checker, repoRoot, componentFiles);

  // --- 4. tokens: declaration nodes, layers, aliases --------------------
  analyzeTokens(builder, stylesheets, conditionalSelectors);

  // --- 5. variants and states, merged across TS and CSS -----------------
  // Before usage, because a `var()` inside a modifier selector belongs to that
  // variant as well as to the component, and the variant node has to exist
  // before the usage edge can point at it.
  analyzeCssVariants(
    builder,
    stylesheets,
    components.styleSheetOwners,
    components.variantEvidence,
    components.rootClasses,
  );

  // --- 6. usage and fallback edges (needs component + variant ownership) --
  analyzeUsage(builder, stylesheets, components.styleSheetOwners);

  // --- 7. composition ---------------------------------------------------
  for (const edge of components.compositions) {
    if (!builder.hasNode(edge.fromComponentId)) continue;
    if (!builder.hasNode(edge.toComponentId)) continue;

    builder.addEdge({
      type: 'composition',
      source: edge.fromComponentId,
      target: edge.toComponentId,
      evidence: [edge.location],
      description:
        `${edge.tagName} is rendered inside this component at ` +
        `${edge.location.file}:${edge.location.line}, so this component depends on it.`,
                conditional: false,
              });
  }

  if (components.unresolvedJsx.length > 0) {
    for (const orphan of components.unresolvedJsx) {
      builder.addDiagnostic({
        level: 'info',
        code: 'dynamic-component-reference',
        message:
          `<${orphan.tagName}> at ${orphan.location.file}:${orphan.location.line} did not resolve to a ` +
          'known component declaration. No composition edge was created; if the tag is dynamic, no static ' +
          'relationship exists to record.',
        source: orphan.location,
      });
    }
  }

  // --- 8. stories --------------------------------------------------------
  const knownComponentIds = new Set(components.components.map((c) => c.id));

  analyzeStories(builder, program, checker, repoRoot, storyFiles, knownComponentIds);

  return {
    graph: builder.build(),
    filesRead: { css: cssFiles, ts: [...componentFiles, ...storyFiles] },
  };
}

export { componentId };