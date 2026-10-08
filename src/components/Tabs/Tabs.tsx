import type { ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import './Tabs.css';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** The tabs, in display order. Each item owns its panel content. */
  items: TabItem[];
  /** Accessible name for the tab list. Required: an unnamed tablist is an
   * accessibility failure no styling can rescue. */
  label: string;
  /** Initially selected tab value (uncontrolled). Defaults to the first item. */
  defaultValue?: string;
  /** Selected tab value (controlled). */
  value?: string;
  /** Fires when selection changes. */
  onValueChange?: (value: string) => void;
}

/**
 * Tabs built on Radix: arrow keys move between tabs, Home/End jump to the
 * ends, and each trigger is wired to its panel with the right aria attributes.
 * Sei owns only the visual layer — the active indicator is the
 * `[data-state="active"]` style in Tabs.css.
 */
export function Tabs({ items, label, defaultValue, value, onValueChange }: TabsProps) {
  const initial = defaultValue ?? items[0]?.value;

  return (
    <TabsPrimitive.Root
      className="sei-tabs"
      defaultValue={initial}
      value={value}
      onValueChange={onValueChange}
    >
      <TabsPrimitive.List className="sei-tabs__list" aria-label={label}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            className="sei-tabs__trigger"
            value={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} className="sei-tabs__panel" value={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
