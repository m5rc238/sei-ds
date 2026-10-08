import type { ReactElement, ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import './Tooltip.css';

export interface TooltipProps {
  /** The tooltip text. Announced through aria-describedby, never as the
   * trigger's accessible name. */
  content: ReactNode;
  /** The element the tooltip describes. Must be focusable — a tooltip that
   * cannot be reached by keyboard is a tooltip that does not exist for
   * part of your users. */
  children: ReactElement;
}

/**
 * A tooltip built on Radix. Opens on hover *and* on focus, closes on Escape
 * or pointer-leave, and wires aria-describedby between trigger and content.
 * Each instance provides its own Tooltip.Provider, so callers never have to
 * remember one.
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="sei-tooltip" sideOffset={6}>
            {content}
            <TooltipPrimitive.Arrow className="sei-tooltip__arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
