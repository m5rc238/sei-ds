# Discovered source patterns

Findings from inspecting the repository before writing any analyzer
(§29.1–2). Every claim below is anchored to a file and line. Where the source
does not support a conclusion, that is recorded as *unknown* rather than
guessed (§3.2).

## 1. Token declarations

- **All 80 custom property declarations live in one file**: `src/tokens/tokens.css`.
  No other `.css` file in `src` declares a custom property.
  - Verified: 80 declarations, 80 unique names, all in `tokens.css`.
  - **Consequence:** every declared token has exactly one definition site.

- **Every declaration sits inside a `:root` rule.** `tokens.css` has three
  separate `:root` blocks (lines 8, 87, and the one continuing from 87).
  `globals.css` declares none.

  - **Scope resolution is unambiguous for every token in this repository**:
    one selector (`:root`), one declaration. There is no same-name-different-scope
    case in the current source. The analyzer still implements §13 and diagnoses
    the ambiguous case; that path is exercised by fixture tests, not by real
    repository data.

- **There is no `@layer`, no `--sei-*` namespace marker, and no separate file
  per token layer.** The three layers are demarcated **only by comment banners**
  (`/* --- ... --- */` block headers).

## 2. Token layers — classification evidence

§9 forbids classifying a token by what its name sounds like. Name-based
classification is impossible here regardless, because the names are not
self-describing:

| Comment banner | Tokens | Line range | Layer |
|---|---|---|---|
| `Sei Design System — primitives` | `--white` … `--duration-medium` | 12–73 | `primitive` |
| `Sei Design System — semantic layer` | `--color-surface` … `--color-input-placeholder` | 89–123 | `semantic` |
| `Component tokens` (nested inside semantic banner) | `--button-height-sm` … `--opacity-disabled` | 133–161 | `component` |

Classification therefore uses **section-comment position**, which is source
metadata with a location, recorded as evidence on each token node. This is
"demonstrated repository convention" (§9.2), not a name heuristic.

Two consequences worth stating plainly:

- `--form-gap`, `--stack-gap` and `--opacity-disabled` sit after the
  `Component tokens` banner but under their own sub-banners (`--- composition ---`,
  `--- state ---`). They are classified `component` because the enclosing
  `Component tokens` banner is the explicit structure (§9.1), and the innermost
  sub-banner is retained as `section` metadata. A human may well consider
  `--opacity-disabled` a *state* token; the analyzer does not invent that
  distinction, because the repository does not declare one.
- The primitive layer contains `--measure-form`, `--duration-*` and `--space-*`,
  which are not colour ramps. The banner is the evidence, not the category.

## 3. Undeclared tokens referenced at point of use

`tokens.css` lines 163–182 contain an explicit comment stating that
`--button-radius`, `--input-radius` and `--card-radius` are deliberately **not**
declared in `:root`, and that each component declares its own dependency at the
point of use.

Source confirms this exactly:

- Referenced-but-undeclared: `--button-radius`, `--card-radius`, `--input-radius`
  (3 of them — computed as the set difference of 76 referenced vs 80 declared).
- Each appears only as the **first** argument of a two-level `var()`:

```css
/* Button.css:22  */  border-radius: var(--button-radius, var(--radius-md));
/* Input.css:27   */  border-radius: var(--input-radius, var(--radius-md));
/* Card.css:19    */  border-radius: var(--card-radius, var(--radius-lg));
```

- They are additionally written **at runtime** by `src/playground/Playground.stories.tsx`
  via `StyleProvider`, which builds a CSS rule as a string
  (`src/playground/StyleProvider.tsx:39`).

**Analyzer decision.** A referenced-but-undeclared name gets a `token` node with
`declared: false`, layer `unknown`, plus an `info` diagnostic
(`token-undeclared`). It gets a `usage` edge from the consuming component,
because §11 requires exactly that shape for the outer name. It gets **no**
`reference` edge and **no** alias target, because the source declares no
definition to alias. The runtime override in `StyleProvider` yields a
diagnostic, not an edge — a runtime write is not a dependency (§3.6).

This is the single most important structural fact in the repository: the
fallback in `var(--button-radius, var(--radius-md))` is not a redundant safety
net. It is the only place that dependency is expressed.

## 4. Token-to-token aliasing

19 declarations use `var()` as their value (e.g. `--color-action: var(--blue-600)`).
Aliases are preserved as `reference` edges, never flattened (§9). A token may
have several referenced aliases (`--color-focus-ring: var(--blue-600)` and
`--color-action-hover: var(--blue-600)` both point at `--blue-600`).

## 5. Token usage in CSS

`var()` references appear in `Button.css`, `Card.css`, `Input.css`,
`compositions.css` and `globals.css`. The latter two are **not owned by a
component** — `globals.css` is a global baseline and `compositions.css` is shared
by two compositions. Neither can be attributed to one component without
inventing an owner, so their `var()` references produce **no** `usage` edge and
an `info` diagnostic (`token-usage-unowned`).

