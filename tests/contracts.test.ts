/**
 * Contract tests — the contract is the source of truth, and this file is how
 * that claim is kept honest.
 *
 * For every contract exported from src/contracts/index.ts:
 *
 *   - the contract file exists and is re-exported by exactly one component
 *     (the structural binding the graph analyzer also relies on);
 *   - every prop value and modifier has a `<rootClass>--<value>` rule in the
 *     component's stylesheet;
 *   - every state has a matching rule — `:state`, `[data-state='state']` or
 *     `[data-state]` — in that stylesheet;
 *   - every state, modifier and prop value is mentioned in the component's
 *     stories, so the Storybook documentation covers the whole surface.
 *
 * Type-level agreement (component types derived from the contract) is enforced
 * by `npm run typecheck`, not here: a value outside the contract cannot
 * compile at a call site.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as barrel from '../src/contracts/index';

const root = path.resolve(__dirname, '..');
const contractsDir = path.join(root, 'src', 'contracts');
const componentsDir = path.join(root, 'src', 'components');

type Contract = {
  name: string;
  rootClass: string;
  foundation: string;
  props?: Record<string, readonly string[]>;
  modifiers?: readonly string[];
  states: readonly string[];
};

function isContract(value: unknown): value is Contract {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'rootClass' in value &&
    'states' in value
  );
}

const contractFiles = fs
  .readdirSync(contractsDir)
  .filter((file) => file.endsWith('.contract.ts'));

const componentFiles = (function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.stories.tsx')) out.push(full);
  }
  return out;
})(componentsDir);

/** Every contract export in the barrel (types.ts exports no contracts).
 *  The loose predicate can't be used directly as a type guard on the tuple —
 *  `Contract` isn't assignable to the barrel's exact union — so filter first,
 *  then narrow the value explicitly. */
const contracts: Array<[string, Contract]> = Object.entries(barrel)
  .filter((entry) => isContract(entry[1]))
  .map((entry) => [entry[0], entry[1] as Contract]);

/** A state is styled when the stylesheet matches one of its selector forms. */
function cssStylesState(css: string, state: string): boolean {
  return (
    css.includes(`:${state}`) ||
    css.includes(`[data-state='${state}']`) ||
    css.includes(`[data-state="${state}"]`) ||
    css.includes(`[data-${state}]`)
  );
}

/** Story sources mention a state by name; `focus-visible` counts as `focus`
 * when the stories talk about the focus ring, which is how the state is
 * actually demonstrated. */
function storiesCover(storiesText: string, name: string): boolean {
  const lower = storiesText.toLowerCase();
  return lower.includes(name) || lower.includes(name.split('-')[0]!);
}

describe('contract barrel', () => {
  it('re-exports every contract file', () => {
    const indexSource = fs.readFileSync(path.join(contractsDir, 'index.ts'), 'utf8');
    for (const file of contractFiles) {
      const base = file.replace(/\.ts$/, '');
      expect(indexSource, `${file} is not exported from src/contracts/index.ts`).toContain(
        `'./${base}'`,
      );
    }
  });

  it('exports at least the components that exist', () => {
    expect(contracts.length).toBeGreaterThanOrEqual(componentFiles.length);
  });
});

describe.each(contracts)('$name contract', (exportName, contract) => {
  const contractFile = `${exportName.replace(/Contract$/, '')}.contract.ts`;
  const contractPath = path.join(contractsDir, contractFile);

  const reexporters = componentFiles.filter((file) =>
    fs.readFileSync(file, 'utf8').includes(`contracts/${contractFile.replace(/\.ts$/, '')}`),
  );

  const componentFile = reexporters[0];
  const componentDir = componentFile ? path.dirname(componentFile) : undefined;
  const cssFile = componentDir
    ? fs.readdirSync(componentDir).find((f) => f.endsWith('.css'))
    : undefined;
  const storiesFile = componentDir
    ? fs.readdirSync(componentDir).find((f) => f.endsWith('.stories.tsx'))
    : undefined;

  const css = cssFile && componentDir ? fs.readFileSync(path.join(componentDir, cssFile), 'utf8') : '';
  const stories = storiesFile && componentDir
    ? fs.readFileSync(path.join(componentDir, storiesFile), 'utf8')
    : '';

  it('has a contract file', () => {
    expect(fs.existsSync(contractPath), `missing ${contractFile}`).toBe(true);
  });

  it('is re-exported by exactly one component', () => {
    expect(reexporters, 'contract must be structurally bound to one component').toHaveLength(1);
  });

  it('has a stylesheet covering its root class', () => {
    expect(cssFile, 'component directory has no stylesheet').toBeTruthy();
    expect(css).toContain(`.${contract.rootClass}`);
  });

  it('has stories', () => {
    expect(storiesFile, 'component directory has no stories').toBeTruthy();
  });

  it('states a foundation (the accessibility boundary)', () => {
    expect(contract.foundation.trim().length).toBeGreaterThan(0);
  });

  it.each(
    Object.entries(contract.props ?? {}).flatMap(([prop, values]) =>
      values.map((value) => [prop, value] as const),
    ),
  )('prop $prop value "$value" has a modifier rule and a story', (prop, value) => {
    expect(css, `no rule for ${contract.rootClass}--${value}`).toContain(
      `${contract.rootClass}--${value}`,
    );
    expect(stories, `no story mentions ${prop}="${value}"`).toContain(value);
  });

  it.each(contract.modifiers ?? [])('modifier "%s" has a rule and a story', (modifier) => {
    expect(css, `no rule for ${contract.rootClass}--${modifier}`).toContain(
      `${contract.rootClass}--${modifier}`,
    );
    expect(stories, `no story mentions modifier ${modifier}`).toContain(modifier);
  });

  it.each(contract.states)('state "%s" is styled and demonstrated', (state) => {
    expect(cssStylesState(css, state), `no rule styles state "${state}"`).toBe(true);
    expect(storiesCover(stories, state), `no story covers state "${state}"`).toBe(true);
  });
});
