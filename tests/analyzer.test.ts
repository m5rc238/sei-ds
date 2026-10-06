/**
 * Selector analysis units — the extractor the variant/state graph is built on.
 *
 * These lock in two fixes that were made after they silently lost evidence:
 * BEM element selectors must still yield component-level states (Radix styles
 * states on child elements), and `:not(...)` must not claim the state it
 * excludes.
 */

import { describe, expect, it } from 'vitest';
import { analyzeSelector } from '../src/graph/analyzers/css/variants';

describe('analyzeSelector', () => {
  it('reads modifiers, pseudo-classes and elements', () => {
    const result = analyzeSelector('.sei-button--primary:hover');
    expect(result.modifiers).toEqual(['primary']);
    expect(result.pseudoClasses).toContain('hover');
    expect(result.elements).toEqual([]);
    expect(result.dataStates).toEqual([]);
  });

  it('attributes element-scoped states to the block (Radix pattern)', () => {
    const result = analyzeSelector(".sei-tabs__trigger[data-state='active']");
    expect(result.elements).toEqual(['trigger']);
    expect(result.dataStates).toEqual(['active']);
  });

  it('reads presence attributes as states', () => {
    expect(analyzeSelector('.sei-menu__item[data-highlighted]').dataStates).toEqual([
      'highlighted',
    ]);
    expect(analyzeSelector('.sei-menu__item[data-disabled]').dataStates).toEqual(['disabled']);
  });

  it('does not claim a state excluded by :not()', () => {
    const result = analyzeSelector(
      ".sei-tabs__trigger:hover:not(:disabled):not([data-state='active'])",
    );
    expect(result.dataStates).toEqual([]);
    expect(result.pseudoClasses).toEqual(['hover']);
  });

  it('ignores data attributes that are not states', () => {
    expect(analyzeSelector('.sei-x[data-radix-select-content-align]').dataStates).toEqual([]);
  });

  it('does not read pseudo-elements as states', () => {
    const result = analyzeSelector('.sei-checkbox__input:checked::after');
    expect(result.pseudoClasses).toContain('checked');
    expect(result.pseudoClasses).not.toContain('after');
  });
});
