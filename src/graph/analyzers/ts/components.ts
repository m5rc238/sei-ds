/**
 * Component detection, stylesheet ownership, variant evidence and composition
 * (§14, §15, §16) using the TypeScript Compiler API.
 *
 * The single most important rule in this file: a component exists because a
 * source file declares one, not because a file is named like one. `Button.css`
 * belongs to `Button` only because `Button.tsx` runs `import './Button.css'`.
 * Remove that import and Button owns no stylesheet — which is the correct
 * answer, not a fallback to filename matching (§3.1).
 */

import path from 'node:path';
import ts from 'typescript';
import { componentId, toRepoPath } from '../../ids.ts';
import type { SeiGraphBuilder } from '../../graph.ts';
import type { RepoPath, SourceLocation } from '../../types.ts';
import { isIntrinsicTag, positionOf, tagNameOf } from './program.ts';

export type ComponentInfo = {
  id: string;
  exportName: string;
  file: RepoPath;
  /** Stylesheets this component claims via its own side-effect imports. */
  styleSheets: RepoPath[];
};

/**
 * A piece of TypeScript evidence that a variant or state exists.
 *
 * `propName` is the prop the source names as the driver. It is empty when the
 * source does not name one — an empty value means "no prop evidence", never a
 * guessed prop (§16).
 */
export type VariantEvidence = {
  variantName: string;
  kind: 'variant' | 'state';
  propName: string;
  location: SourceLocation;
  /** The declaration or expression this evidence came from, for the report. */
  origin: 'union-type' | 'class-template' | 'class-literal' | 'contract' | 'css-modifier' | 'css-pseudo-class';
  originText: string;
};

export type CompositionEdge = {
  fromComponentId: string;
  toComponentId: string;
  location: SourceLocation;
  tagName: string;
};

export type ComponentAnalysis = {
  components: ComponentInfo[];
  styleSheetOwners: Map<RepoPath, Array<{ componentId: string; componentName: string }>>;
  /** Component id -> variant/state evidence found in TypeScript. */
  variantEvidence: Map<string, VariantEvidence[]>;
  /**
   * Component id -> the root class names the component's own JSX applies.
   *
   * Read from the class-name construction inside the component (`['sei-button',
   * ...]`), which is what makes it evidence rather than a naming convention.
   * CSS variant attribution is gated on this (§16).
   */
  rootClasses: Map<string, Set<string>>;
  compositions: CompositionEdge[];
  /** JSX with an unresolvable or dynamic tag, recorded but never connected. */
  unresolvedJsx: Array<{ location: SourceLocation; tagName: string }>;
};

/** Wrappers §14 asks us to see through when resolving an export to a component. */
const WRAPPERS = new Set(['memo', 'forwardRef']);

/** A resolved component export within one file. */
type ComponentExport = {
  exportName: string;
  location: SourceLocation;
  fn: ts.FunctionLikeDeclaration;
  styleSheets: RepoPath[];
  styleSheetImports: SourceLocation[];
  /** Local name -> canonical id, for composition within this file. */
  bindings: Map<string, string>;
};

export function analyzeComponents(
  builder: SeiGraphBuilder,
  program: ts.Program,
  checker: ts.TypeChecker,
  repoRoot: string,
  componentFiles: RepoPath[],
): ComponentAnalysis {
  const result: ComponentAnalysis = {
    components: [],
    styleSheetOwners: new Map(),
    variantEvidence: new Map(),
    rootClasses: new Map(),
    compositions: [],
    unresolvedJsx: [],
  };

  for (const file of componentFiles) {
    const sourceFile = program.getSourceFile(path.join(repoRoot, file));
    if (!sourceFile) continue;

    const exports = findComponentExports(sourceFile, checker, repoRoot);
    if (exports.length === 0) continue;

    for (const decl of exports) {
      const info: ComponentInfo = {
        id: componentId(file, decl.exportName),
        exportName: decl.exportName,
        file,
        styleSheets: decl.styleSheets,
      };
      result.components.push(info);

      builder.addNode({
        id: info.id,
        type: 'component',
        name: decl.exportName,
        exportName: decl.exportName,
        file,
        styleSheets: decl.styleSheets,
        evidence: [decl.location, ...decl.styleSheetImports],
      });

      for (const sheet of decl.styleSheets) {
        const existing = result.styleSheetOwners.get(sheet);
        const owner = { componentId: info.id, componentName: decl.exportName };
        if (existing) {
          if (!existing.some((o) => o.componentId === info.id)) existing.push(owner);
        } else {
          result.styleSheetOwners.set(sheet, [owner]);
        }
      }
    }

    for (const decl of exports) {
      const ownerId = componentId(file, decl.exportName);
      const evidence: VariantEvidence[] = [];

      collectUnionTypeVariants(sourceFile, decl, evidence, repoRoot);
      collectClassNameVariants(sourceFile, decl, evidence, repoRoot);
      collectComposition(sourceFile, decl, ownerId, result, repoRoot);

      if (evidence.length > 0) result.variantEvidence.set(ownerId, evidence);

      const roots = findRootClasses(decl.fn);
      if (roots.size > 0) result.rootClasses.set(ownerId, roots);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Finding component exports                                                  */
/* -------------------------------------------------------------------------- */

function findComponentExports(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  repoRoot: string,
): ComponentExport[] {
  const out: ComponentExport[] = [];
  const { styleSheets, styleSheetImports } = collectStyleSheetImports(sourceFile, repoRoot);

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      out.push(
        makeExport(statement.name.text, statement, statement, sourceFile, styleSheets, styleSheetImports, checker, repoRoot),
      );
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const fn = unwrapComponent(declaration.initializer, checker);
        if (!fn) continue;
        out.push(
          makeExport(
            declaration.name.text,
            declaration,
            fn,
            sourceFile,
            styleSheets,
            styleSheetImports,
            checker,
            repoRoot,
          ),
        );
      }
    }
  }

  return out;
}

