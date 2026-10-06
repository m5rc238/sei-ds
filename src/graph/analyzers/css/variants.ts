/**
 * Variant and state detection from CSS, merged with TypeScript evidence (§16).
 *
 * The repository supplies two independent sources for the same logical variant:
 *
 *   TypeScript — `ButtonVariant = 'primary' | 'secondary' | ...`, and the
 *                template literal `sei-button--${variant}` that turns a value
 *                into a modifier class.
 *   CSS         — the rule `.sei-button--primary { ... }`.
 *
 * These MUST collapse into one node with both locations attached (§8, §16). The
 * interesting consequence is a negative one: a union member with no
 * corresponding CSS rule is still a variant the component *offers*, and a CSS
 * modifier with no union member is still styling the component *has*. Neither
 * is invented away, and a union member with no CSS anywhere is reported rather
 * than connected to nothing silently.
 *
 * States come from pseudo-class selectors, which are a different kind of thing:
 * a state is a condition, not a value the caller chooses.
 */

import type { SeiGraphBuilder } from '../../graph.ts';
import type { VariantEvidence } from '../ts/components.ts';
import { modifiersIn } from '../ts/components.ts';
import { variantNodeId } from '../../ids.ts';
import type { ParsedCss } from './parse.ts';

/** Pseudo-classes treated as states, and the states they name. */
const STATE_PSEUDO_CLASSES: Readonly<Record<string, string>> = {
  hover: 'hover',
  active: 'active',
  focus: 'focus',
  'focus-visible': 'focus-visible',
  'focus-within': 'focus-within',
  disabled: 'disabled',
  checked: 'checked',
  invalid: 'invalid',
  valid: 'valid',
  placeholder_shown: 'placeholder-shown',
};

/** Pseudo-elements that describe the element's own sub-part, not a state. */
const IGNORED_PSEUDO_ELEMENTS = new Set(['before', 'after', 'placeholder', 'first-line', 'first-letter']);

export type CssVariantInfo = {
  /** Component id -> variants found in that component's stylesheets. */
  byComponent: Map<string, VariantEvidence[]>;
};

/**
 * Extract variants and states from the stylesheets a component owns.
 *
 * `owners` is the stylesheet→component map built from `import './X.css'`
 * statements, never from filenames — a stylesheet with no owner contributes
 * nothing, because attributing it would be a guess.
 */
export function analyzeCssVariants(
  builder: SeiGraphBuilder,
  stylesheets: ParsedCss[],
  owners: Map<string, Array<{ componentId: string; componentName: string }>>,
  tsEvidence: Map<string, VariantEvidence[]>,
  rootClasses: Map<string, Set<string>>,
): CssVariantInfo {
  const byComponent = new Map<string, VariantEvidence[]>();
  const cssByComponent = new Map<string, VariantEvidence[]>();

  for (const sheet of stylesheets) {
    const ownersForSheet = owners.get(sheet.file) ?? [];
    if (ownersForSheet.length === 0) continue;

    for (const rule of sheet.rules) {
      // Skip declarations; only selectors carry variant and state meaning.
      const { modifiers, pseudoClasses, elements, dataStates } = analyzeSelector(rule.selector);
      const base = baseClassOf(rule.selector);

      for (const modifier of modifiers) {
        // A BEM element selector (`__header`, `__title`) styles one part of the
        // component; it is not a variant of the component. Modifier evidence
        // stays gated on this — state evidence does not: Radix-backed
        // components style their states on child elements
        // (`.sei-tabs__trigger[data-state='active']`), and that state belongs
        // to the component as a whole. The root-class gate below still applies
        // to both.
        if (elements.length > 0) break;

        // A modifier only describes a variant of a component when its base
        // class is that component's own root class. Without this gate a shared
        // stylesheet would invent variants: `.sei-canvas--surface` in
        // compositions.css belongs to the Storybook page shell, not to any
        // composition that happens to load that file (§3.1).
        for (const owner of ownersForSheet) {
          const roots = rootClasses.get(owner.componentId);
          if (roots && !roots.has(base)) continue;

          pushEvidence(cssByComponent, owner.componentId, {
          variantName: modifier,
          kind: 'variant',
          // CSS does not name the driving prop. This stays empty, and the merge
          // step below fills it from the TypeScript template literal when both
          // sources agree — never from the modifier's own name.
          propName: '',
          location: { file: sheet.file, line: rule.line, column: rule.column },
          origin: 'css-modifier',
          originText: rule.selector,
        });
        }
      }

      // A state is a condition, not a value the caller chooses. It comes from
      // a pseudo-class (`:hover`) or a data attribute Radix sets
      // (`[data-state='active']`, `[data-highlighted]`). Whether it belongs to
      // the component or to one of its variants depends on the selector:
      // `.sei-input:hover` is a component state, `.sei-button--primary:hover`
      // is a state *of that variant*. Flattening the two would lose a real
      // distinction (§16).
      const stateNames = [
        ...new Set([
          ...pseudoClasses.filter((name) => name in STATE_PSEUDO_CLASSES),
          ...dataStates,
        ]),
      ];

      for (const stateName of stateNames) {
        for (const owner of ownersForSheet) {
          const roots = rootClasses.get(owner.componentId);
          if (roots && !roots.has(base)) continue;

          const stateNameForOwner =
            modifiers.length > 0 ? `${modifiers[0]}::${stateName}` : stateName;

          pushEvidence(cssByComponent, owner.componentId, {
            variantName: stateNameForOwner,
            kind: 'state',
            propName: '',
            location: { file: sheet.file, line: rule.line, column: rule.column },
            origin: 'css-pseudo-class',
            originText: rule.selector,
          });
        }
      }
    }
  }

  // Merge: one canonical node per (component, kind, name), all evidence kept.
  for (const [componentId, tsList] of tsEvidence) {
    const cssList = cssByComponent.get(componentId) ?? [];
    mergeAndEmit(builder, componentId, tsList, cssList);
    byComponent.set(componentId, [...tsList, ...cssList]);
  }

  // Components with CSS variants but no TS variants (Card's `--bare`, Input's
  // `--error`) still get nodes — the CSS is real evidence on its own.
  for (const [componentId, cssList] of cssByComponent) {
    if (tsEvidence.has(componentId)) continue;
    mergeAndEmit(builder, componentId, [], cssList);
    byComponent.set(componentId, cssList);
  }

  return { byComponent };
}

