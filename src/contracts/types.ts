/**
 * Component contracts — the machine-readable description of what a public
 * component supports.
 *
 * A contract is the source of truth for a component's API surface:
 *
 *   - The component derives its variant/size types from the contract, so a
 *     value that is not in the contract cannot exist at compile time.
 *   - Storybook controls take their options from the contract, so the
 *     documentation layer cannot drift from the API.
 *   - `tests/contracts.test.ts` asserts that the contract matches the CSS
 *     modifier classes and pseudo-states the component actually styles.
 *   - The graph analyzer reads contract files as variant evidence, so the
 *     dependency graph points at the contract as the origin of each variant.
 *
 * Deliberately small. A contract records supported behavior; it is not a
 * place to park speculative variants "for completeness".
 */

/**
 * Value axes of a component: prop name → the values that prop accepts.
 *
 * `variant: ['primary', ...]` means `variant` is a prop whose value chooses
 * among those options, and each value maps to a CSS modifier class
 * (`<rootClass>--<value>`).
 */
export type ContractProps = Readonly<Record<string, readonly string[]>>;

/**
 * Prop-driven modifier classes named after the prop itself: `bare: true`
 * renders `<rootClass>--bare`, `error: '…'` renders `<rootClass>--error`.
 *
 * The distinction from `props` is real: a value axis has one class per
 * value, a modifier has one class that switches on truthiness.
 */
export type ContractModifiers = readonly string[];

export type ComponentContract = {
  /** Export name of the component the contract describes. */
  name: string;
  /** The component's CSS root class — the anchor for modifier matching. */
  rootClass: string;
  /**
   * What owns this component's interaction behavior. Either a native element
   * or the primitive package it wraps. This is the accessibility boundary,
   * stated per component (see docs/accessibility.md). */
  foundation: string;
  props?: ContractProps;
  modifiers?: ContractModifiers;
  /**
   * States beyond default that the component must style and demonstrate.
   * Named either as a pseudo-class (`hover`, `focus-visible`, `disabled`) or
   * as a data-attribute state (`open`, `highlighted`). The contract test
   * fails when a listed state has no matching rule in the stylesheet.
   */
  states: readonly string[];
};

/**
 * Identity function that gives the contract a precise literal type without
 * requiring `as const` at every call site. `buttonContract.props.variant`
 * becomes `readonly ['primary', …]`, so the component's variant type is a
 * string-literal union, not `string`.
 */
export function defineContract<const T extends ComponentContract>(contract: T): T {
  return contract;
}
