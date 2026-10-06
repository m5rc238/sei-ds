/**
 * Story analysis (§17).
 *
 * Story identity is `story:<repo-relative-file>#<export-name>` — derived from
 * source only. Storybook's own id (`components-button--primary`) is captured as
 * metadata and is never used to build an id or to infer a relationship: two
 * files could legitimately produce the same Storybook id, and a rename would
 * change it.
 *
 * Component mapping follows the specified priority, stopping at the first
 * success:
 *   1. explicit CSF component metadata — `meta.component`
 *   2. direct static component reference
 *   3. statically analyzable JSX usage in a render function
 *
 * Story→variant mapping is best effort from static args only. The rule applied
 * below is deliberately narrow: an arg connects to a variant only when the arg's
 * property name is the same prop the variant's own evidence names as its driver.
 * That is what makes `args: { variant: 'secondary' }` connect while
 * `args: { disabled: true }` does not — the latter would require asserting that
 * a React prop causes a CSS pseudo-class, which is platform knowledge rather
 * than repository evidence (§3.1, §31).
 */

import path from 'node:path';
import ts from 'typescript';
import { componentId, storyId, toRepoPath, variantNodeId } from '../../ids.ts';
import type { SeiGraphBuilder } from '../../graph.ts';
import type { RepoPath, SourceLocation } from '../../types.ts';
import { isIntrinsicTag, positionOf, propertyName, tagNameOf } from './program.ts';

/** Storybook's id derivation, metadata only (§17). */
function deriveStorybookId(title: string | undefined, exportName: string): string | undefined {
  if (!title) return undefined;
  const slug = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  return `${slug(title)}--${slug(exportName)}`;
}

type StoryExport = {
  exportName: string;
  location: SourceLocation;
  /** Static args declared on the story, or undefined when it declares none. */
  args?: Record<string, { value: string | boolean; location: SourceLocation }>;
};

type StoryMeta = {
  title?: string;
  titleLocation?: SourceLocation;
  componentLocal?: string;
  componentLocation?: SourceLocation;
  metaArgs?: Record<string, { value: string | boolean; location: SourceLocation }>;
  stories: StoryExport[];
};

export type StoryAnalysis = {
  /** Canonical story id -> resolved component id, for the panel (§24). */
  componentByStory: Map<string, string>;
  /** Canonical story id -> Storybook id, for navigation (§24). */
  storybookIdByStory: Map<string, string>;
  /** Stories whose component could not be resolved. */
  unmapped: Array<{ storyId: string; location: SourceLocation; reason: string }>;
};

