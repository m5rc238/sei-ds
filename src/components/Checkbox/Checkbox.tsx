import type { InputHTMLAttributes } from 'react';
import { checkboxContract } from '../../contracts/checkbox.contract';
import './Checkbox.css';

export { checkboxContract };

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label. The <label> element wraps both the input and the text, so
   * clicking the text toggles the box without any id wiring from us. */
  label: string;
}

/**
 * A checkbox whose box is the real input — no visually-hidden proxy element,
 * no div pretending to be a control. `:checked`, `:focus-visible` and
 * `:disabled` come from the platform; the CSS only paints them.
 */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  const classes = ['sei-checkbox__input', className].filter(Boolean).join(' ');

  return (
    <label className="sei-checkbox">
      <span className="sei-checkbox__box">
        <input type="checkbox" className={classes} {...rest} />
        <svg
          className="sei-checkbox__check"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="sei-checkbox__label">{label}</span>
    </label>
  );
}
