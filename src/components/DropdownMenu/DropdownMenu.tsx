import type { ReactElement } from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import './DropdownMenu.css';

export interface DropdownMenuItem {
  value: string;
  label: string;
  disabled?: boolean;
  /** Runs when the item is chosen. The menu closes itself afterwards —
   * callers should not have to do that bookkeeping. */
  onSelect?: () => void;
}

export interface DropdownMenuProps {
  /** The element that opens the menu (single element, rendered via asChild). */
  trigger: ReactElement;
  /** Menu items in display order. */
  items: DropdownMenuItem[];
  /** Optional group label rendered above the items. */
  label?: string;
  /** Fires with the chosen item's value after onSelect runs. */
  onValueChange?: (value: string) => void;
}

/**
 * A menu of actions built on Radix. Arrow keys and type-ahead move the
 * highlight, Escape and outside-click close, and every item announces its
 * role through the primitive's aria wiring. Sei styles the surface, the
 * highlighted row ([data-highlighted]) and the disabled row ([data-disabled]).
 */
export function DropdownMenu({ trigger, items, label, onValueChange }: DropdownMenuProps) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>

      <MenuPrimitive.Portal>
        <MenuPrimitive.Content className="sei-menu" sideOffset={4}>
          {label ? (
            <MenuPrimitive.Label className="sei-menu__label">{label}</MenuPrimitive.Label>
          ) : null}

          {items.map((item) => (
            <MenuPrimitive.Item
              key={item.value}
              className="sei-menu__item"
              disabled={item.disabled}
              onSelect={() => {
                item.onSelect?.();
                onValueChange?.(item.value);
              }}
            >
              {item.label}
            </MenuPrimitive.Item>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
