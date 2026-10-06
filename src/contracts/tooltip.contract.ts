import { defineContract } from './types';

/**
 * Tooltip contract.
 *
 * Deliberately no states. Radix's content carries
 * `[data-state='delayed-open'|'instant-open'|'closed']` — three values that
 * differ in *timing*, not in appearance — and the content unmounts when
 * closed, so the stylesheet has exactly one appearance and nothing to branch
 * on. A state list would have to lie about what the CSS does. The open
 * behavior is still demonstrated by the story's play function.
 */
export const tooltipContract = defineContract({
  name: 'Tooltip',
  rootClass: 'sei-tooltip',
  foundation: '@radix-ui/react-tooltip — hover/focus open, delay, Escape, aria-describedby wiring',
  states: [],
});