function makeExport(
  exportName: string,
  declaredAt: ts.Node,
  fn: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
  styleSheets: RepoPath[],
  styleSheetImports: SourceLocation[],
  checker: ts.TypeChecker,
  repoRoot: string,
): ComponentExport {
  return {
    exportName,
    location: positionOf(sourceFile, declaredAt, repoRoot),
    fn,
    styleSheets,
    styleSheetImports,
    bindings: resolveComponentBindings(sourceFile, checker, repoRoot),
  };
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Resolve an expression to the function that implements a component, seeing
 * through `memo(...)` and `forwardRef(...)` (§14).
 */
function unwrapComponent(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  depth = 0,
): ts.FunctionLikeDeclaration | undefined {
  // Guards against a pathological self-referential chain.
  if (depth > 8) return undefined;

  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression;

  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)
        ? callee.name.text
        : undefined;

    if (name && WRAPPERS.has(name) && expression.arguments[0]) {
      return unwrapComponent(expression.arguments[0], checker, depth + 1);
    }
  }

  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    const resolved = symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
    for (const declaration of resolved?.getDeclarations() ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        return unwrapComponent(declaration.initializer, checker, depth + 1);
      }
    }
  }

  return undefined;
}

/**
 * `import './Button.css'` — a side-effect import of a stylesheet.
 *
 * A *default* import of a `.css` file would be a module usage rather than an
 * ownership claim, so only side-effect imports count. Ownership drives every
 * token usage edge, so being strict here is what keeps those edges honest.
 */
function collectStyleSheetImports(
  sourceFile: ts.SourceFile,
  repoRoot: string,
): { styleSheets: RepoPath[]; styleSheetImports: SourceLocation[] } {
  const styleSheets: RepoPath[] = [];
  const styleSheetImports: SourceLocation[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (statement.importClause) continue;

    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) continue;
    if (!specifier.text.endsWith('.css')) continue;

    // Keep the absolute path intact until `toRepoPath` has removed the repo
    // root, then drop the leading separator. Normalising first and stripping the
    // root second leaves a path that no longer starts with the root, so the
    // prefix match fails and every stylesheet ends up unowned.
    const absolute = path.resolve(path.dirname(sourceFile.fileName), specifier.text);
    const repoRelative = toRepoPath(absolute, repoRoot);

    styleSheets.push(repoRelative);
    styleSheetImports.push(positionOf(sourceFile, specifier, repoRoot));
  }

  return { styleSheets, styleSheetImports };
}

/**
 * Map every local binding in this file to the canonical id of the component it
 * names.
 *
 * Resolution goes through the checker's symbol table, through the barrel
 * re-export, to the original declaration. An import alias still resolves, and a
 * component is only bound if its declaration really is a component function.
 */
function resolveComponentBindings(
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
      const declarations = resolved.getDeclarations() ?? [];

      for (const declaration of declarations) {
        const declName = (declaration as ts.NamedDeclaration).name;
        if (!declName || !ts.isIdentifier(declName)) continue;

        const targetFile = toRepoPath(declaration.getSourceFile().fileName, repoRoot);
        const id = componentId(targetFile, declName.text);

        // Only bind when the target is a component declaration, not an interface.
        if (isComponentDeclaration(declaration, checker)) {
          bindings.set(element.name.text, id);
          break;
        }
      }
    }
  }

  return bindings;
}

