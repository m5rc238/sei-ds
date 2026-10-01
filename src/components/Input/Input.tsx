import { useId, type InputHTMLAttributes } from 'react';
import './Input.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label. Rendered as a real <label> bound to the input. */
  label: string;
  /** Optional helper text, associated via aria-describedby. */
  hint?: string;
  /** Error text. Sets aria-invalid and switches to the error colour role. */
  error?: string;
}

/**
 * A labelled text input. The label is always rendered and always associated —
 * placeholder text is never used as the label, because placeholders disappear
 * on focus and are not reliably announced.
 */
export function Input({ label, hint, error, className, ...rest }: InputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // The hint is not rendered when there is an error, so it must not be
  // referenced here either — an aria-describedby pointing at a missing id is
  // worse than no description at all.
  const showHint = !!hint && !error;
  const describedBy = [showHint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  const classes = ['sei-input', error ? 'sei-input--error' : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="sei-input__field">
      <label className="sei-input__label" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />

      {showHint ? (
        <p className="sei-input__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className="sei-input__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}