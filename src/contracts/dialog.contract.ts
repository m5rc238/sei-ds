import { defineContract } from './types';

/**
 * Dialog contract.
 *
 * One state: `open`. Radix carries it as `[data-state='open']` on the overlay
 * and the panel; when the dialog is closed the content is unmounted, so
 * there is no "closed" appearance to style. Focus trapping, Escape, the
 * aria wiring and the scroll lock belong to the primitive (foundation).
 */
export const dialogContract = defineContract({
  name: 'Dialog',
  rootClass: 'sei-dialog',
  foundation: '@radix-ui/react-dialog — focus trap, Escape, aria wiring and scroll lock',
  states: ['open'],
});