function isComponentDeclaration(declaration: ts.Declaration, checker: ts.TypeChecker): boolean {
  if (ts.isFunctionDeclaration(declaration)) return true;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    return unwrapComponent(declaration.initializer, checker) !== undefined;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Variant evidence from TypeScript                                           */
/* -------------------------------------------------------------------------- */

/**
 * Union-typed variant props.
 *
 * `export type ButtonVariant = 'primary' | 'secondary' | ...` bound to the
 * `variant` prop. The union gives the *set* of values; the prop binding gives
 * the driver. Both are required, so an unbound union alias produces nothing.
 */
function collectUnionTypeVariants(
  sourceFile: ts.SourceFile,
  decl: ComponentExport,
  out: VariantEvidence[],
  repoRoot: string,
): void {
  const aliasNames = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue;
    if (!ts.isUnionTypeNode(statement.type)) continue;

    const members: string[] = [];
    for (const member of statement.type.types) {
      if (!ts.isLiteralTypeNode(member)) continue;
      if (!ts.isStringLiteral(member.literal)) continue;
      members.push(member.literal.text);
    }
    if (members.length === 0) continue;

    // Which prop of this component uses this alias?
    const propName = findPropUsingAlias(sourceFile, statement.name.text);
    if (!propName) {
      // The alias exists but no prop of this component consumes it, so there is
      // no evidence that it describes a variant of *this* component.
      continue;
    }

    aliasNames.add(statement.name.text);
    const location = positionOf(sourceFile, statement, repoRoot);

    for (const member of members) {
      out.push({
        variantName: member,
        kind: 'variant',
        propName,
        location,
        origin: 'union-type',
        originText: `type ${statement.name.text} = ${members.map((m) => `'${m}'`).join(' | ')}`,
      });
    }
  }

  void decl;
}

/** The prop in an interface whose type references the given alias. */
function findPropUsingAlias(sourceFile: ts.SourceFile, aliasName: string): string | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || !member.type) continue;
      if (!ts.isIdentifier(member.name)) continue;
      if (typeReferencesAlias(member.type, aliasName)) return member.name.text;
    }
  }
  return undefined;
}

/**
 * Whether a type node mentions the given alias, at any depth.
 *
 * One recursive function rather than a nested visitor: a nested visitor that
 * re-checks each child would re-enter this function on nodes it has already
 * descended into and recurse forever.
 */
function typeReferencesAlias(node: ts.Node, aliasName: string): boolean {
  if (ts.isTypeReferenceNode(node)) {
    const { typeName } = node;
    const text = ts.isIdentifier(typeName) ? typeName.text : typeName.right.text;
    if (text === aliasName) return true;
  }

  let found = false;
  const visit = (child: ts.Node) => {
    if (!found && typeReferencesAlias(child, aliasName)) found = true;
  };
  ts.forEachChild(node, visit);
  return found;
}

/**
 * Class-name construction.
 *
 * Two shapes appear in this repository:
 *
 *   `sei-button--${variant}`      — template literal, names the driving prop
 *   `bare ? 'sei-card--bare'`     — conditional, names the driving prop
 *   className="sei-input--error"  — literal, names no prop
 *
 * The template form is the structural bridge between a variant *value* and a
 * CSS modifier class (§16). It yields a placeholder rather than a value, which
 * `variants.ts` intersects with the modifier rules that actually exist in CSS.
 */