## 6. Components (§14)

All five components are `export function` declarations:

| Canonical source | Export | Line |
|---|---|---|
| `src/components/Button/Button.tsx` | `Button` | 14 |
| `src/components/Card/Card.tsx` | `Card` | 21 |
| `src/components/Input/Input.tsx` | `Input` | 18 |
| `src/compositions/AccountForm/AccountForm.tsx` | `AccountForm` | 14 |
| `src/compositions/SettingsPanel/SettingsPanel.tsx` | `SettingsPanel` | 14 |

- No `memo()`, `forwardRef()` or class components are present, so the wrapper
  forms in §14 are implemented but not exercised by real repository data.
- `src/compositions/**` are **components, not a `composition` node type** (§5).
  There is no `composition` node type in the model; the directory name carries
  no semantic weight in the graph.

### Barrel files

Each `index.ts` re-exports its component (`export { Button } from './Button'`).
Identity resolves to the canonical source: `component:src/components/Button/Button.tsx#Button`.
The barrel creates no node of its own (§14).

## 7. Composition (§15)

Static JSX, all resolvable through named imports:

- `SettingsPanel.tsx` renders `Card` ×3, `Input` ×2, `Button` ×6 → 3 composition edges
- `AccountForm.tsx` renders `Card` ×2, `Input` ×2, `Button` ×5 → 3 composition edges

JSX also appears in **story `render` functions** (`Card.stories.tsx`,
`Playground.stories.tsx`). Those functions are not component declarations, so
there is no owning component node and **no composition edge is created**;
an `info` diagnostic (`jsx-outside-component`) records the occurrence. This is a
deliberate loss of completeness in favour of source-supported edges (§31).

## 8. Variants and states (§16)

The repository supplies **two independent evidence sources** that must collapse
into one canonical node each (§8, §16):

1. **TypeScript** — `Button.tsx:4-5` declares `ButtonVariant =
   'primary' | 'secondary' | 'destructive' | 'ghost'` and `ButtonSize =
   'sm' | 'md' | 'lg'`, bound to props `variant` and `size`.
2. **CSS modifier selectors** — `Button.css` defines `.sei-button--primary`,
   `--secondary`, `--destructive`, `--ghost`, `--sm`, `--md`, `--lg`.
3. **The bridge** — `Button.tsx:23` constructs the class:
   `` `sei-button--${variant}` ``. This template literal is the structural link
   from a variant *value* to a CSS modifier class. It is why variant↔CSS
   matching is evidence-based rather than name-based.

- `--primary` is corroborated by three locations: union member (`Button.tsx:4`),
  CSS rule (`Button.css:65`), story arg (`Button.stories.tsx:22`). One node, three
  evidence locations.
- **Card** has a modifier `.sei-card--bare`, driven by the boolean prop `bare`
  (`Card.tsx:14`, conditional class at `Card.tsx:30`) — a variant with no TS
  union type.
- **Input** has `.sei-input--error`, driven by `error?: string` (`Input.tsx:8`).

States come from pseudo-class selectors only:
`focus-visible`, `disabled`, `hover`, `active`, plus `::placeholder`. These are
`state` nodes, distinct from variants.

## 9. Stories (§17)

12 story files' worth of CSF across 6 files; every one uses
`export default meta` + named `export const`, with `meta.component` set to an
imported identifier:

| File | `title` | `component` | Stories |
|---|---|---|---|
| `Button.stories.tsx` | `Components/Button` | `Button` | 8 |
| `Card.stories.tsx` | `Components/Card` | `Card` | 4 |
| `Input.stories.tsx` | `Components/Input` | `Input` | 5 |
| `AccountForm.stories.tsx` | `Compositions/AccountForm` | `AccountForm` | 2 |
| `SettingsPanel.stories.tsx` | `Compositions/SettingsPanel` | `SettingsPanel` | 2 |
| `Playground.stories.tsx` | `Design System/Playground` | *none* | 4 |

- Story IDs are source-derived: `story:src/components/Button/Button.stories.tsx#Primary`.
  Storybook IDs (`components-button--primary`) are **metadata only** (§17).
- `Playground.stories.tsx` has **no `component`**, so no story→component mapping
  exists for it. Its meta args *are* a machine-readable list of the tokens the
  playground overrides (`--button-height-md`, `--radius-md`, …). These are
  runtime writes and produce diagnostics, not edges.
- Story→variant mapping is best-effort from **static `args` literals only**
  (`variant: 'secondary'`). `Primary: Story = {}` inherits `meta.args`, which is
  also static and analysable.

## 10. Known analysis gaps (recorded, not papered over)

