/**
 * Behaviour — ported from the original CDP verification harness §7: a destructive action never
 * executes on the first click. The story canvas implements the confirmation
 * in-place, so this exercises the composition pattern, not the primitive.
 */

import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

test('a destructive action requires an explicit second click', async ({ page }) => {
  await gotoStory(page, 'compositions-accountform--default');

  const destructive = page.locator('.sei-button--destructive').first();
  await expect(destructive).toHaveText('Delete account');

  await destructive.click();

  // One click arms the action; it does not perform it. The original button
  // is swapped out for the confirmation pair (which includes another
  // destructive-variant button — the class is not what identifies it).
  await expect(page.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep account' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Delete account' }),
    'the first button is replaced by the confirmation',
  ).toHaveCount(0);
});
