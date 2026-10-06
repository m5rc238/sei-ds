/**
 * Token-sharing experiments — ported from the original CDP verification harness §§2–4.
 *
 * These are the design system's central claim made falsifiable: override one
 * token on the Playground and the change must reach every component that
 * reads it, and must NOT reach components that read a different token.
 */

import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

test.describe('Experiment A: --button-height-md', () => {
  test('changing the token changes Button height', async ({ page }) => {
    await gotoStory(page, 'compositions-settingspanel--default');
    const before = await page.evaluate(
      () => getComputedStyle(document.querySelector('.sei-button--md')!).height,
    );

    await gotoStory(page, 'design-system-playground--tall-buttons');
    const after = await page.evaluate(
      () => getComputedStyle(document.querySelector('.sei-button--md')!).height,
    );

    expect(after).not.toBe(before);
    expect(after).toBe('48px');
  });

  test('the override reaches size=md buttons inside both compositions', async ({ page }) => {
    await gotoStory(page, 'design-system-playground--tall-buttons');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const heights = Array.from(
            document.querySelectorAll('[data-sei-scope] .sei-composition .sei-button--md'),
            (b) => getComputedStyle(b).height,
          );
          return heights.length > 0 && heights.every((h) => h === '48px');
        }),
      )
      .toBe(true);
  });

  test('size=sm buttons are unaffected — they read their own token', async ({ page }) => {
    await gotoStory(page, 'design-system-playground--tall-buttons');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const heights = Array.from(
            document.querySelectorAll('[data-sei-scope] .sei-composition .sei-button--sm'),
            (b) => getComputedStyle(b).height,
          );
          return heights.length > 0 && heights.every((h) => h === '32px');
        }),
      )
      .toBe(true);
  });
});

test.describe('Experiment B: --radius-md', () => {
  test('Button and Input radii move together, Card stays put', async ({ page }) => {
    const radii = () =>
      page.evaluate(() => ({
        button: getComputedStyle(document.querySelector('.sei-button--md')!).borderRadius,
        input: getComputedStyle(document.querySelector('.sei-input')!).borderRadius,
        card: getComputedStyle(document.querySelector('.sei-card')!).borderRadius,
      }));

    await gotoStory(page, 'compositions-settingspanel--default');
    const before = await radii();

    await gotoStory(page, 'design-system-playground--large-radius');
    const after = await radii();

    // Button and Input share the primitive; the override moves both.
    expect(after.button).not.toBe(before.button);
    expect(after.input).not.toBe(before.input);
    // Card derives from --radius-lg, a different decision.
    expect(after.card).toBe(before.card);
  });
});

test.describe('Experiment C: --color-action', () => {
  test('primary buttons take the new colour, destructive keeps its own', async ({ page }) => {
    await gotoStory(page, 'design-system-playground--brand-action');

    const colours = await page.evaluate(() => {
      const scoped = document.querySelectorAll('[data-sei-scope] .sei-composition');
      const collect = (selector: string): string[] =>
        Array.from(scoped).flatMap((c) =>
          Array.from(c.querySelectorAll(selector), (b) => getComputedStyle(b).backgroundColor),
        );
      return {
        primary: collect('.sei-button--primary'),
        destructive: collect('.sei-button--destructive'),
      };
    });

    expect(colours.primary.length).toBeGreaterThan(0);
    expect(new Set(colours.primary)).toEqual(new Set(['rgb(124, 58, 237)']));

    expect(colours.destructive.length).toBeGreaterThan(0);
    expect(new Set(colours.destructive)).toEqual(new Set(['rgb(220, 38, 38)']));
  });
});
