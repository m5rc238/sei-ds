/**
 * No component hardcodes design values — ported from the original CDP verification harness §5
 * and extended to every sei component surface.
 *
 * The scan runs against the stylesheets the browser actually loads for a
 * story, so it proves what ships, not what the source looks like. Raw var()
 * values are the mechanism tokens use; tokens.css is excluded by selector
 * (it is :root, not a component rule) because raw values are its job.
 *
 * Structural exceptions, with reasons:
 *   - border-collapse / border-spacing: table layout mechanics, not a
 *     visual decision any token could express;
 *   - transparent / none / 0: the absence of a value;
 *   - relative height/width (%, auto, fr): "fill the space you are given".
 */

import { expect, test } from '@playwright/test';
import { gotoStory } from './helpers';

const COMPONENT_SELECTORS = [
  '.sei-button',
  '.sei-input',
  '.sei-card',
  '.sei-form',
  '.sei-settings',
  '.sei-checkbox',
  '.sei-select',
  '.sei-dialog',
  '.sei-menu',
  '.sei-tabs',
  '.sei-tooltip',
  '.sei-table',
  '.sei-composition',
];

interface Offender {
  selector: string;
  prop: string;
  value: string;
}

async function scanRawDesignValues(page: import('@playwright/test').Page): Promise<Offender[]> {
  return page.evaluate((componentSelectors) => {
    const found: Offender[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (!componentSelectors.some((s) => rule.selectorText.includes(s))) continue;
        for (const prop of Array.from(rule.style)) {
          const value = rule.style.getPropertyValue(prop);
          if (value.trim() === '') continue;
          if (value.includes('var(')) continue;

          const isDesignValue =
            /color|background|border|outline|shadow|radius|height|width|font|line-height|opacity|transition|animation/.test(
              prop,
            );
          if (!isDesignValue) continue;
          if (value.trim() === 'transparent' || value.trim() === 'none') continue;
          if (value.trim() === '0') continue;
          if (/(height|width)$/.test(prop) && /%|auto|fr$|^0$/.test(value.trim())) continue;
          if (prop === 'border-collapse' || prop === 'border-spacing') continue;

          found.push({ selector: rule.selectorText, prop, value });
        }
      }
    }
    return found;
  }, COMPONENT_SELECTORS);
}

test('no raw design values in component CSS — tokens only', async ({ page }) => {
  await gotoStory(page, 'compositions-settingspanel--default');
  const offenders = await scanRawDesignValues(page);
  expect(
    offenders,
    offenders.length === 0
      ? 'no raw design values in component rules'
      : `raw design values found:\n${offenders
          .slice(0, 8)
          .map((o) => `${o.selector} { ${o.prop}: ${o.value} }`)
          .join('\n')}`,
  ).toEqual([]);
});