function collectClassNameVariants(
  sourceFile: ts.SourceFile,
  decl: ComponentExport,
  out: VariantEvidence[],
  repoRoot: string,
): void {
  const seen = new Set<string>();

  const push = (evidence: VariantEvidence) => {
    const key = `${evidence.variantName}|${evidence.kind}|${evidence.propName}|${evidence.origin}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(evidence);
  };

  const visit = (node: ts.Node) => {
    // `prefix--${prop}`
    if (ts.isTemplateExpression(node)) {
      const match = /^(.*?)--\$\{([A-Za-z0-9_$]+)\}$/.exec(node.head.text);
      const substitution = node.templateSpans[0]?.expression;
      if (match && substitution && ts.isIdentifier(substitution)) {
        push({
          variantName: match[1]!,
          kind: 'variant',
          propName: substitution.text,
          location: positionOf(sourceFile, node, repoRoot),
          origin: 'class-template',
          // The value is dynamic; the literal prefix identifies the modifier
          // *family*, not a variant value.
          originText: node.getText(sourceFile),
        });
      }
    }

    // `cond ? 'sei-card--bare' : null`
    if (ts.isConditionalExpression(node)) {
      const whenTrue = node.whenTrue;
      const condition = node.condition;
      if (ts.isStringLiteral(whenTrue) && ts.isIdentifier(condition)) {
        for (const modifier of modifiersIn(whenTrue.text)) {
          push({
            variantName: modifier,
            kind: 'variant',
            propName: condition.text,
            location: positionOf(sourceFile, node, repoRoot),
            origin: 'class-literal',
            originText: whenTrue.text,
          });
        }
      }
    }

    // A class name string literal anywhere inside the component.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      for (const modifier of modifiersIn(node.text)) {
        push({
          variantName: modifier,
          kind: 'variant',
          // No prop is named by a bare literal; the caller may supply one.
          propName: '',
          location: positionOf(sourceFile, node, repoRoot),
          origin: 'class-literal',
          originText: node.text,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(decl.fn);
}

/**
 * The root class names a component applies to its own rendered element.
 *
 * `const classes = ['sei-button', ...]` yields `sei-button`. Only classes that
 * are not modifiers and not elements count: `sei-button--primary` is a variant
 * of the root, and `sei-card__title` is part of it, neither is the root.
 *
 * Returning an empty set is meaningful: it means the component renders no
 * class name this analyzer can read, so CSS variant attribution for it stays
 * off rather than guessing from the file name.
 */
/**
 * Classes a component can carry on its own root element.
 *
 * Only literals in *class contexts* count: an array literal (the
 * `[root, modifier, className]` join idiom) or a JSX `className`/`class`
 * attribute. Scanning every string literal in the function was too broad —
 * `position="popper"` made `popper` a "root class" of Select, the root gate
 * then rejected every `sei-select` rule, and the component lost all of its
 * CSS variant and state evidence. Prop values are not class names.
 *
 * A BEM element class (`sei-select__trigger`) contributes its block prefix
 * (`sei-select`): elements are written as `block__element`, so the block IS
 * the root. Modifier classes (`block--variant`) are skipped — they are
 * variants, not roots.
 */
function findRootClasses(fn: ts.FunctionLikeDeclaration): Set<string> {
  const roots = new Set<string>();
  const inClassContext = new Set<ts.Node>();

  // Mark every node that sits inside a class context.
  const mark = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const collect = (n: ts.Node) => {
        inClassContext.add(n);
        ts.forEachChild(n, collect);
      };
      collect(node);
      return;
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'className' || node.name.text === 'class')
    ) {
      const collect = (n: ts.Node) => {
        inClassContext.add(n);
        ts.forEachChild(n, collect);
      };
      collect(node);
      return;
    }
    ts.forEachChild(node, mark);
  };
  mark(fn);

  const visit = (node: ts.Node) => {
    if (
      inClassContext.has(node) &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      for (const part of node.text.split(/\s+/)) {
        if (part === '' || part === 'null' || part === 'undefined') continue;
        if (part.includes('--')) continue; // modifier, not a root
        const elementIndex = part.indexOf('__');
        const candidate =
          elementIndex > 0 ? part.slice(0, elementIndex) : part;
        if (!/^[a-z][a-z0-9-]*$/.test(candidate)) continue;
        roots.add(candidate);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);

  return roots;
}

/**
 * BEM-style modifier names in a class string.
 *
 * `sei-button--primary` yields `primary`. `sei-card__body` yields nothing: an
 * element, not a modifier. Restricting to the modifier syntax keeps BEM element
 * classes from being mistaken for variants.
 */
export function modifiersIn(className: string): string[] {
  const out: string[] = [];
  const re = /(?<![\w-])[a-z0-9]+(?:-[a-z0-9]+)*--([a-z0-9][a-z0-9-]*)(?![\w-])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(className)) !== null) {
    out.push(match[1]!);
  }
  return [...new Set(out)];
}

/* -------------------------------------------------------------------------- */
/* Composition (§15)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Static JSX establishing `used --composition--> user` (§3.4, §15).
 *
 * Only a tag that resolves through the symbol table to a known component
 * produces an edge. A dynamic tag (`<Component />` where `Component` is a
 * prop) is recorded as unresolved instead of being connected to whatever it
 * might be at runtime.
 */
function collectComposition(
  sourceFile: ts.SourceFile,
  decl: ComponentExport,
  ownerId: string,
  result: ComponentAnalysis,
  repoRoot: string,
): void {
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = tagNameOf(node);
      if (tagName && !isIntrinsicTag(tagName)) {
        const targetId = decl.bindings.get(tagName);
        if (targetId) {
          result.compositions.push({
            fromComponentId: targetId,
            toComponentId: ownerId,
            location: positionOf(sourceFile, node, repoRoot),
            tagName,
          });
        } else if (!isLocalIntrinsic(tagName)) {
          result.unresolvedJsx.push({ location: positionOf(sourceFile, node, repoRoot), tagName });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(decl.fn);
}

/** `<>...</>` fragments and lowercase tags are not component references. */
function isLocalIntrinsic(tagName: string): boolean {
  return isIntrinsicTag(tagName);
}