/** The class a modifier hangs off, e.g. `sei-button` from `.sei-button--primary`. */
function baseClassOf(selector: string): string {
  const match = /(?<![\w-])([a-z0-9]+(?:-[a-z0-9]+)*)--(?=[a-z0-9])/.exec(selector);
  if (match) return match[1]!;
  // First class in the selector. Written against the dot rather than a bare
  // word because the earlier word-boundary form silently returned '' for
  // `.sei-input:hover` (the lookbehind rejected the position after '.'), which
  // dropped every component-level state from plain class selectors.
  const cls = /\.(?=[a-z])([a-z][a-z0-9-]*)/.exec(selector);
  return cls?.[1] ?? '';
}

function pushEvidence(
  target: Map<string, VariantEvidence[]>,
  componentId: string,
  evidence: VariantEvidence,
): void {
  const list = target.get(componentId);
  if (list) {
    const duplicate = list.some(
      (e) =>
        e.variantName === evidence.variantName &&
        e.kind === evidence.kind &&
        e.origin === evidence.origin &&
        e.location.file === evidence.location.file &&
        e.location.line === evidence.location.line,
    );
    if (!duplicate) list.push(evidence);
    return;
  }
  target.set(componentId, [evidence]);
}

/**
 * Merge TS and CSS evidence into canonical variant/state nodes.
 *
 * The union of both sources is the node set; the intersection is what gets
 * attributed to a prop. A variant with only CSS evidence is real (Card's
 * `bare`); a variant with only TS evidence is real too (a size value the
 * stylesheet happens not to style); neither is fabricated.
 */
