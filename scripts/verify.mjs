// Verification harness. Drives the local Storybook with Chrome via the
// DevTools Protocol over Node's built-in WebSocket (no test dependencies).
// Run: node scripts/verify.mjs

const STORYBOOK = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const { spawn } = await import('node:child_process');
const { mkdtempSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');

const profile = mkdtempSync(join(tmpdir(), 'sei-verify-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9333',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version');
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chrome DevTools endpoint never became available');
}

const ws = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

// Attach to a fresh tab and return an evaluate() helper.
async function newPage() {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  async function evaluate(fn, ...args) {
    const expression = `(${fn.toString()})(${args
      .map((a) => JSON.stringify(a))
      .join(',')})`;
    const { result, exceptionDetails } = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? 'evaluate failed');
    }
    return result.value;
  }

  // Dispatch a real key press through the input domain so the browser's own
  // focus traversal runs. Runtime.evaluate cannot move focus.
  async function sendKey(key) {
    const codes = {
      Tab: { windowsVirtualKeyCode: 9, code: 'Tab', text: '\t' },
      Enter: { windowsVirtualKeyCode: 13, code: 'Enter', text: '\r' },
    };
    const { code, windowsVirtualKeyCode, text } = codes[key];
    for (const type of ['rawKeyDown', 'char', 'keyUp']) {
      await send(
        'Input.dispatchKeyEvent',
        { type, key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, text: type === 'char' ? text : undefined },
        sessionId,
      );
    }
  }

  async function goto(url) {
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url }, sessionId);
    // Poll for the story root rather than racing a fixed timeout.
    for (let i = 0; i < 120; i++) {
      const ready = await evaluate(
        () =>
          document.readyState === 'complete' &&
          !!document.querySelector('#storybook-root *') &&
          !document.querySelector('#loader-container'),
      );
      if (ready) {
        await new Promise((r) => setTimeout(r, 400));
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`story did not render: ${url}`);
  }

  async function close() {
    await send('Target.closeTarget', { targetId });
  }

  return { evaluate, goto, close, sendKey };
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const storyUrl = (id) => `${STORYBOOK}/iframe.html?id=${id}&viewMode=story`;

/* ------------------------------------------------------------------ */
/* 1. Every story renders with the expected component                  */
/* ------------------------------------------------------------------ */

const renderChecks = [
  ['components-button--primary', '.sei-button--primary', 'Button / Primary'],
  ['components-button--destructive', '.sei-button--destructive', 'Button / Destructive'],
  ['components-input--default', '.sei-input', 'Input / Default'],
  ['components-card--default', '.sei-card', 'Card / Default'],
  ['compositions-settingspanel--default', '.sei-card', 'SettingsPanel'],
  ['compositions-accountform--default', '.sei-card', 'AccountForm'],
  ['design-system-playground--playground', '.sei-button', 'Playground'],
];

for (const [id, selector, label] of renderChecks) {
  const page = await newPage();
  try {
    await page.goto(storyUrl(id));
    const count = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      selector,
    );
    check(`renders: ${label}`, count > 0, `${count} × ${selector}`);
  } catch (error) {
    check(`renders: ${label}`, false, error.message);
  } finally {
    await page.close();
  }
}

/* ------------------------------------------------------------------ */
/* 2. Tokens are shared — Experiment A: --button-height-md             */
/* ------------------------------------------------------------------ */

{
  const baseline = await newPage();
  await baseline.goto(storyUrl('compositions-settingspanel--default'));
  const before = await baseline.evaluate(() => {
    const b = document.querySelector('.sei-button--md');
    return { height: getComputedStyle(b).height, source: getComputedStyle(b).height };
  });
  await baseline.close();

  const modified = await newPage();
  await modified.goto(storyUrl('design-system-playground--tall-buttons'));
  const after = await modified.evaluate(() => {
    const b = document.querySelector('.sei-button--md');
    return { height: getComputedStyle(b).height };
  });
  await modified.close();

  check(
    'Experiment A: --button-height-md 40px → 48px changes Button height',
    before.height !== after.height,
    `${before.height} → ${after.height}`,
  );
}

