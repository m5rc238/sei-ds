/**
 * Contract evidence (component contracts as a graph source).
 *
 * A contract file (`src/contracts/*.contract.ts`) is the design decision
 * record for a component's API surface: which variant values exist, which
 * prop drives them, which modifier classes switch on truthiness, which states
 * the stylesheet must style.
 *
 * Binding is structural, never by name: a contract's evidence is attributed to
 * a component only when that component's source file imports the contract
 * module (an import declaration or an `export … from` re-export). This is the
 * same standard the rest of the analyzers hold — see SOURCE-PATTERNS §3.1.
 *
 * Contract evidence then flows through the existing merge in `variants.ts`:
 * one canonical variant/state node per (component, kind, name) with the
 * contract's file:line locations attached alongside the CSS and TS evidence.
 */

import path from 'node:path';
import ts from 'typescript';

import type { ComponentAnalysis, VariantEvidence } from './components.ts';
import { positionOf } from './program.ts';
import type { RepoPath } from '../../types.ts';

export function analyzeContracts(
  program: ts.Program,
  repoRoot: string,
  contractFiles: RepoPath[],
  components: ComponentAnalysis,
): void {
  const evidenceByContract = new Map<RepoPath, VariantEvidence[]>();

  for (const file of contractFiles) {
    const sourceFile = program.getSourceFile(path.join(repoRoot, file));
    if (!sourceFile) continue;

    const evidence: VariantEvidence[] = [];
    collectContractEvidence(sourceFile, evidence, repoRoot);
    if (evidence.length > 0) evidenceByContract.set(file, evidence);
  }

  if (evidenceByContract.size === 0) return;

  for (const component of components.components) {
    const sourceFile = program.getSourceFile(path.join(repoRoot, component.file));
    if (!sourceFile) continue;

    for (const [contractFile, evidence] of evidenceByContract) {
      if (!importsModule(sourceFile, component.file, contractFile)) continue;

      const existing = components.variantEvidence.get(component.id) ?? [];
      const seen = new Set(
        existing.map((e) => `${e.kind}|${e.variantName}|${e.location.file}:${e.location.line}:${e.location.column}`),
      );
      const additions = evidence.filter(
        (e) => !seen.has(`${e.kind}|${e.variantName}|${e.location.file}:${e.location.line}:${e.location.column}`),
      );
      if (additions.length > 0) {
        components.variantEvidence.set(component.id, [...existing, ...additions]);
      }
    }
  }
}

/**
 * Extract evidence from `export const x = defineContract({ … })`.
 *
 * Only literal arrays are read. A spread, a reference or a computed key
 * produces no evidence, because there is nothing at this location to point at.
 */
function collectContractEvidence(
  sourceFile: ts.SourceFile,
  out: VariantEvidence[],
  repoRoot: string,
): void {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (!init || !ts.isCallExpression(init)) continue;
      if (!ts.isIdentifier(init.expression) || init.expression.text !== 'defineContract') continue;

      const arg = init.arguments[0];
      if (!arg || !ts.isObjectLiteralExpression(arg)) continue;

      for (const property of arg.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyName(property.name);
        if (key === 'props') collectProps(property.initializer, out, sourceFile, repoRoot);
        else if (key === 'modifiers') collectStringArray(property.initializer, out, sourceFile, repoRoot, 'modifier');
        else if (key === 'states') collectStringArray(property.initializer, out, sourceFile, repoRoot, 'state');
      }
    }
  }
}

function collectProps(
  initializer: ts.Expression,
  out: VariantEvidence[],
  sourceFile: ts.SourceFile,
  repoRoot: string,
): void {
  if (!ts.isObjectLiteralExpression(initializer)) return;

  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const propName = propertyName(property.name);
    if (!propName) continue;
    if (!ts.isArrayLiteralExpression(property.initializer)) continue;

    for (const element of property.initializer.elements) {
      if (!ts.isStringLiteral(element)) continue;
      out.push({
        variantName: element.text,
        kind: 'variant',
        propName,
        location: positionOf(sourceFile, element, repoRoot),
        origin: 'contract',
        originText: `${propName}: '${element.text}' (contract)`,
      });
    }
  }
}

function collectStringArray(
  initializer: ts.Expression,
  out: VariantEvidence[],
  sourceFile: ts.SourceFile,
  repoRoot: string,
  which: 'modifier' | 'state',
): void {
  if (!ts.isArrayLiteralExpression(initializer)) return;

  for (const element of initializer.elements) {
    if (!ts.isStringLiteral(element)) continue;
    out.push({
      variantName: element.text,
      kind: which === 'state' ? 'state' : 'variant',
      // A modifier is a truthiness switch on the prop of the same name — the
      // contract's `modifiers: ['bare']` means `bare` is the driving prop.
      propName: which === 'modifier' ? element.text : '',
      location: positionOf(sourceFile, element, repoRoot),
      origin: 'contract',
      originText: `${element.text} (contract ${which})`,
    });
  }
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/**
 * Whether `componentFile` imports `moduleFile`.
 *
 * Relative specifiers are resolved textually against the importing file's
 * directory and compared to the contract's repo-relative path. No module
 * resolution, no name guessing: if the import does not point at this file,
 * there is no relationship.
 */
function importsModule(sourceFile: ts.SourceFile, componentFile: RepoPath, moduleFile: RepoPath): boolean {
  const dir = path.posix.dirname(componentFile);

  for (const statement of sourceFile.statements) {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement)) specifier = statement.moduleSpecifier;
    else if (ts.isExportDeclaration(statement)) specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;

    const spec = specifier.text;
    if (!spec.startsWith('.')) continue;

    const base = path.posix.normalize(path.posix.join(dir, spec));
    const candidates = [base, `${base}.ts`, `${base}.tsx`, base.replace(/\.ts$/, '')];
    if (candidates.includes(moduleFile)) return true;
  }

  return false;
}
