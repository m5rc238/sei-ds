import { defineContract } from './types';

/**
 * Select contract.
 *
 * A single-choice picker, not a variant axis: the options are data the caller
 * passes, not styles. The four states are the ones the stylesheet branches on —
 * `open` (Radix `[data-state='open']` on trigger and popup), `highlighted`
 * (`[data-highlighted]` on the option under the cursor), `hover` and
 * `disabled` (the trigger is a real `<button>`, so `:hover` and `:disabled`
 * are the platform's).
 *
 * Native `<select>` cannot be styled per-option (the popup is OS-rendered),
 * which is why this component wraps Radix instead — see docs/decisions.md.
 */
export const selectContract = defineContract({
  name: 'Select',
  rootClass: 'sei-select',
  foundation: '@radix-ui/react-select — listbox semantics, type-ahead, Escape, aria-activedescendant',
  states: ['open', 'highlighted', 'hover', 'disabled'],
});