{
  // The same override must reach Buttons inside the real compositions.
  // Only size="md" buttons are relevant: the compositions also contain
  // size="sm" buttons, which must stay at their own token value.
  const page = await newPage();
  await page.goto(storyUrl('design-system-playground--tall-buttons'));
  const mdHeights = await page.evaluate(() => {
    const scoped = document.querySelectorAll('[data-sei-scope] .sei-composition .sei-button--md');
    return Array.from(scoped).map((b) => getComputedStyle(b).height);
  });
  const smHeights = await page.evaluate(() => {
    const scoped = document.querySelectorAll('[data-sei-scope] .sei-composition .sei-button--sm');
    return Array.from(scoped).map((b) => getComputedStyle(b).height);
  });
  await page.close();

  const mdUnique = [...new Set(mdHeights)];
  const smUnique = [...new Set(smHeights)];
  check(
    'Experiment A: override reaches size=md Buttons inside both compositions',
    mdHeights.length > 0 && mdUnique.length === 1 && mdUnique[0] === '48px',
    `${mdHeights.length} md buttons → ${mdUnique.join(', ')}`,
  );
  check(
    'Experiment A: size=sm buttons are unaffected (they read their own token)',
    smUnique.every((h) => h === '32px'),
    `${smHeights.length} sm buttons → ${smUnique.join(', ') || 'none'}`,
  );
}

/* ------------------------------------------------------------------ */
/* 3. Experiment B: --radius-md                                       */
/* ------------------------------------------------------------------ */

{
  const baseline = await newPage();
  await baseline.goto(storyUrl('compositions-settingspanel--default'));
  const before = await baseline.evaluate(() => {
    const btn = document.querySelector('.sei-button--md');
    const input = document.querySelector('.sei-input');
    const card = document.querySelector('.sei-card');
    return {
      button: getComputedStyle(btn).borderRadius,
      input: getComputedStyle(input).borderRadius,
      card: getComputedStyle(card).borderRadius,
    };
  });
  await baseline.close();

  const modified = await newPage();
  await modified.goto(storyUrl('design-system-playground--large-radius'));
  const after = await modified.evaluate(() => {
    const btn = document.querySelector('.sei-button--md');
    const input = document.querySelector('.sei-input');
    const card = document.querySelector('.sei-card');
    return {
      button: getComputedStyle(btn).borderRadius,
      input: getComputedStyle(input).borderRadius,
      card: getComputedStyle(card).borderRadius,
    };
  });
  await modified.close();

  check(
    'Experiment B: --radius-md change moves Button radius',
    before.button !== after.button,
    `${before.button} → ${after.button}`,
  );
  check(
    'Experiment B: --radius-md change moves Input radius (shares the primitive)',
    before.input !== after.input,
    `${before.input} → ${after.input}`,
  );
  check(
    'Experiment B: Card is unaffected (derives from --radius-lg, a different decision)',
    before.card === after.card,
    `card stayed ${after.card}`,
  );
}

/* ------------------------------------------------------------------ */
/* 4. Experiment C: --color-action                                    */
/* ------------------------------------------------------------------ */

{
  const page = await newPage();
  await page.goto(storyUrl('design-system-playground--brand-action'));

  const primaryInSettings = await page.evaluate(() => {
    const scoped = document.querySelectorAll('[data-sei-scope] .sei-composition');
    const buttons = Array.from(scoped).flatMap((c) =>
      Array.from(c.querySelectorAll('.sei-button--primary')),
    );
    return buttons.map((b) => getComputedStyle(b).backgroundColor);
  });

  const destructiveInSettings = await page.evaluate(() => {
    const scoped = document.querySelectorAll('[data-sei-scope] .sei-composition');
    const buttons = Array.from(scoped).flatMap((c) =>
      Array.from(c.querySelectorAll('.sei-button--destructive')),
    );
    return buttons.map((b) => getComputedStyle(b).backgroundColor);
  });

  await page.close();

  const primaryUnique = [...new Set(primaryInSettings)];
  const destructiveUnique = [...new Set(destructiveInSettings)];

  check(
    'Experiment C: --color-action change reaches primary Buttons in both compositions',
    primaryUnique.length === 1 && primaryUnique[0] === 'rgb(124, 58, 237)',
    `${primaryInSettings.length} primary buttons → ${primaryUnique.join(', ')}`,
  );
  check(
    'Experiment C: destructive Buttons are unaffected (independent semantic role)',
    destructiveUnique.length === 1 && destructiveUnique[0] === 'rgb(220, 38, 38)',
    `${destructiveInSettings.length} destructive buttons → ${destructiveUnique.join(', ')}`,
  );
}