export function analyzeStories(
  builder: SeiGraphBuilder,
  program: ts.Program,
  checker: ts.TypeChecker,
  repoRoot: string,
  storyFiles: RepoPath[],
  knownComponentIds: Set<string>,
): StoryAnalysis {
  const analysis: StoryAnalysis = {
    componentByStory: new Map(),
    storybookIdByStory: new Map(),
    unmapped: [],
  };

  for (const file of storyFiles) {
    const sourceFile = program.getSourceFile(path.join(repoRoot, file));
    if (!sourceFile) continue;

    const meta = readStoryMeta(sourceFile, repoRoot);
    const bindings = resolveLocalComponents(sourceFile, checker, repoRoot);

    // Priority 1: explicit CSF component metadata.
    let mappedComponentId: string | undefined;
    let basis: string | undefined;

    if (meta.componentLocal) {
      const resolved = bindings.get(meta.componentLocal);
      if (resolved && knownComponentIds.has(resolved)) {
        mappedComponentId = resolved;
        basis = `CSF meta.component = ${meta.componentLocal}`;
      } else if (resolved) {
        builder.addDiagnostic({
          level: 'warning',
          code: 'story-component-not-in-graph',
          message:
            `Story file ${file} declares meta.component = ${meta.componentLocal}, which resolves to ` +
            `${resolved ?? 'nothing'}. That id is not a component node in the graph, so no story→component ` +
            'mapping was created.',
          source: meta.componentLocation ?? meta.titleLocation,
        });
      } else {
        builder.addDiagnostic({
          level: 'warning',
          code: 'story-component-unresolved',
          message:
            `meta.component = ${meta.componentLocal} in ${file} could not be resolved to a component ` +
            'declaration. No story→component mapping was created.',
          source: meta.componentLocation ?? meta.titleLocation,
        });
      }
    }

    // Priorities 2 and 3: static JSX of a known component.
    if (!mappedComponentId) {
      const jsxUsages = collectJsxComponents(sourceFile, bindings, knownComponentIds);
      if (jsxUsages.length > 0) {
        // More than one component is a genuine ambiguity: the story renders
        // several, and picking the first would be a guess.
        if (jsxUsages.length === 1) {
          mappedComponentId = jsxUsages[0]!.id;
          basis = 'static JSX usage in the story';
        } else {
          builder.addDiagnostic({
            level: 'info',
            code: 'story-component-ambiguous',
            message:
              `${file} renders ${jsxUsages.length} known components ` +
              `(${jsxUsages.map((u) => u.name).join(', ')}) and declares no meta.component. ` +
              'No single component can be named, so no story→component mapping was created.',
            source: meta.titleLocation,
          });
        }
      }
    }

    for (const story of meta.stories) {
      const id = storyId(file, story.exportName);
      const storybookId = deriveStorybookId(meta.title, story.exportName);

      builder.addNode({
        id,
        type: 'story',
        name: story.exportName,
        exportName: story.exportName,
        file,
        title: meta.title,
        storybookId,
        evidence: [story.location],
      });

      if (storybookId) analysis.storybookIdByStory.set(id, storybookId);

      if (mappedComponentId) {
        analysis.componentByStory.set(id, mappedComponentId);
        builder.addEdge({
          type: 'story',
          source: mappedComponentId,
          target: id,
          evidence: [story.location, meta.componentLocation ?? meta.titleLocation].filter(
            (l): l is SourceLocation => Boolean(l),
          ),
          description:
            `Story "${story.exportName}" in ${meta.title ?? file} documents this component ` +
            `(resolved by ${basis}).`,
          conditional: false,
        });
      } else {
        analysis.unmapped.push({
          storyId: id,
          location: story.location,
          reason: meta.componentLocal
            ? `meta.component = ${meta.componentLocal} did not resolve`
            : 'no meta.component and no unambiguous static JSX usage',
        });
        builder.addDiagnostic({
          level: 'info',
          code: 'story-unmapped',
          message:
            `Story "${story.exportName}" (${file}) could not be mapped to a component: ` +
            `${meta.componentLocal ? `meta.component = ${meta.componentLocal} did not resolve` : 'no meta.component and no unambiguous static JSX usage'}. ` +
            'The story node exists; its component relationship does not.',
          source: story.location,
        });
      }

      // Story → variant, from static args only.
      connectStoryArgs(builder, id, story, mappedComponentId);
    }
  }

  return analysis;
}

/**
 * Connect a story's static args to variants.
 *
 * Two conditions must both hold, which is what keeps this honest:
 *   1. the arg's property is the same prop a variant's evidence names as driver
 *   2. the variant node already exists from component or CSS evidence
 *
 * A boolean arg is never connected. `--button--disabled` needs a prop→pseudo-class
 * claim that the repository does not make.
 */
function connectStoryArgs(
  builder: SeiGraphBuilder,
  canonicalStoryId: string,
  story: StoryExport,
  componentIdForStory: string | undefined,
): void {
  if (!componentIdForStory || !story.args) return;

  for (const [propName, arg] of Object.entries(story.args)) {
    if (typeof arg.value !== 'string') continue;

    const variantId = variantNodeId(componentIdForStory, 'variant', arg.value);
    const node = builder.getNodeSafe(variantId);
    if (!node || node.type !== 'variant') continue;

    // Condition 1: the prop must actually drive this variant.
    if (node.drivenByProp !== propName) continue;

    builder.addEdge({
      type: 'variant',
      source: variantId,
      target: canonicalStoryId,
      evidence: [arg.location],
      description:
        `Story "${story.exportName}" sets ${propName}="${arg.value}" statically, exercising this variant.`
    ,
        conditional: false
      });
  }
}

/* -------------------------------------------------------------------------- */
/* Reading CSF                                                                 */
/* -------------------------------------------------------------------------- */

