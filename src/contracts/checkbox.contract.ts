import { defineContract } from './types';

/**
 * Checkbox contract.
 *
 * A native `<input type="checkbox">` wearing a styled box. The platform owns
 * checked semantics, keyboard toggling, focus and disabled — Sei only paints
 * it. No value axes, no modifier classes: checked/unchecked are properties of
 * the element, not variants of the component.
 */
export const checkboxContract = defineContract({
  name: 'Checkbox',
  rootClass: 'sei-checkbox',
  foundation: 'native <input type="checkbox"> — platform owns checked state, focus and disabled',
  states: ['hover', 'focus-visible', 'disabled'],
});
