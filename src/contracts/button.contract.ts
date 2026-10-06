import { defineContract } from './types';

/**
 * Button contract.
 *
 * Four variants, each with a named semantic purpose — the variant axis is
 * not a style picker:
 *
 *   primary     — the one affirmative action on a screen; --color-action
 *   secondary   — a real alternative that should not shout; surface roles
 *   destructive — irreversible action; --color-destructive, never action
 *   ghost       — low-emphasis action; no chrome until hovered
 *
 * Sizes are a scale, not free values. States are the pseudo-states the
 * stylesheet must style; the contract test enforces that.
 */
export const buttonContract = defineContract({
  name: 'Button',
  rootClass: 'sei-button',
  foundation: 'native <button> — platform owns activation, focus and disabled semantics',
  props: {
    variant: ['primary', 'secondary', 'destructive', 'ghost'],
    size: ['sm', 'md', 'lg'],
  },
  states: ['hover', 'focus-visible', 'active', 'disabled'],
});

export type ButtonVariant = (typeof buttonContract)['props']['variant'][number];
export type ButtonSize = (typeof buttonContract)['props']['size'][number];
