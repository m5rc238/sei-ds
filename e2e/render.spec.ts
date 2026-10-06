/**
 * Every listed story must actually render its component. Ported from
 * the original CDP verification harness §1, extended with the primitive components.
 */

import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

const renderChecks: [id: string, selector: string, label: string][] = [
  ['components-button--primary', '.sei-button--primary', 'Button / Primary'],
  ['components-button--destructive', '.sei-button--destructive', 'Button / Destructive'],
  ['components-input--default', '.sei-input', 'Input / Default'],
  ['components-card--default', '.sei-card', 'Card / Default'],
  ['components-checkbox--unchecked', '.sei-checkbox', 'Checkbox / Default'],
  ['components-select--default', '.sei-select', 'Select / Default'],
  ['components-tabs--default', '.sei-tabs', 'Tabs / Default'],
  ['components-table--default', '.sei-table', 'Table / Default'],
  ['components-dialog--default', '.sei-button--destructive', 'Dialog / Default (trigger)'],
  // The menu and tooltip content is portaled and unmounted when closed, so
  // the closed story can only be verified by its Radix trigger (data-state).
  ['components-dropdownmenu--default', 'button[data-state="closed"]', 'DropdownMenu / Default (trigger)'],
  ['components-tooltip--default', 'button[data-state="closed"]', 'Tooltip / Default (trigger)'],
  ['compositions-settingspanel--default', '.sei-card', 'SettingsPanel'],
  ['compositions-accountform--default', '.sei-card', 'AccountForm'],
  ['design-system-playground--playground', '.sei-button', 'Playground'],
  ['design-system-explorer--explorer', '.react-flow__node', 'Graph Explorer'],
];

for (const [id, selector, label] of renderChecks) {
  test(`renders: ${label}`, async ({ page }) => {
    await gotoStory(page, id);
    // Auto-retrying: stories that load asynchronously (the Explorer fetches
    // the graph) render their first element after gotoStory returns.
    await expect(page.locator(selector).first(), `expected at least one ${selector}`).toBeAttached();
  });
}