| Gap | Why no edge is created |
|---|---|
| `args: { disabled: true }` → `:disabled` state | Linking an HTML prop to its CSS pseudo-class requires platform knowledge, not repository evidence. §3.1 forbids name-only matching. |
| JSX composition inside story `render` | No owning component node. |
| `var()` in `globals.css` / `compositions.css` | No single owning component. |
| `StyleProvider` runtime token writes | Runtime, not a static dependency. |
| Same-name tokens in different scopes | Does not occur in this repository. |

---

# 11. Post-audit updates — recorded as the system grew

§1–10 describe the repository as audited. This section records the changes
that followed, so the analyzer's current behaviour has a source-anchored
description. Where a claim here differs from §1–10, this section wins.

## 11.1 Component inventory

The five-component system is now ten components (Button, Card, Input,
Checkbox, Select, Dialog, DropdownMenu, Tabs, Tooltip, Table) plus two
compositions (SettingsPanel, AccountForm). Every component ships `.tsx`,
`.css`, `.stories.tsx`, `index.ts`.

## 11.2 Contracts — a third evidence source

Each component re-exports a `defineContract()`-defined `*.contract.ts`
(`src/contracts/`, barrel `src/contracts/index.ts`, framework in
`src/contracts/types.ts`). `component:...` nodes can now carry `origin:
'contract'` evidence in addition to `origin: 'css'` / `'ts'`: the contract
declares `rootClass`, `foundation`, `props`, `modifiers` and `states`, and
those declarations are themselves source facts. Structural binding (which
component owns which contract) is resolved by import/export specifiers
against the component directory, mirroring §6's barrel rule — never by name
similarity — so the graph sees `dropdownMenuContract` under
`src/components/DropdownMenu/` whether or not the names match.

## 11.3 States now include data attributes

The state node set was previously pseudo-class-only (§8). Radix-driven
components style states with attributes, so `analyzeSelector` (in
`src/graph/analyzers/css/variants.ts`) now also extracts:

- `[data-state='X']` values (Radix: `open`, `closed`, `active`, `inactive`,
  `checked`, `unchecked`, `delayed-open`, `instant-open`, …) as state names;
- bare presence attributes `[data-highlighted]` / `[data-disabled]` as the
  state `highlighted` / `disabled`, giving Menu and Select items their states.

`UNKNOWN` guard: the extraction runs on a copy of the selector with
`:not()/:is()/:where()/:has()` contents stripped, so a `:not([data-state='active'])`
exclusion never yields a spurious `active` claim (§3.1: no name-only
matching).

## 11.4 Element-scoped state rules attribute to the block

Radix styles states on child elements — `.sei-tabs__trigger[data-state='active']`,
`.sei-menu__item[data-highlighted]`, `.sei-dialog[data-state='open']`. The
element gate in `analyzeSelector` was narrowed so a rule with an element
scope still attributes its states to the component root: state collection
(attribute + state pseudo-class) runs regardless of elements, and only the
`--modifier` extraction loop skips element-scoped rules. This is why a
contract state like Tabs' `active` has merged CSS + contract evidence.

## 11.5 baseClassOf (css/variants)

A lookbehind-based `baseClassOf` returned `''` for `.sei-input:hover` (nothing
before the colon but the class), dropping every plain-selector state. The
plain branch now extracts the first dot-prefixed class
(`/\.(?=[a-z])([a-z][a-z0-9-]*)/`), and BEM element parts contribute the
block prefix (`sei-select__trigger` → `sei-select`); `--` modifier segments
are skipped.

## 11.6 findRootClasses — class-context only

A root class is recorded only when the name appears in a class **context** —
a member of an array literal or a JSX `className`/`class` attribute value.
Anything else is ignored, which prevents values like `position="popper"`
(Select) from being mistaken for a root class and killing every piece of that
component's CSS evidence. BEM element names (`.sei-checkbox__box`) still
contribute their block prefix.

## 11.7 Design-value cleanliness of the new components

Extending the §"no raw design values" scan to `.sei-checkbox`, `.sei-select`,
`.sei-dialog`, `.sei-menu`, `.sei-tabs`, `.sei-tooltip`, `.sei-table` turned
up two offenders, both fixed at the source:

- **Tooltip** `max-width: 260px` → tokenized as `--tooltip-max-width`
  (`src/tokens/tokens.css`, component layer).
- **Checkbox** checkmark drawn as `::after` border with raw `4px/8px` →
  replaced by an inline SVG sibling (`aria-hidden`, `focusable=false`). Icon
  geometry now lives in the JSX viewBox — the same place Select keeps its
  chevron — so the stylesheet holds no raw pixel values. `visibility` (not
  `opacity`) toggles the check row, keeping disabled states consistent.

`border-collapse: collapse` and `border-spacing` are excluded as structural
table mechanics, not design decisions (same class as `display`).