/**
 * Keyboard — ported from the original CDP verification harness §8 (real Tab traversal of a
 * composition) plus the primitive interaction flows that justify using
 * Radix in the first place: focus return, arrow-key movement, Escape.
 *
 * Focus is moved with genuine key presses (page.keyboard), never synthesised
 * events — a synthetic KeyboardEvent does not move focus and would prove
 * nothing.
 */

import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

const FOCUSABLE =
  '#storybook-root a[href], #storybook-root button:not([disabled]), #storybook-root input:not([disabled]), #storybook-root select:not([disabled]), #storybook-root textarea:not([disabled]), #storybook-root [tabindex]:not([tabindex="-1"])';

test('every interactive element in the composition is reachable by Tab', async ({ page }) => {
  await gotoStory(page, 'compositions-settingspanel--default');

  const focusable = await page.locator(FOCUSABLE).count();
  expect(focusable, 'the story has focusable content').toBeGreaterThan(0);

  // Identify elements by a stable per-element key, not by class, so two
  // Buttons of the same variant count as two distinct stops.
  const visited = new Set<string>();
  // Enough steps to walk the order several times over: Tab eventually
  // escapes the story and wraps back around.
  for (let i = 0; i < focusable * 3 + 10; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate((sel) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || !el.matches(sel)) return null;
      if (!el.dataset.e2eId) {
        el.dataset.e2eId = `v${Math.random().toString(36).slice(2, 9)}`;
      }
      return el.dataset.e2eId;
    }, FOCUSABLE);
    if (active) visited.add(active);
  }

  expect(visited.size, `${focusable} focusable, ${visited.size} reached by Tab`).toBe(focusable);
});

test('Dialog: opens, traps focus, Escape closes and returns focus to the trigger', async ({
  page,
}) => {
  await gotoStory(page, 'components-dialog--default');
  const trigger = page.getByRole('button', { name: 'Delete project' });

  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const focusInside = await page.evaluate(
    () => !!document.activeElement?.closest('[role="dialog"]'),
  );
  expect(focusInside, 'focus moves into the dialog').toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await expect
    .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
    .toBe('Delete project');
});

test('DropdownMenu: arrow keys move the highlight, Escape closes and returns focus', async ({
  page,
}) => {
  await gotoStory(page, 'components-dropdownmenu--default');
  const trigger = page.getByRole('button', { name: 'Actions' });

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  // Focus lands on the menu itself on open; the first ArrowDown highlights
  // the first enabled item (disabled items are skipped), the next moves on.
  const highlighted = menu.locator('[data-highlighted]');
  await page.keyboard.press('ArrowDown');
  await expect(highlighted).toHaveText('Duplicate');
  await page.keyboard.press('ArrowDown');
  await expect(highlighted).toHaveText('Rename');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Select: opens, listbox semantics, Enter selects the highlighted option', async ({
  page,
}) => {
  await gotoStory(page, 'components-select--default');
  const trigger = page.getByRole('combobox');
  await expect(trigger).toHaveText(/Choose a region/);

  await trigger.click();
  await expect(page.getByRole('listbox')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(trigger).toHaveText(/Genesis/);
  await expect(trigger).toBeFocused();
});

test('Tabs: ArrowRight moves selection between tabs', async ({ page }) => {
  await gotoStory(page, 'components-tabs--default');
  const general = page.getByRole('tab', { name: 'General' });
  const security = page.getByRole('tab', { name: 'Security' });

  await expect(general).toHaveAttribute('aria-selected', 'true');
  await general.focus();
  await page.keyboard.press('ArrowRight');

  await expect(security).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Password, two-factor authentication')).toBeVisible();
});

test('Tooltip: opens on focus and is wired by aria-describedby', async ({ page }) => {
  await gotoStory(page, 'components-tooltip--default');
  const trigger = page.getByRole('button', { name: 'Hover me' });

  await trigger.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();

  const describedBy = await trigger.getAttribute('aria-describedby');
  expect(describedBy, 'trigger describes the tooltip').toBeTruthy();
  await expect(page.locator(`#${describedBy!.split(' ')[0]}`)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
});
