# Design decisions

Every non-obvious architectural decision, its context, and the alternative
that was rejected. Kept deliberately short — a decision needs its *why*, not
an essay.

## Native elements, unless the pattern needs more

**Decision.** Native `<button>`, `<input>`, `<input type="checkbox">` and
`<table>` for patterns that have native equivalents; Radix Primitives for
ARIA-rich patterns with no native element: Select, Dialog, DropdownMenu,
Tabs, Tooltip.

**Why.** The platform owns semantics we should not re-implement — activation,
focus, `:checked`, disabled, table structure. Painting on top of the platform
removes an entire class of a11y bugs and keeps keyboard behaviour free.

**Why not everywhere.** Radix exists because some patterns *cannot* be styled
into being from native elements. The canonical case is `Select`: a native
`<select>` renders its `<option>` list as OS chrome that no stylesheet can
reach, so listbox semantics, type-ahead and Escape must come from a library.
The five Radix components chosen here all share that property.

**Rejected alternative.** Base UI (the unstyled successor to MUI's headless
stack) — currently release-candidate, and Radix's contracts (`data-state`,
`data-highlighted`, `data-disabled`) are stable and readable, which the whole
evidence-based graph depends on. Revisit only if Radix stalls.

Each contract's `foundation` field states this boundary per component, so the
claim is auditable in one place.

## Point-of-use fallbacks, not root aliases, for component radius tokens

See SOURCE-PATTERNS.md §3 and the comment block in `src/tokens/tokens.css`.
Root aliasing (`--button-radius: var(--radius-md)`) resolves the primitive
once at the root and defeats lower-tree override; a two-level
`var(--button-radius, var(--radius-md))` keeps the dependency at its point of
use. `--button-radius`, `--input-radius`, `--card-radius`, plus the three
`--*-radius` aliases used identically by Menu/Dialog/Tooltip, are therefore
**not** declared in `tokens.css` (they show up as `token-undeclared` info
diagnostics — expected, not warnings).

## The action ramp must pass WCAG AA on both fill and text

`--color-action` is `--blue-600`, not `--blue-500`. White text on the fill
*and* the colour as text on white both clear 4.5:1 at 16px; at blue-500 the
contrast was 3.68:1. Caught by the axe scan in `e2e/a11y.spec.ts`, which is
why the scan exists. The 500 step survives as a palette member, unused but
waiting (unused primitives are legal by invariant; unused semantic/component
tokens are not).

## Component radius separation: controls vs surfaces

`--button-radius`/`--input-radius` default to `--radius-md` (controls);
`--card-radius` defaults to `--radius-lg` (surfaces). They must be able to
differ — Experiment B exists to prove that lowering the shared primitive
moves only the controls.

## Destructive is not a variant of action

`--color-destructive` is an independent semantic role. Experiment C proves
that re-colouring the brand never moves a destructive button. This is
enforced as an invariant: no primitive colour edge may reach a component or
variant directly, and semantic/component tokens must be referenced.

## Z-index: two layers only

Scrims sit at `--z-overlay` (900); floating surfaces (menus, selects,
dialogs, tooltips) at `--z-popup` (1000). No other z-index may exist.

## No theme engine; no build-time token pipeline

`StyleProvider` writes custom properties onto a scoping attribute and stops.
Computing tokens is a defect of this architecture until a real need appears.
A token typo fails silently by CSS fallback — the contract tests and raw-value
scans are the mitigation, and a Style Dictionary-style pipeline is the stated
future if this grows.

## Storybook state coverage is a tested contract, not a convention

`tests/contracts.test.ts` enforces that every contract state, modifier and
prop value is styled *and* demonstrated in the component's stories. That is
what keeps the "documentation" honest when the component drifts.