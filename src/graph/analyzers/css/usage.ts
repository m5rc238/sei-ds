/**
 * Token usage and fallback edges (§11, §13).
 *
 * Two responsibilities:
 *
 *   1. Turn `var()` references in component stylesheets into `usage` edges
 *      (token → component) and `fallback` edges (token → component).
 *   2. Decide *which component owns a stylesheet*. Ownership comes from the
 *      component's own `import './X.css'` statement, resolved through the TS
 *      program. Filename matching is never used: `Button.css` would not be
 *      Button's stylesheet if Button did not import it (§3.1).
 *
 * The fallback distinction is the load-bearing part. Given
 *
 *     border-radius: var(--button-radius, var(--radius-md));
 *
 * this produces
 *
 *     button-radius --usage----> Button
 *     radius-md    --fallback-> Button
 *
 * and never a plain dependency for `--radius-md`, because `--radius-md` is only
 * read when `--button-radius` is absent (§11).
 */

import type { SeiGraphBuilder } from '../../graph.ts';
import type { ParsedCss } from './parse.ts';
import { extractVarReferences } from './parse.ts';
import { tokenId, variantNodeId } from '../../ids.ts';
import type { RepoPath } from '../../types.ts';
import { modifiersIn } from '../ts/components.ts';

export type StyleSheetOwner = {
  /** Component id that imports this stylesheet. */
  componentId: string;
  componentName: string;
};



/**
 * Analyse token usage across stylesheets.
 *
 * `owners` maps a stylesheet path to the component that imports it. A reference
 * in a stylesheet with no owner produces a diagnostic and no edge — that is the
 * `globals.css` and `compositions.css` case (SOURCE-PATTERNS §5), where no
 * single component can honestly be named.
 */
export function analyzeUsage(
  builder: SeiGraphBuilder,
  stylesheets: ParsedCss[],
  owners: Map<RepoPath, StyleSheetOwner[]>,
): void {
  // One diagnostic per unowned stylesheet, not one per reference site: the
  // finding is about the file, and a dozen near-identical rows would bury it.
  //
  // Deliberately function-local rather than module state. A module-level set
  // would persist across builds in the same process and make a second build
  // emit fewer diagnostics than the first, which would break §19 determinism.
  const reportedUnowned = new Set<RepoPath>();

  for (const sheet of stylesheets) {
    const ownersForSheet = owners.get(sheet.file) ?? [];
    const owner = ownersForSheet[0];

    if (ownersForSheet.length > 1) {
      builder.addDiagnostic({
        level: 'info',
        code: 'stylesheet-shared',
        message:
          `${sheet.file} is imported by ${ownersForSheet.length} components ` +
          `(${ownersForSheet.map((o) => o.componentName).join(', ')}). Its declarations were attributed to ` +
          'all of them, because the source shows each of them loading this stylesheet. No single owner was invented.',
        source: { file: sheet.file },
      });
    }

    for (const rule of sheet.rules) {
      for (const declaration of rule.declarations) {
        if (declaration.property.startsWith('--')) continue; // a declaration, not a usage

        const references = extractVarReferences(declaration.value);
        if (references.length === 0) continue;

        const location = {
          file: declaration.file,
          line: declaration.line,
          column: declaration.column,
        };

        for (const ref of references) {
          const referencedId = tokenId(ref.name);

          // A referenced name that was never declared still needs a node,
          // because §11 requires an edge to it. It is created here — with
          // `origin: 'undeclared'` and layer `unknown` — rather than being
          // invented with a guessed layer or value.
          if (!builder.hasNode(referencedId)) {
            builder.addNode({
              id: referencedId,
              type: 'token',
              name: ref.name,
              tokenName: ref.name,
              layer: 'unknown',
              origin: 'undeclared',
              evidence: [location],
              layerBasis:
                'referenced but never declared; no source evidence supports a layer',
            });

            builder.addDiagnostic({
              level: 'info',
              code: 'token-undeclared',
              message:
                `--${ref.name} is referenced at ${declaration.file}:${declaration.line} but is never ` +
                'declared in any stylesheet. It has no definition in source, so it has no aliases and ' +
                'no layer. In this repository it is supplied at runtime by an override, which this ' +
                'static analyzer does not model (§3.6).',
              source: location,
            });
          }

          if (!owner) {
            // Recorded once per stylesheet rather than per reference.
            if (!reportedUnowned.has(sheet.file)) {
              reportedUnowned.add(sheet.file);
              builder.addDiagnostic({
                level: 'info',
                code: 'token-usage-unowned',
                message:
                  `${sheet.file} references design tokens, but no component imports it, so the ` +
                  'references cannot be attributed to a single component and no usage edges were created. ' +
                  'Attribute the stylesheet to a component, or accept that these tokens have no owning consumer.',
                source: location,
              });
            }
            continue;
          }

          // A declaration inside a modifier selector (`.sei-button--primary`)
          // belongs to that variant as well as to the component. Recording
          // both is what lets "what does --color-action affect?" answer
          // `primary`, rather than only "Button" (§6 direction, §11 shape).
          const selectorModifiers = modifiersIn(declaration.selector);

          for (const sheetOwner of ownersForSheet) {
            for (const modifier of selectorModifiers) {
              const variantId = variantNodeId(sheetOwner.componentId, 'variant', modifier);
              if (!builder.hasNode(variantId)) continue;

              builder.addEdge({
                type: 'usage',
                source: referencedId,
                target: variantId,
                evidence: [location],
                description:
                  `--${ref.name} is read by ${declaration.property} in the ${selectorModifiers[0]} variant ` +
                  `of ${sheetOwner.componentName} (${declaration.file}:${declaration.line}).`,
                conditional: false,
              });
            }

            if (ref.isFallback) {
              builder.addEdge({
                type: 'fallback',
                source: referencedId,
                target: sheetOwner.componentId,
                evidence: [location],
                description:
                  `--${ref.name} is referenced as the fallback branch of a var() expression in ` +
                  `${declaration.property} at ${declaration.file}:${declaration.line}. It applies to ` +
                  `${sheetOwner.componentName} only when the primary custom property is not set. ` +
                  'This analyzer has not executed the CSS cascade.',
                conditional: false,
              });
            } else {
              builder.addEdge({
                type: 'usage',
                source: referencedId,
                target: sheetOwner.componentId,
                evidence: [location],
                description:
                  `--${ref.name} is read by ${declaration.property} at ` +
                  `${declaration.file}:${declaration.line} in ${sheetOwner.componentName}.`,
                conditional: false,
              });
            }
          }
        }
      }
    }
  }
}