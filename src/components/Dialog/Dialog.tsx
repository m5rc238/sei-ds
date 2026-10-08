import type { ReactElement, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '../Button/Button';
import './Dialog.css';

export interface DialogProps {
  /** Accessible dialog title. Rendered as the real <h2> inside the panel —
   * Radix requires a Title for aria-labelledby, so it is not optional. */
  title: string;
  /** Optional description, wired to aria-describedby. */
  description?: string;
  /** The element that opens the dialog. Must be a single element (it is
   * rendered through Radix's asChild, so it receives the trigger props). */
  trigger: ReactElement;
  /** Dialog body content. */
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Fires when open state changes (open or close). */
  onOpenChange?: (open: boolean) => void;
}

/**
 * A modal dialog built on Radix: focus is trapped while open, Escape closes,
 * the rest of the page gets `aria-hidden` via the modal overlay, and focus
 * returns to the trigger on close. Sei supplies the panel surface, the
 * overlay scrim and the close affordance — the behaviour is the primitive's.
 */
export function Dialog({ title, description, trigger, children, open, onOpenChange }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sei-dialog__overlay" />
        <DialogPrimitive.Content className="sei-dialog">
          <DialogPrimitive.Title className="sei-dialog__title">{title}</DialogPrimitive.Title>

          {description ? (
            <DialogPrimitive.Description className="sei-dialog__description">
              {description}
            </DialogPrimitive.Description>
          ) : (
            // Radix warns (and screen readers get nothing) when a dialog has no
            // Description. When the caller passes none, the hidden fallback
            // still satisfies aria-describedby without showing duplicate text.
            <DialogPrimitive.Description className="sei-dialog__description" style={{ display: 'none' }}>
              {title}
            </DialogPrimitive.Description>
          )}

          <div className="sei-dialog__body">{children}</div>

          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="sm" className="sei-dialog__close">
              Close
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
