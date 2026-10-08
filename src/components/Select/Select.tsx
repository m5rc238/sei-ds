import { useId } from 'react';
import type { ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  /** Skips the option in keyboard navigation and dims it. */
  disabled?: boolean;
}

export interface SelectProps {
  /** Visible label. Rendered as a real <label> bound to the trigger. */
  label: string;
  /** The options, in display order. */
  options: SelectOption[];
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Selected value (controlled). */
  value?: string;
  /** Initially selected value (uncontrolled). */
  defaultValue?: string;
  /** Fires when the selection changes. */
  onValueChange?: (value: string) => void;
  /** Disables the trigger. */
  disabled?: boolean;
}

/** Chevron for the trigger — inline SVG, no icon font. */
function ChevronIcon(): ReactNode {
  return (
    <svg
      className="sei-select__chevron"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Check mark for the selected option. */
function CheckIcon(): ReactNode {
  return (
    <svg
      className="sei-select__check"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8.5l3.5 3.5L13 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A single-select listbox built on Radix. The trigger is a real button with a
 * bound label; the popup is a listbox with type-ahead, Home/End and Escape.
 * Its height, padding, radius and font-size derive from the input tokens at
 * the point of use, so a Select and an Input stay aligned by construction.
 */
export function Select({
  label,
  options,
  placeholder = 'Select…',
  value,
  defaultValue,
  onValueChange,
  disabled,
}: SelectProps) {
  const id = useId();

  return (
    <div className="sei-select">
      <label className="sei-select__label" htmlFor={id}>
        {label}
      </label>

      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger className="sei-select__trigger" id={id}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="sei-select__content" position="popper" sideOffset={4}>
            <SelectPrimitive.Viewport className="sei-select__viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  className="sei-select__item"
                  value={option.value}
                  disabled={option.disabled}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="sei-select__indicator">
                    <CheckIcon />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