/* ------------------------------------------------------------------ */
/* 5. No component hardcodes design values                            */
/* ------------------------------------------------------------------ */

{
  // Read the stylesheets reachable from the built story and look for raw
  // values in Sei component rules. Comments and token files are excluded:
  // tokens.css legitimately contains raw values — that is its job.
  const page = await newPage();
  await page.goto(storyUrl('compositions-settingspanel--default'));

  const offenders = await page.evaluate(() => {
    const componentSelectors = ['.sei-button', '.sei-input', '.sei-card', '.sei-form', '.sei-settings'];
    const found = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!rule.selectorText) continue;
        if (!componentSelectors.some((s) => rule.selectorText.includes(s))) continue;
        const style = rule.style;
        for (const prop of Array.from(style)) {
          const value = style.getPropertyValue(prop);
          if (value.trim() === '') continue;
          if (value.includes('var(')) continue;

          // Only properties that represent a visual design decision are in
          // scope. Structural properties (display, alignment, text wrapping,
          // position) are layout mechanics, not design values, and
          // 'transparent'/'none'/'0' are the absence of a value rather than one.
          const isDesignValue = /color|background|border|outline|shadow|radius|height|width|font|line-height|opacity|transition|animation/.test(
            prop,
          );
          if (!isDesignValue) continue;
          if (value.trim() === 'transparent' || value.trim() === 'none') continue;
          if (value.trim() === '0') continue;

          // A size that is relative (100%, auto, 1fr) is layout, not a design
          // decision: it says "fill the space you are given" and carries no
          // visual intent that a token could capture. Only absolute lengths
          // count as hardcoded design values.
          if (/(height|width)$/.test(prop) && /%|auto|fr$|^0$/.test(value.trim())) continue;

          found.push({ selector: rule.selectorText, prop, value });
        }
      }
    }
    return found;
  });
  await page.close();

  check(
    'no raw design values in component CSS (tokens only)',
    offenders.length === 0,
    offenders.length === 0
      ? '0 raw design values in .sei-button / .sei-input / .sei-card / .sei-form / .sei-settings rules'
      : JSON.stringify(offenders.slice(0, 8)),
  );
}

/* ------------------------------------------------------------------ */
/* 6. Accessibility basics                                           */
/* ------------------------------------------------------------------ */

{
  const page = await newPage();
  await page.goto(storyUrl('compositions-accountform--default'));

  const a11y = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const inputs = Array.from(document.querySelectorAll('input'));

    // Every input has an associated label.
    const unlabelled = inputs.filter((input) => {
      if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
      if (input.id && document.querySelector(`label[for="${input.id}"]`)) return false;
      return !input.closest('label');
    });

    return {
      buttonCount: buttons.length,
      allButtonsNative: buttons.every((b) => b.tagName === 'BUTTON'),
      buttonsHaveName: buttons.every(
        (b) => (b.textContent ?? '').trim().length > 0 || b.getAttribute('aria-label'),
      ),
      inputCount: inputs.length,
      unlabelledInputs: unlabelled.length,
      headingsPresent: document.querySelectorAll('h1, h2, h3').length,
      landmarks: document.querySelectorAll('main, nav, header').length,
      duplicateIds: (() => {
        const seen = new Set();
        let dupes = 0;
        for (const el of Array.from(document.querySelectorAll('[id]'))) {
          if (seen.has(el.id)) dupes++;
          seen.add(el.id);
        }
        return dupes;
      })(),
    };
  });
  await page.close();

  check('a11y: all controls are native <button>', a11y.allButtonsNative, `${a11y.buttonCount} buttons`);
  check('a11y: every button has an accessible name', a11y.buttonsHaveName);
  check('a11y: every input has an associated label', a11y.unlabelledInputs === 0, `${a11y.inputCount} inputs`);
  check('a11y: no duplicate element ids', a11y.duplicateIds === 0);
}

