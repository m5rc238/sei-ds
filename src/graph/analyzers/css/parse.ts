/**
 * CSS parsing with PostCSS (§10).
 *
 * PostCSS is the only parser used. Regex does not appear here: a regex cannot
 * tell `a { color: red }` from a comment containing that text, cannot handle
 * nesting, and cannot give a trustworthy column for the `var()` it finds.
 *
 * This layer produces a structural description of each stylesheet and knows
 * nothing about tokens, components or the graph. Turning this into relationships
 * is the job of `tokens.ts` and `usage.ts`.
 */

import postcss, { type AtRule, type ChildNode, type Declaration, type Rule } from 'postcss';
import type { RepoPath } from '../types.ts';

/** A single declaration, with 1-based source position (§7). */
export type CssDeclaration = {
  property: string;
  value: string;
  selector: string;
  file: RepoPath;
  /** 1-based line of the declaration. */
  line: number;
  /** 1-based column of the declaration's property name. */
  column: number;
};

/** A rule (selector + declarations), with 1-based source position. */
export type CssRule = {
  selector: string;
  file: RepoPath;
  line: number;
  column: number;
  declarations: CssDeclaration[];
  /** True when the rule is inside an `@media`/`@supports`/etc. */
  conditional: boolean;
};

/** A custom-property declaration: `--name: value`. */
export type CssCustomProperty = {
  /** Name without the leading `--`. */
  name: string;
  /** Name as written, including `--`. */
  rawName: string;
  value: string;
  selector: string;
  file: RepoPath;
  line: number;
  column: number;
};

export type ParsedStylesheet = {
  file: RepoPath;
  rules: CssRule[];
  customProperties: CssCustomProperty[];
};

/** A `/* ... *\/` comment, retained because section banners are layer evidence. */
export type CssComment = {
  text: string;
  file: RepoPath;
  line: number;
  column: number;
};

export type ParsedCss = ParsedStylesheet & {
  comments: CssComment[];
};

/**
 * PostCSS reports `source.start` 1-based, which is what we want. The cast is
 * localised here because the type is only narrowed when `from` is set.
 */
function positionOf(node: ChildNode | Declaration | Rule): { line: number; column: number } {
  const start = node.source?.start;
  return { line: start?.line ?? 0, column: start?.column ?? 0 };
}

/**
 * Parse one stylesheet.
 *
 * A parse failure is a thrown error, not a silent empty result: a stylesheet
 * that cannot be parsed means the graph would be quietly incomplete, and §3.2
 * requires uncertainty to be visible rather than hidden behind an empty node.
 */
export function parseCss(css: string, file: RepoPath): ParsedCss {
  let root: postcss.Root;

  try {
    root = postcss.parse(css, { from: file });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`PostCSS failed to parse ${file}: ${reason}`);
  }

  const rules: CssRule[] = [];
  const customProperties: CssCustomProperty[] = [];
  const comments: CssComment[] = [];

  const walk = (nodes: postcss.Container, conditional: boolean) => {
    for (const node of nodes.nodes ?? []) {
      if (node.type === 'comment') {
        const { line, column } = positionOf(node);
        comments.push({ text: node.text.trim(), file, line, column });
        continue;
      }

      if (node.type === 'atrule') {
        const atRule = node as AtRule;
        // Conditional groups change when a declaration applies; nesting and
        // keyframes do not introduce a scope of their own.
        const name = atRule.name.toLowerCase();
        const isConditionalGroup =
          name === 'media' || name === 'supports' || name === 'container' || name === 'layer';
        walk(atRule, conditional || isConditionalGroup);
        continue;
      }

      if (node.type !== 'rule') continue;

      const rule = node as Rule;
      const selector = rule.selector.trim();
      const rulePos = positionOf(rule);

      const declarations: CssDeclaration[] = [];

      rule.each((child) => {
        if (child.type !== 'decl') return;
        const decl = child as Declaration;
        const { line, column } = positionOf(decl);
        const property = decl.prop.trim();

        declarations.push({ property, value: decl.value, selector, file, line, column });

        if (property.startsWith('--')) {
          customProperties.push({
            name: property.slice(2),
            rawName: property,
            value: decl.value.trim(),
            selector,
            file,
            line,
            column,
          });
        }
      });

      rules.push({
        selector,
        file,
        line: rulePos.line,
        column: rulePos.column,
        declarations,
        conditional,
      });

      // Nested rules (CSS nesting) are real rules with their own selectors.
      if (rule.nodes && rule.nodes.length > 0) walk(rule, conditional);
    }
  };

  walk(root, false);

  return { file, rules, customProperties, comments };
}

/**
 * Extract `var()` references from a declaration value.
 *
 * PostCSS has already established the declaration; this is the "narrowly scoped
 * value parsing" §10 permits. It is deliberately small: it understands the
 * comma that separates a `var()` name from its fallback, and tracks nesting so
 * that `var(--a, var(--b))` attributes `--b` as a fallback of `--a` rather than
 * as an ordinary dependency.
 *
 * A hand-rolled scanner is used rather than a general CSS expression parser
 * because the only expression we care about is `var()`.
 */
export type VarReference = {
  /** Referenced custom property name, without `--`. */
  name: string;
  /**
   * True when this reference sits in the fallback branch of an enclosing
   * `var()`. Conditional relationships, not ordinary dependencies (§11).
   */
  isFallback: boolean;
  /** 1-based offset of the reference within the value string. */
  offset: number;
};

export function extractVarReferences(value: string): VarReference[] {
  const out: VarReference[] = [];

  const scan = (text: string, offsetBase: number, insideFallback: boolean) => {
    let i = 0;

    while (i < text.length) {
      const open = text.indexOf('var(', i);
      if (open === -1) return;

      // Parse the argument list of this var() by tracking nesting depth.
      let depth = 0;
      let j = open + 3;
      let close = -1;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            close = j;
            break;
          }
        }
      }
      if (close === -1) return; // unterminated var(): stop, report nothing extra

      const inner = text.slice(open + 4, close);
      // The first top-level comma separates the name from the fallback.
      let split = -1;
      let d = 0;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (ch === '(') d++;
        else if (ch === ')') d--;
        else if (ch === ',' && d === 0) {
          split = k;
          break;
        }
      }

      const namePart = (split === -1 ? inner : inner.slice(0, split)).trim();
      const fallbackPart = split === -1 ? '' : inner.slice(split + 1);

      const nameMatch = /^--([A-Za-z0-9_-]+)$/.exec(namePart);
      if (nameMatch) {
        out.push({
          name: nameMatch[1]!,
          // The name in the *first* position of a var() is the primary
          // reference, even when a fallback follows:
          //   var(--button-radius, var(--radius-md))
          // makes `--button-radius` the usage and `--radius-md` the fallback
          // (§11). Only recursion into the fallback branch sets this, which is
          // why `insideFallback` alone is the correct condition — including
          // `split !== -1` would wrongly make the outer name conditional.
          isFallback: insideFallback,
          offset: offsetBase + open + 4,
        });
      }

      // Recurse: the fallback branch is marked, and any var() nested inside the
      // *name* position cannot exist (a name is not an expression).
      if (fallbackPart.trim() !== '') {
        scan(fallbackPart, offsetBase + open + 4 + split + 1, true);
      }

      i = close + 1;
    }
  };

  scan(value, 0, false);
  return out;
}