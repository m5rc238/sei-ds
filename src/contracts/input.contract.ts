import { defineContract } from './types';

/**
 * Input contract.
 *
 * One value axis-free control: label is required, hint and error are mutually
 * exclusive messages (the component drops the hint when an error shows, so
 * aria-describedby never points at hidden text). `error` is a modifier, not a
 * variant — it is a truthiness switch, and it reuses the destructive colour
 * role so an error and a destructive action cannot drift apart.
 */
export const inputContract = defineContract({
  name: 'Input',
  rootClass: 'sei-input',
  foundation: 'native <input> — label, description and invalid state are wired by Sei',
  modifiers: ['error'],
  states: ['hover', 'focus-visible', 'disabled'],
});