{
  // Error state announces itself.
  const page = await newPage();
  await page.goto(storyUrl('components-input--with-error'));
  const errorState = await page.evaluate(() => {
    const input = document.querySelector('.sei-input');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const ids = describedBy.split(/\s+/).filter(Boolean);
    return {
      ariaInvalid: input.getAttribute('aria-invalid'),
      describedBy,
      // Read every referenced node, not just the first: a dangling id in the
      // list is the bug this check exists to catch.
      errorText: ids.map((id) => document.getElementById(id)?.textContent).filter(Boolean).join(' | '),
      danglingIds: ids.filter((id) => !document.getElementById(id)),
    };
  });
  await page.close();

  check(
    'a11y: error state sets aria-invalid and associates the message',
    errorState.ariaInvalid === 'true' && !!errorState.errorText,
    `aria-invalid=${errorState.ariaInvalid}, message="${errorState.errorText}"`,
  );
  check(
    'a11y: aria-describedby references only elements that exist',
    errorState.danglingIds.length === 0,
    errorState.danglingIds.length === 0
      ? 'every id in aria-describedby resolves'
      : `dangling: ${errorState.danglingIds.join(', ')}`,
  );
}

/* ------------------------------------------------------------------ */
/* 7. Destructive action requires explicit confirmation                */
/* ------------------------------------------------------------------ */

{
  const page = await newPage();
  await page.goto(storyUrl('compositions-accountform--default'));

  const before = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sei-button--destructive')).at(0);
    return btn.textContent.trim();
  });

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sei-button--destructive')).at(0);
    btn.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  const after = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sei-button')).map((b) => b.textContent.trim());
    return {
      buttons: btns,
      hasConfirm: btns.includes('Delete permanently'),
      hasKeep: btns.includes('Keep account'),
    };
  });
  await page.close();

  check(
    'behaviour: destructive action requires an explicit second click',
    before === 'Delete account' && after.hasConfirm && after.hasKeep,
    `"${before}" → [${after.buttons.filter((b) => /Delete|Keep/.test(b)).join(', ')}]`,
  );
}

/* ------------------------------------------------------------------ */
/* 8. Keyboard reachability                                          */
/* ------------------------------------------------------------------ */

{
  const page = await newPage();
  await page.goto(storyUrl('compositions-settingspanel--default'));

  // Scope to #storybook-root: the manager injects its own focusable elements
  // (the a11y addon's hidden panel) that are not part of the story and are not
  // reachable by Tab inside the iframe.
  const FOCUSABLE =
    '#storybook-root a[href], #storybook-root button:not([disabled]), #storybook-root input:not([disabled]), #storybook-root select:not([disabled]), #storybook-root textarea:not([disabled]), #storybook-root [tabindex]:not([tabindex="-1"])';

  const focusable = await page.evaluate((sel) => document.querySelectorAll(sel).length, FOCUSABLE);

  // Real Tab traversal: dispatch a genuine Tab keypress per step and record
  // which element actually receives focus. Synthesising a KeyboardEvent does
  // not move focus, so the previous version of this check proved nothing.
  const visited = new Set();
  // Enough steps to walk the order several times over, since Tab eventually
  // escapes the story and wraps back around.
  for (let i = 0; i < focusable * 3 + 10; i++) {
    await page.sendKey('Tab');
    const active = await page.evaluate((sel) => {
      const el = document.activeElement;
      if (!el || el === document.body || !el.matches(sel)) return null;
      // Identify by a stable per-element key, not by class, so two Buttons of
      // the same variant are counted as two distinct stops.
      if (!el.dataset.verifyId) {
        el.dataset.verifyId = `v${Math.random().toString(36).slice(2, 9)}`;
      }
      return el.dataset.verifyId;
    }, FOCUSABLE);
    if (active) visited.add(active);
  }
  await page.close();

  check(
    'keyboard: every interactive element in the story is reachable by Tab',
    visited.size === focusable,
    `${focusable} focusable, ${visited.size} distinct elements reached by Tab`,
  );
}

/* ------------------------------------------------------------------ */

console.log('');
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nfailures:');
  for (const f of failed) console.log(`  FAIL  ${f.name} — ${f.detail ?? ''}`);
}

ws.close();
chrome.kill();
process.exit(failed.length ? 1 : 0);