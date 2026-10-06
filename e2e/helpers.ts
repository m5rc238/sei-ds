import type { Page } from '@playwright/test';

/** Storybook iframe URL — the story canvas without the manager chrome, so
 *  every locator and axe scan sees only the story under test. */
export function storyUrl(id: string): string {
  return `/iframe.html?id=${id}&viewMode=story`;
}

/** Navigate to a story and wait for it to render. Assertions afterwards are
 *  Playwright's auto-retrying ones, so no artificial settle delay. */
export async function gotoStory(page: Page, id: string): Promise<void> {
  await page.goto(storyUrl(id));
  await page.waitForFunction(() =>
    document.readyState === 'complete' &&
    !!document.querySelector('#storybook-root *') &&
    !document.querySelector('#loader-container'),
  );
}
