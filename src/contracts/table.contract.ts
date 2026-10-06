import { defineContract } from './types';

/**
 * Table contract.
 *
 * Presentational: it renders whatever rows it is given. `dense` is a density
 * switch (truthiness modifier), not a visual variant — it trades cell
 * padding for rows-per-screen and never changes anything else. No states:
 * a data table has no interaction states of its own until sorting or row
 * selection is added, and those are not part of this component yet.
 */
export const tableContract = defineContract({
  name: 'Table',
  rootClass: 'sei-table',
  foundation: 'none — presentational <table>, no behavior',
  modifiers: ['dense'],
  states: [],
});
