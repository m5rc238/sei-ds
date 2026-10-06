import { defineContract } from './types';

/**
 * Dropdown menu contract.
 *
 * `open` and `highlighted` are Radix's data-attribute states on the content
 * and the focused item; `disabled` is `[data-disabled]` on an item (menu
 * items are not focusable natives, so `:disabled` does not exist there —
 * the primitive sets aria-disabled and the attribute together).
 * Keyboard navigation (arrows, Home/End, type-ahead, Escape) is the
 * primitive's job, stated in `foundation`.
 */
export const dropdownMenuContract = defineContract({
  name: 'DropdownMenu',
  rootClass: 'sei-menu',
  foundation: '@radix-ui/react-dropdown-menu — roving focus, type-ahead, Escape, outside-click',
  states: ['open', 'highlighted', 'disabled'],
});
