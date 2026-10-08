# Sei Design System

**Purpose of this repository — proof of skill.** This project demonstrates the
**implementation and production process** for a design system: taking design
tokens all the way through to a shipped, documented, tested, and visually
reviewed component library — with **Storybook** as the documentation and
interaction surface and **Chromatic** as the visual regression review.

It is built as an experiment-lab, not a toy: every design decision has a
single owner, and every decision's consequences are made visible — by code, by
tests, and by the Chromatic review workflow.

```
tokens  →  components  →  compositions  →  Storybook  →  tests / Chromatic
```

There is no styling library, no component library, no Tailwind, and no
build-time token pipeline. Tokens are CSS custom properties; components are
hand-written React + CSS; the "build step" is **verification**, not styling.

> The full demonstration of the claim — including the evaluation rubric, the
> evidence, and the honest gaps — lives in
> **[`docs/proof-of-skill.md`](docs/proof-of-skill.md)**.

## Quickstart

```bash
npm install
npm run storybook        # http://localhost:6006 — 50 stories, autodocs
npm run chromatic        # build-storybook + visual review (needs token)
```

| Command | What it proves |
|---|---|
| `npm run typecheck` | Types, including component prop unions |
| `npm run lint` | ESLint (JS recommended + typescript-eslint + react-hooks) |
| `npm run test` | Vitest: component behaviour + every story run as a browser test with an automatic axe audit (@storybook/addon-vitest) |
| `npm run test:e2e` | Playwright against Storybook: renders, token experiments, a11y + axe, keyboard, destructive flow |
| `npm run validate` | `lint` → `typecheck` → `test` → `build-storybook` — the CI gate |
| `npm run chromatic` | Visual review of every story |

`npm run verify` is kept as an alias for `npm run test:e2e`.

## Architecture

```
src/
  tokens/tokens.css        the three token layers: primitive, semantic, component
  styles/globals.css       reset + baseline typography + focus backstop
  components/              Button, Input, Card, Checkbox, Select, Dialog,
                           DropdownMenu, Tabs, Tooltip, Table  (+ stories, CSS)
  compositions/            SettingsPanel, AccountForm — realistic test environments
  playground/              StyleProvider (scoped token overrides) + Playground story
```

Each component directory is self-contained: `Comp.tsx`, `Comp.css`,
`Comp.stories.tsx`, `index.ts`. The CSS has no raw design values — every
`color`, `border`, `radius`, `height` and so on is a `var()` reference
(enforced by `e2e/design-values.spec.ts`).

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
`tokens.css`.

## Radix vs native — the boundary rule

| Pattern | Chosen |
|---|---|
| Checkbox, Button, Input, Table | **native elements** — a pattern with a native equivalent stays native |
| Select, Dialog, Menu, Tabs, Tooltip | **Radix Primitives** — ARIA-rich patterns with no native element |

The rule: native for what the platform already does well, Radix for what it
can't. Native checkbox gives `:checked`/`:focus-visible`/`:disabled` from the
platform; Radix Select provides listbox semantics, type-ahead and Escape that
a native `<select>` cannot be styled into (options are not styleable). For each
Radix component the primitive owns the behavior (focus trap, aria wiring) and
CSS only paints the surface. The alternative
(Base UI, currently RC) is documented in this rationale and was not chosen
for maturity.

## Storybook and state coverage

Every component has stories covering every state the stylesheet paints — a
`States` story that renders `hover`, `focus-visible`, `disabled` variants (for
components whose states are CSS pseudo-classes), and an `OpenState` story whose
play function opens the popup so `[data-state="open"]`, `[data-highlighted]`,
`[data-disabled]` are inspectable and Chromatic-freezable.

Components use Radix only where the pattern needs it; for portal-based
popups, stories assert through `document` (Radix portals to `document.body`,
outside the story root).

## The production process — Storybook + Chromatic

This repo exists to demonstrate the *process*, and the process is a loop:

1. **Storybook** is the single documentation and interaction surface — 50
   stories, autodocs, and a live token reference (`Design System/Colors
   Primitives` reads values straight from the shipped stylesheet).
2. **State coverage is playwright- and vitest-verified**, so what Chromatic
   snapshots is the full behavioural surface, not just the resting state.
3. **`npm run chromatic`** builds Storybook and uploads snapshots. A failed
   build surfaced a real bug (play functions broke under the static build) and
   was fixed; token/padding changes became a reviewable 9-change diff.
4. **CI** runs `validate` + `e2e` on every push so the artifact that Chromatic
   reviews is already type- and test-clean.

Stop, review, adjust the token values, and the loop starts again — a
one-line token change travels from `tokens.css` through experiments to a
pixel diff. That is the design-system production process this repo models.

## Testing strategy

Three layers, one question each:

1. **Component behaviour** (`tests/components.test.tsx`) — the parts that are
   ours: class composition, label/`aria-describedby` wiring, table structure.
2. **e2e** (`e2e/`) — against the running Storybook: every story renders,
   the three token experiments (one override reaches everything it should and
   nothing else), no raw design values in shipped CSS, explicit a11y checks +
   full axe scans (WCAG A/AA), destructive-action confirmation, real Tab
   traversal and the primitive keyboard flows (Dialog Escape/focus-return,
   menu arrows, Select type-ahead + Enter, Tabs arrows, Tooltip focus-open).
3. **Chromatic** — visual review of every story (50 snapshots per build),
   which is what makes a one-line token change reviewable as pixels. Wire
   `CHROMATIC_PROJECT_TOKEN` into CI to make it a per-PR gate.

Every story is also run as a browser test via `@storybook/addon-vitest`, each
carrying an automatic axe audit, so accessibility regressions are caught in the
same `npm run test` pass.

The original self-made CDP verification harness (`scripts/verify.mjs`,
no test dependencies) was deliberately replaced by the Playwright suite — the
same checks, plus axe and the primitive keyboard flows. Provenance: each e2e
spec notes which section of the old harness it ported.

Role split: **Vitest** runs in CI's `validate` per commit (fast, no browser);
**Playwright** is a separate CI job (slower); **Chromatic** runs on PRs.

## Quality gates

`.github/workflows/ci.yml` runs two jobs:

- `validate` — `npm run validate` (lint → typecheck → unit/story tests →
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
- Design-decision log and further rationale live in `docs/` (`docs/decisions.md`).

## Limitations

Stated plainly.

- **No build-time token pipeline.** A token typo fails silently by falling
  back. The raw-value scans and the story/axe tests catch the common cases;
  Style Dictionary would close the rest if this grows.
- **No dark mode.** The token structure supports it; it is unbuilt.
- **Latin text only.** No i18n or RTL.
- **Stories as documentation** covers every state a stylesheet paints, and a
  story that renders a component without demonstrating it will not be caught
  automatically — that is what Chromatic is for.