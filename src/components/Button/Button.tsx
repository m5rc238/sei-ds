import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

/**
 * Button API surface.
 *
 * Four variants, each with a named semantic purpose — the variant axis is
 * not a style picker:
 *
 *   primary     — the one affirmative action on a screen; --color-action
 *   secondary   — a real alternative that should not shout; surface roles
 *   destructive — irreversible action; --color-destructive, never action
 *   ghost       — low-emphasis action; no chrome until hovered
 *
 * Sizes are a scale, not free values.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual role. Decides which semantic colour tokens apply. */
  variant?: ButtonVariant;
  /** Height and padding scale. */
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  // A real <button> throughout: native keyboard activation, focusability and
  // disabled semantics come from the platform, not from us.
  const classes = ['sei-button', `sei-button--${variant}`, `sei-button--${size}`];
  if (className) classes.push(className);

  return <button type={type} className={classes.join(' ')} {...rest} />;
}