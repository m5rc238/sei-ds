# Sei Design System

A small design system engineered as a lab: every design decision has a single
owner, and every decision's consequences are made visible — by code, by tests,
by a dependency graph with file-and-line evidence, and by Chromatic diffs on
every pull request.

```
tokens  →  components  →  compositions  →  Storybook  →  tests / Chromatic
```

There is no styling library, no component library, no Tailwind, and no
build-time token pipeline. Tokens are CSS custom properties; components are
hand-written React + CSS; the "build step" is **analysis**, not compilation.

## Quickstart

```bash
npm install
npm run storybook        # http://localhost:6006
```

| Command | What it proves |
|---|---|
| `npm run typecheck` | Types, including component props derived from contracts |
| `npm run lint` | ESLint (JS recommended + typescript-eslint + react-hooks) |
| `npm run test` | Vitest: contract conformance, analyzer units, graph invariants, component behaviour, and every story run as a browser test with an automatic axe audit (@storybook/addon-vitest) |
| `npm run sei:graph` | Regenerate `.sei/graph.json` from source |
| `npm run test:e2e` | Playwright against Storybook: renders, token experiments, a11y + axe, keyboard, destructive flow |
| `npm run validate` | `lint` → `typecheck` → `test` → `build-storybook` — the CI gate |
| `npm run chromatic` | Visual review of every story |

`npm run verify` is kept as an alias for `npm run test:e2e`.

## Architecture

```
src/
  tokens/tokens.css        the three token layers: primitive, semantic, component
  styles/globals.css       reset + baseline typography + focus backstop
  contracts/               *.contract.ts — the machine-readable contract per component
  components/              Button, Input, Card, Checkbox, Select, Dialog,
                           DropdownMenu, Tabs, Tooltip, Table  (+ stories, CSS)
  compositions/            SettingsPanel, AccountForm — realistic test environments
  playground/              StyleProvider (scoped token overrides) + Playground story
  graph/                   the analyzer: TS → CSS → contracts → evidence graph
  explorer/                GraphExplorer story (react-flow UI over .sei/graph.json)
```

Each component directory is self-contained: `Comp.tsx`, `Comp.css`,
`Comp.stories.tsx`, `index.ts`. The CSS has no raw design values — every
`color`, `border`, `radius`, `height` and so on is a `var()` reference
(enforced by `e2e/design-values.spec.ts` and `tests/graph.invariants.test.ts`).

## Token system

1. **Primitives** — raw values with no opinion about use: `--blue-600`,
   `--space-4`, `--radius-md`, `--duration-fast`.
2. **Semantic roles** — what a value *means*: `--color-action`,
   `--color-destructive`, `--color-surface`.
3. **Component tokens** — decisions a component owns: `--button-height-md`,
   `--card-padding`, `--tooltip-max-width`.

Components reference semantic and component layers only — never a primitive
colour directly (enforced). That single rule is what gives every decision
exactly one owner.

**Contrast.** `--color-action` resolves to `--blue-600`, not `--blue-500`:
white text on the fill **and** the colour as text on white both clear WCAG AA
(4.5:1) at 16px. The ramp steps down through 700/800 for hover/active. This
was a deliberate fix the axe scan caught — see `src/tokens/tokens.css`.

**One subtlety worth knowing.** `--button-radius`, `--input-radius` and
`--card-radius` are deliberately **not** declared in `tokens.css`. Declaring
`--button-radius: var(--radius-md)` at `:root` would resolve the alias once,
at the root, so overriding `--radius-md` lower in the tree would have no
effect. Instead each component declares the dependency at the point of use:

```css
border-radius: var(--button-radius, var(--radius-md));
```

The inner `var()` is a default, resolved where used. See the comment block in
`tokens.css` and §3 of `src/graph/SOURCE-PATTERNS.md`.

## Component contracts

Every component ships a machine-readable `*.contract.ts` declared with
`defineContract()` — For example `Button.contract`:

```ts
{
  name: 'Button',
  rootClass: 'sei-button',
  foundation: 'native <button> — platform owns activation, focus, disabled',
  props: { variant: ['primary', 'secondary', 'destructive', 'ghost'],
           size: ['sm', 'md', 'lg'] },
  states: ['hover', 'focus-visible', 'active', 'disabled'],
}
```

The contract is the single source of truth, and three things read it:

- **Types.** Component prop types derive from the contract (`props.variant`)
  so a value outside the contract cannot compile at a call site.
- **Storybook.** Story `argTypes` are generated from the contract, so the
  controls always match the contract surface.
- **Tests.** `tests/contracts.test.ts` walks the barrel and checks: every
  contract file is exported, re-exported by exactly one component (the same
  structural binding the graph analyzer relies on), every prop value and
  modifier has a `<rootClass>--<value>` CSS rule, every state has a styled
  rule (`:state`, `[data-state=...]` or `[data-...]`), and every state,
  modifier and prop value is demonstrated in the component's stories — so
  Storybook documentation cannot silently fall behind the contract.

The `foundation` field states the accessibility boundary, so a reviewer can
audit it: *what does the platform own here, and what are we painting on top?*

## Radix vs native — the boundary rule

| Pattern | Chosen |
|---|---|
| Checkbox, Button, Input, Table | **native elements** — a pattern with a native equivalent stays native |
| Select, Dialog, Menu, Tabs, Tooltip | **Radix Primitives** — ARIA-rich patterns with no native element |

