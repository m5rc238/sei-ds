/**
 * Accessibility — ported from the original CDP verification harness §6, plus axe scans.
 *
 * The explicit checks keep the original harness's named assertions (they
 * fail with a specific reason an axe violation summary would not). The axe
 * scans run with WCAG A/AA tags only: best-practice rules like `region`
 * judge a page as a whole, and a story canvas is not a page — landmarks
 * are the consuming application's responsibility.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

test.describe('AccountForm', () => {
  test('controls are native, named and labelled; ids are unique', async ({ page }) => {
    await gotoStory(page, 'compositions-accountform--default');

    const a11y = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const inputs = Array.from(document.querySelectorAll('input'));
      const unlabelled = inputs.filter((input) => {
        if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
        if (input.id && document.querySelector(`label[for="${input.id}"]`)) return false;
        return !input.closest('label');
      });
      const seen = new Set<string>();
      let duplicateIds = 0;
      for (const el of Array.from(document.querySelectorAll('[id]'))) {
        if (seen.has(el.id)) duplicateIds++;
        seen.add(el.id);
      }
      return {
        buttonCount: buttons.length,
        allButtonsNative: buttons.every((b) => b.tagName === 'BUTTON'),
        buttonsHaveName: buttons.every(
          (b) => (b.textContent ?? '').trim().length > 0 || b.getAttribute('aria-label'),
        ),
        inputCount: inputs.length,
        unlabelledInputs: unlabelled.length,
        duplicateIds,
      };
    });

    expect(a11y.buttonCount, 'form has buttons').toBeGreaterThan(0);
    expect(a11y.allButtonsNative, 'every control is a native <button>').toBe(true);
    expect(a11y.buttonsHaveName, 'every button has an accessible name').toBe(true);
    expect(a11y.unlabelledInputs, `${a11y.inputCount} inputs, all labelled`).toBe(0);
    expect(a11y.duplicateIds, 'no duplicate element ids').toBe(0);
  });
});

test.describe('Input error state', () => {
  test('aria-invalid is set and aria-describedby resolves', async ({ page }) => {
    await gotoStory(page, 'components-input--with-error');
    const input = page.locator('.sei-input').first();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = await input.getAttribute('aria-describedby');
    expect(describedBy, 'error input is described by something').toBeTruthy();

    // Read every referenced node: a dangling id in the list is the bug this
    // check exists to catch, and the first id alone would hide it.
    const resolution = await page.evaluate((ids) => {
      const parts = ids.split(/\s+/).filter(Boolean);
      return {
        texts: parts
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .filter(Boolean)
          .join(' | '),
        dangling: parts.filter((id) => !document.getElementById(id)),
      };
    }, describedBy!);

    expect(resolution.dangling, 'every id in aria-describedby exists').toEqual([]);
    expect(resolution.texts, 'the error message is associated').not.toBe('');
  });
});

const axeStories = [
  'compositions-accountform--default',
  'compositions-settingspanel--default',
  'components-button--primary',
  'components-input--default',
  'components-card--default',
  'components-checkbox--unchecked',
  'components-select--default',
  'components-tabs--default',
  'components-table--default',
  'components-dropdownmenu--default',
  'components-tooltip--default',
];

for (const id of axeStories) {
  test(`axe: ${id} has no WCAG A/AA violations`, async ({ page }) => {
    await gotoStory(page, id);
    const results = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      results.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.replace(/\s+/g, ' ') ?? ''}`)
            .join(' | ')}`,
      ),
    ).toEqual([]);
  });
}
