import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

export { cardContract } from '../../contracts/card.contract';

// `title` is omitted from the DOM attributes because a Card's title is content
// (ReactNode, rendered as an <h3>), not the HTML `title` tooltip attribute.
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional heading rendered as a real <h3> inside the card. */
  title?: ReactNode;
  /** Optional supporting line under the title. */
  description?: ReactNode;
  /** Optional actions area, typically Buttons. */
  footer?: ReactNode;
  /** Removes the default inner padding when the card manages its own layout. */
  bare?: boolean;
}

/**
 * A surface with a title. Compositions compose Cards with Inputs and Buttons;
 * Card itself owns no state and no behaviour.
 */
export function Card({
  title,
  description,
  footer,
  bare = false,
  children,
  className,
  ...rest
}: CardProps) {
  const classes = ['sei-card', bare ? 'sei-card--bare' : null, className]
    .filter(Boolean)
    .join(' ');

  const hasHeader = title !== undefined || description !== undefined;

  return (
    <div className={classes} {...rest}>
      {hasHeader ? (
        <div className="sei-card__header">
          {title ? <h3 className="sei-card__title">{title}</h3> : null}
          {description ? <p className="sei-card__description">{description}</p> : null}
        </div>
      ) : null}

      {children !== undefined && children !== null ? (
        <div className="sei-card__body">{children}</div>
      ) : null}

      {footer ? <div className="sei-card__footer">{footer}</div> : null}
    </div>
  );
}