function mergeAndEmit(
  builder: SeiGraphBuilder,
  componentId: string,
  tsList: VariantEvidence[],
  cssList: VariantEvidence[],
): void {
  // Key by kind + name, merging across sources.
  const grouped = new Map<string, { kind: 'variant' | 'state'; name: string; evidence: VariantEvidence[] }>();

  for (const evidence of [...tsList, ...cssList]) {
    const key = `${evidence.kind}:${evidence.variantName}`;
    const existing = grouped.get(key);
    if (existing) existing.evidence.push(evidence);
    else grouped.set(key, { kind: evidence.kind, name: evidence.variantName, evidence: [evidence] });
  }

  for (const { kind, name, evidence } of grouped.values()) {
    // The driving prop comes only from evidence that names one. CSS never
    // names a prop, so a CSS-only variant has no `drivenByProp` — which is what
    // makes the story-arg check in `stories.ts` refuse to match it.
    const propNames = [
      ...new Set(evidence.map((e) => e.propName).filter((p): p is string => p !== '')),
    ];

    const id = variantNodeId(componentId, kind, name);

    builder.addNode({
      id,
      type: 'variant',
      name,
      variantName: name,
      kind,
      componentId,
      drivenByProp: propNames.length === 1 ? propNames[0] : undefined,
      evidence: evidence.map((e) => e.location),
    });

    builder.addEdge({
      type: kind === 'state' ? 'state' : 'variant',
      source: componentId,
      target: id,
      evidence: evidence.map((e) => e.location),
      description:
        kind === 'state'
          ? `State "${name}" of this component, evidenced by ${describeOrigins(evidence)}.`
          : `Variant "${name}" of this component, evidenced by ${describeOrigins(evidence)}.`,
                conditional: false,
              });

    // A variant value offered by the type but never styled is worth reporting:
    // it usually means a stylesheet is missing a rule.
    // Every origin except the two CSS ones is TypeScript evidence. Omitting
    // 'class-literal' made Card's `bare` and Input's `error` look CSS-only even
    // though both are written in TSX.
    const hasTs = evidence.some(
      (e) => e.origin !== 'css-modifier' && e.origin !== 'css-pseudo-class',
    );
    const hasCss = evidence.some((e) => e.origin === 'css-modifier');
    if (kind === 'variant' && hasTs && !hasCss) {
      builder.addDiagnostic({
        level: 'info',
        code: 'variant-unstyled',
        message:
          `Variant "${name}" is offered by this component's types but has no modifier rule in its ` +
          'stylesheet, so no styling for it was found. The variant node exists on type evidence alone.',
        source: evidence[0]?.location,
      });
    }
    if (kind === 'variant' && hasCss && !hasTs) {
      builder.addDiagnostic({
        level: 'info',
        code: 'variant-untyped',
        message:
          `Modifier class for variant "${name}" exists in CSS with no TypeScript prop declaring it, ` +
          'so this analyzer could not determine what drives it. The variant node exists on CSS evidence alone.',
        source: evidence[0]?.location,
      });
    }
  }
}

function describeOrigins(evidence: VariantEvidence[]): string {
  return [...new Set(evidence.map((e) => e.origin))].join(' + ');
}

/**
 * Pull modifiers, pseudo-classes, data-attribute states and BEM elements out
 * of a selector.
 *
 * Kept deliberately small and explicit. A general selector parser would be more
 * capable but would also make it easier to connect selectors the analyzer does
 * not actually understand.
 *
 * Data attributes are read from a copy of the selector with `:not()`/`:is()`/
 * `:where()`/`:has()` contents stripped first, so
 * `:hover:not([data-state='active'])` does not claim the `active` state —
 * it is being explicitly excluded there.
 */
export function analyzeSelector(selector: string): {
  modifiers: string[];
  pseudoClasses: string[];
  elements: string[];
  dataStates: string[];
} {
  const modifiers = modifiersIn(selector);
  const elements: string[] = [];

  const elementRe = /(?<![\w-])[a-z0-9]+(?:-[a-z0-9]+)*__([a-z0-9][a-z0-9-]*)(?![\w-])/g;
  let match: RegExpExecArray | null;
  while ((match = elementRe.exec(selector)) !== null) {
    elements.push(match[1]!);
  }

  const pseudoClasses: string[] = [];
  const pseudoRe = /::?([a-z-]+)(?:\([^)]*\))?/g;
  while ((match = pseudoRe.exec(selector)) !== null) {
    const name = match[1]!;
    // Distinguish pseudo-classes from pseudo-elements: `::x` is an element,
    // `:x` is a class, and `:not(...)` / `:is(...)` wrappers are not states.
    if (selector[match.index + 1] === ':') continue;
    if (IGNORED_PSEUDO_ELEMENTS.has(name)) continue;
    if (name === 'not' || name === 'is' || name === 'where' || name === 'has') continue;
    pseudoClasses.push(name);
  }

  // Data-attribute states. Only the ones Radix actually uses as states are
  // recognized: `data-state` with a value (`[data-state='open']` → `open`)
  // and the bare presence attributes `data-highlighted` / `data-disabled`.
  // Any other `data-*` attribute is a wiring detail, not a state.
  const cleaned = selector.replace(/:(?:not|is|where|has)\([^)]*\)/g, '');
  const dataStates: string[] = [];
  const stateAttrRe = /\[data-state=['"]([a-z-]+)['"]\]/g;
  while ((match = stateAttrRe.exec(cleaned)) !== null) {
    dataStates.push(match[1]!);
  }
  const presenceAttrRe = /\[data-(highlighted|disabled)\]/g;
  while ((match = presenceAttrRe.exec(cleaned)) !== null) {
    dataStates.push(match[1]!);
  }

  return { modifiers, pseudoClasses, elements, dataStates };
}