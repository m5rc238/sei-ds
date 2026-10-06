import { defineContract } from './types';

/**
 * Card contract.
 *
 * Presentational: no value axes, no interaction states. `bare` removes the
 * card's own padding and gap for compositions that lay out their own inner
 * structure — a layout decision, not a visual variant.
 */
export const cardContract = defineContract({
  name: 'Card',
  rootClass: 'sei-card',
  foundation: 'none — presentational surface, no behavior',
  modifiers: ['bare'],
  states: [],
});
