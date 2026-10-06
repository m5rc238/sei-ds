import type { ButtonHTMLAttributes } from 'react';
import { buttonContract } from '../../contracts/button.contract';
import type { ButtonVariant, ButtonSize } from '../../contracts/button.contract';
import './Button.css';

export { buttonContract };
export type { ButtonVariant, ButtonSize };

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