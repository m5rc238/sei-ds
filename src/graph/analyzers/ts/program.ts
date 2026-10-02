/**
 * Shared TypeScript program setup and AST helpers for the TS analyzers.
 *
 * Kept separate so component, variant and story analysis all resolve symbols
 * through one program. Separate programs would produce separate symbol tables
 * and quietly weaken resolution across files.
 */

import path from 'node:path';
import ts from 'typescript';

import { toRepoPath } from '../../ids';
import type { SourceLocation } from '../../types';

export type { SourceLocation };

/** Create a read-only program from the repository tsconfig. */
export function createProgram(_repoRoot: string, tsconfigPath: string): ts.Program {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config ?? {},
    ts.sys,
    path.dirname(tsconfigPath),
  );

  return ts.createProgram(parsed.fileNames, {
    ...parsed.options,
    noEmit: true,
  });
}

/**
 * A 1-based line/column location carrying its repo-relative file (§7).
 *
 * The file is part of the return value rather than left to the caller because
 * every evidence and diagnostic site needs it; omitting it produced locations
 * with a line but no file, which are useless for navigation.
 */
export function positionOf(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  _repoRoot: string,
): SourceLocation {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: toRepoPath(sourceFile.fileName, _repoRoot),
    line: line + 1,
    column: character + 1,
  };
}

/** Intrinsic (lowercase) JSX tags are DOM elements, not components. */
export function isIntrinsicTag(tagName: string): boolean {
  const first = tagName[0];
  return first !== undefined && first === first.toLowerCase();
}

/** `React.Button`-style tag names are not local components. */
export function tagNameOf(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string | undefined {
  const { tagName } = node;
  if (ts.isIdentifier(tagName)) return tagName.text;
  return undefined;
}

/** Read a JSX attribute's string literal value, if it is a literal. */
export function jsxAttributeString(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
): string | undefined {
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const attrName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText();
    if (attrName !== name) continue;
    const initializer = attribute.initializer;
    if (initializer && ts.isStringLiteral(initializer)) return initializer.text;
  }
  return undefined;
}

export function jsxAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
): ts.JsxAttribute | undefined {
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const attrName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText();
    if (attrName === name) return attribute;
  }
  return undefined;
}

export function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}