function readStoryMeta(sourceFile: ts.SourceFile, repoRoot: string): StoryMeta {
  // `export default meta` names an *identifier*, not an object literal: the real
  // CSF shape in this repository is
  //   const meta = {...} satisfies Meta<typeof Button>;
  //   export default meta;
  // Reading the export assignment's expression directly finds no object literal
  // and silently loses the title, the component and every arg. The identifier is
  // therefore resolved back to its variable declaration.
  const metaObject = resolveDefaultMetaObject(sourceFile);

  const titleAssignment = metaObject ? findAssignment(metaObject, 'title') : undefined;
  const componentAssignment = metaObject ? findAssignment(metaObject, 'component') : undefined;
  const metaArgsAssignment = metaObject ? findAssignment(metaObject, 'args') : undefined;

  const metaArgs =
    metaArgsAssignment && ts.isObjectLiteralExpression(metaArgsAssignment.initializer)
      ? readStaticArgs(metaArgsAssignment.initializer, sourceFile, repoRoot)
      : undefined;

  const stories: StoryExport[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    if (!modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;

      const argsAssignment = findAssignment(declaration.initializer, 'args');

      stories.push({
        exportName: declaration.name.text,
        location: positionOf(sourceFile, declaration, repoRoot),
        // Inherited meta args are part of the story's effective args, and they
        // are static, so `Primary: Story = {}` is still mappable.
        args:
          argsAssignment && ts.isObjectLiteralExpression(argsAssignment.initializer)
            ? readStaticArgs(argsAssignment.initializer, sourceFile, repoRoot)
            : metaArgs,
      });
    }
  }

  return {
    title: titleAssignment && ts.isStringLiteral(titleAssignment.initializer)
      ? titleAssignment.initializer.text
      : undefined,
    titleLocation: metaObject ? positionOf(sourceFile, metaObject, repoRoot) : undefined,
    componentLocal:
      componentAssignment && ts.isIdentifier(componentAssignment.initializer)
        ? componentAssignment.initializer.text
        : undefined,
    componentLocation: componentAssignment
      ? positionOf(sourceFile, componentAssignment, repoRoot)
      : undefined,
    metaArgs,
    stories,
  };
}

/**
 * Find the CSF meta object literal.
 *
 * Handles both `export default { ... }` and the far more common
 * `export default meta` where `meta` is a variable. For the identifier form the
 * declaration is followed, and `satisfies` is unwrapped: `const meta = {...}
 * satisfies Meta<T>` has the object literal on the left of the satisfies
 * expression, not as the initializer.
 */
function resolveDefaultMetaObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals === true) continue;

    let expression: ts.Expression = statement.expression;

    if (ts.isIdentifier(expression)) {
      const name = expression.text;
      for (const candidate of sourceFile.statements) {
        if (!ts.isVariableStatement(candidate)) continue;
        for (const declaration of candidate.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
          const initializer = declaration.initializer;
          if (!initializer) continue;
          // Unwrap `... satisfies T`.
          expression = ts.isSatisfiesExpression(initializer) ? initializer.expression : initializer;
        }
      }
    }

    if (ts.isObjectLiteralExpression(expression)) return expression;
  }

  return undefined;
}

function findAssignment(
  obj: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | undefined {
  for (const property of obj.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (propertyName(property.name) === name) return property;
  }
  return undefined;
}

/**
 * Read an args object literal, keeping each value's location.
 *
 * Only literal values are read. A spread, a reference or a call is omitted
 * rather than followed — the analyzer cannot know its value without executing
 * the module, and guessing would be exactly the false precision §17 forbids.
 */
function readStaticArgs(
  obj: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  repoRoot: string,
): Record<string, { value: string | boolean; location: SourceLocation }> {
  const out: Record<string, { value: string | boolean; location: SourceLocation }> = {};

  for (const property of obj.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = propertyName(property.name);
    if (key === undefined) continue;

    const { initializer } = property;
    const location = positionOf(sourceFile, property, repoRoot);

    if (ts.isStringLiteral(initializer)) out[key] = { value: initializer.text, location };
    else if (initializer.kind === ts.SyntaxKind.TrueKeyword) out[key] = { value: true, location };
    else if (initializer.kind === ts.SyntaxKind.FalseKeyword) out[key] = { value: false, location };
    else if (ts.isNumericLiteral(initializer)) out[key] = { value: initializer.text, location };
  }

  return out;
}

/** Resolve local JSX tag names in this file to canonical component ids. */
function resolveLocalComponents(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  repoRoot: string,
): Map<string, string> {
  const bindings = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

    for (const element of namedBindings.elements) {
      const symbol = checker.getSymbolAtLocation(element.name);
      if (!symbol) continue;
      const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

      for (const declaration of resolved.getDeclarations() ?? []) {
        const declName = (declaration as ts.NamedDeclaration).name;
        if (!declName || !ts.isIdentifier(declName)) continue;
        bindings.set(
          element.name.text,
          componentId(toRepoPath(declaration.getSourceFile().fileName, repoRoot), declName.text),
        );
        break;
      }
    }
  }

  return bindings;
}

/** Known components rendered statically in this story file, in first-seen order. */
function collectJsxComponents(
  sourceFile: ts.SourceFile,
  bindings: Map<string, string>,
  knownComponentIds: Set<string>,
): Array<{ id: string; name: string }> {
  const seen = new Map<string, { id: string; name: string }>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = tagNameOf(node);
      if (tagName && !isIntrinsicTag(tagName)) {
        const id = bindings.get(tagName);
        if (id && knownComponentIds.has(id) && !seen.has(id)) {
          seen.set(id, { id, name: tagName });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...seen.values()];
}