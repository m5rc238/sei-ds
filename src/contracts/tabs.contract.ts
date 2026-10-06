import { defineContract } from './types';

/**
 * Tabs contract.
 *
 * One value axis lives here: `value` picks the active tab from the items the
 * caller passes. The state name `active` is Radix's vocabulary — it is what
 * `[data-state="active"]` carries on the selected trigger and its panel —
 * and means "the selected tab", nothing to do with pressed states.
 */
export const tabsContract = defineContract({
  name: 'Tabs',
  rootClass: 'sei-tabs',
  foundation: '@radix-ui/react-tabs — roving focus, arrow-key navigation and tab/panel wiring',
  states: ['active'],
});