The rule: native for what the platform already does well, Radix for what it
can't. Native checkbox gives `:checked`/`:focus-visible`/`:disabled` from the
platform; Radix Select provides listbox semantics, type-ahead and Escape that
a native `<select>` cannot be styled into (options are not styleable). Each
Radix component's contract `foundation` records what the primitive owns
(focus trap, aria wiring) so CSS only paints surface. The alternative
(Base UI, currently RC) is documented in this rationale and was not chosen
for maturity.

## Storybook and state coverage

Every component has stories covering every contract state — a `States` story
that renders `hover`, `focus-visible`, `disabled` variants (for components
whose states are CSS pseudo-classes), and an `OpenState` story whose play
function opens the popup so `[data-state="open"]`, `[data-highlighted]`,
`[data-disabled]` are inspectable and Chromatic-freezable. `tests/contracts.test.ts`
enforces that states, modifiers and prop values are never undocumented.

Components use Radix only where the pattern needs it; for portal-based
popups, stories assert through `document` (Radix portals to `document.body`,
outside the story root).

## The dependency graph and evidence

`npm run sei:graph` builds `.sei/graph.json` from source alone — TypeScript
imports, JSX composition, CSS selectors/variables, and now contracts. Every
node (token / component / variant / story / state) carries `file:line`
**evidence**; every edge (reference / usage / fallback / variant / state /
story / composition / contract) is a source-derived, inspectable claim. It is
deterministic and byte-stable: `tests/graph.invariants.test.ts` asserts the
committed graph is exactly what the current sources produce, so a stale graph
cannot silently serve old facts.

Evidence reading rules that keep it honest (see `src/graph/SOURCE-PATTERNS.md`):

- Element-scoped state rules like `.sei-tabs__trigger[data-state='active']`
  attribute to the block root — Radix styles states on children.
- `:not(...)` never claims a state it excludes.
- A selector name is only a root class when it appears in a class **context**
  (JSX `className` / array literals), never from `position="popper"`.
- Primitive colour tokens may sit unused (they are a palette scale); semantic
  and component tokens must be referenced somewhere.

The **Explorer** story (`Design System/Explorer`) renders the graph with
React Flow; selecting a node shows its upstream, downstream and transitive
impact.

## Testing strategy

Four layers, one question each:

1. **Analyzer units** (`tests/analyzer.test.ts`) — does the evidence
   extractor read selectors correctly?
2. **Contract conformance** (`tests/contracts.test.ts`) — is the stylesheet,
   the story coverage and the structural binding faithful to each contract?
3. **Graph invariants** (`tests/graph.invariants.test.ts`) — freshness, story
   coverage, colour discipline (no raw colour values in component CSS; no
   primitive colour reaching a component directly), token discipline.
4. **Component behaviour** (`tests/components.test.tsx`) — the parts that are
   ours: class composition, label/`aria-describedby` wiring, table structure.
5. **e2e** (`e2e/`) — against the running Storybook: every story renders,
   the three token experiments (one override reaches everything it should and
   nothing else), no raw design values in shipped CSS, explicit a11y checks +
   full axe scans (WCAG A/AA), destructive-action confirmation, real Tab
   traversal and the primitive keyboard flows (Dialog Escape/focus-return,
   menu arrows, Select type-ahead + Enter, Tabs arrows, Tooltip focus-open).
6. **Chromatic** — visual review of every story on every PR, which is what
   makes a one-line token change reviewable as pixels.

The original self-made CDP verification harness (`scripts/verify.mjs`,
no test dependencies) was deliberately replaced by the Playwright suite — the
same checks, plus axe and the primitive keyboard flows. Provenance: each e2e
spec notes which section of the old harness it ported.

Role split: **Vitest** runs in CI's `validate` per commit (fast, no browser);
**Playwright** is a separate CI job (slower); **Chromatic** runs on PRs.

## Quality gates

`.github/workflows/ci.yml` runs two jobs:

- `validate` — `npm run validate` (lint → typecheck → unit/graph tests →
  storybook build). Prevents regressions at commit time.
- `e2e` — installs Chromium, then `npm run test:e2e`. Prevents regressions
  in the browser.

Chromatic is configured but requires `CHROMATIC_PROJECT_TOKEN` in CI
environment variables — add it to enable visual review on every PR.

## Decisions and boundaries

- **No Tailwind, no CSS-in-JS.** Plain CSS custom properties keep token
  dependency *visible* in source and analysable.
- **Native for native patterns, Radix for the rest** (see above).
- **No theme engine.** `StyleProvider` is deliberately not a theme engine: it
  sets custom properties on a scoping wrapper and lets the CSS cascade do the
  rest. If token values ever need computing, resist until there is a real
  need.
- **Point-of-use fallbacks** over root aliases for component radius tokens
  (see Tokens above).
- Design-decision log and further rationale live in `docs/` and on the
  `Design System/Explorer` story's edge types; `src/graph/SOURCE-PATTERNS.md`
  records every source fact the analyzer relies on with file:line anchors.

## Limitations

Stated plainly.

- **No build-time token pipeline.** A token typo fails silently by falling
  back. The contract tests plus the raw-value scans catch the common cases;
  Style Dictionary would close the rest if this grows.
- **No dark mode.** The token structure supports it; it is unbuilt.
- **Latin text only.** No i18n or RTL.
- **Stories as documentation** is enforced for states/modifiers/prop values,
  but a story that renders a component without demonstrating it will not be
  caught automatically — that is what Chromatic is for.