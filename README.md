# Sei Design System

A small design system built for one purpose: to make the consequences of design
decisions visible in real interfaces.

Every value in every component is a CSS custom property reference. There is no
styling library, no component library, and no build-time token pipeline — a
palette change is a one-line edit, and the effect is something you can point at.

```
tokens  →  components  →  compositions  →  Storybook Playground  →  Chromatic
```

## Running it

```bash
npm install
npm run storybook        # http://localhost:6006
```

```bash
npm run typecheck        # tsc --noEmit
npm run build-storybook  # static build to storybook-static/
npm run build            # typecheck + build-storybook
npm run verify           # drives the running Storybook in Chrome (see below)
```

`npm run verify` expects Storybook to already be running on port 6006. It drives
a real headless Chrome over the DevTools Protocol and asserts the token
experiments, accessibility basics, and keyboard reachability. There are no test
dependencies; it uses Node's built-in WebSocket client.

## What is in here

```
src/
  tokens/tokens.css        primitives, semantic roles, component tokens
  styles/globals.css       reset, baseline typography, focus backstop
  components/
    Button/                primary | secondary | destructive | ghost; sm | md | lg
    Input/                 labelled, with hint and error states
    Card/                  title, description, body, footer
  compositions/
    SettingsPanel/         three Cards, three Inputs, all four Button variants
    AccountForm/           validation, disabled submit, destructive confirmation
  playground/
    StyleProvider.tsx      scoped CSS variable override (the only non-CSS logic)
    Playground.stories.tsx the controls
scripts/verify.mjs         the verification harness
```

The compositions are test environments, not product pages. They exist to give a
token change somewhere realistic to land.

## The three token layers

1. **Primitives** — raw values with no opinion about use: `--blue-500`,
   `--space-4`, `--radius-md`.
2. **Semantic roles** — what a value *means*: `--color-action`,
   `--color-destructive`, `--color-surface`.
3. **Component tokens** — decisions a component owns: `--button-height-md`,
   `--card-padding`.

Components reference the semantic and component layers only, never primitives
directly. That is what lets a single decision have exactly one owner.

### One subtlety worth knowing

`--button-radius`, `--input-radius` and `--card-radius` are **not** declared in
`tokens.css`, even though they read like they should be. Writing
`--button-radius: var(--radius-md)` in the `:root` block resolves the alias
once, at the root, and every descendant inherits that already-computed value —
so overriding `--radius-md` further down the tree has no effect. Button would
appear to work only because the Playground happens to redeclare it.

Instead each component declares the dependency at the point of use:

```css
border-radius: var(--button-radius, var(--radius-md));
```

The inner `var()` is a default, resolved where it is used, so overriding either
the primitive or the component token works. See the comment block in
`tokens.css`.

## The Playground

`Design System / Playground` in Storybook renders the **real** compositions, not
a mock, inside a `StyleProvider` that writes CSS custom property overrides onto a
scoping attribute. Change a control and the components underneath — the same ones
in the component stories and the same ones in the compositions — respond.

`StyleProvider` is deliberately not a theme engine. It does not resolve token
names, does not know about components, and does not merge themes; it sets custom
properties on a wrapper and lets CSS cascade do the rest. If token values ever
need to be computed rather than overridden, that is the point at which it would
need to grow, and it should be resisted until then.

## The three experiments

Each is a control in the Playground *and* a named story, so both the interactive
and the static versions are reviewable. All three are asserted in
`scripts/verify.mjs`.

**A — `--button-height-md: 40px → 48px`**
Moves every `size="md"` Button, in the component stories and in both
compositions. `size="sm"` Buttons stay at 32px, because they read their own
token. This is the argument for component-level tokens over a global scale: the
default control height is one decision with one owner.

**B — `--radius-md: 8px → 12px`**
Moves Button and Input, which both default to that primitive. It does **not**
move Card, because `--card-radius` defaults to `--radius-lg` — surfaces and
controls are a different decision, and should be able to differ.

**C — `--color-action`**
Moves every primary Button in both compositions. It does not move destructive
Buttons, which use `--color-destructive`; an irreversible action should not
silently adopt the brand colour.

## Chromatic

The build is Chromatic-ready. To run a visual review:

```bash
npx chromatic login
npm run chromatic
```

Then every pull request gets a diff showing exactly what a token change did to
every story, which is the whole reason this system is set up this way. No
credentials live in the repository — Chromatic reads `CHROMATIC_PROJECT_TOKEN`
from the environment in CI.

For the first run, the diff will be large because there is no baseline yet.
Subsequent token changes are the interesting ones.

## Limitations

Stated plainly, because a demo that hides its edges is worse than no demo.

- **No build step for tokens.** Tokens are plain CSS custom properties, so there
  is no type-checking between a token name and its use, and a typo fails
  silently by falling back. This is the deliberate trade for transparency; a
  token pipeline (Style Dictionary and similar) is the way to close it if this
  grows.
- **Chromatic is not wired to CI.** The config and script are here; the workflow
  and project token are yours to add.
- **The verification harness is ad hoc.** It asserts a specific set of token and
  accessibility facts against a running Storybook. It is not a general test
  framework, and it will need extending as components are added.
- **No dark mode or theme switching.** The token structure would support it, but
  it is out of scope and unbuilt.
- **Latin text only.** No i18n or RTL work has been done.
