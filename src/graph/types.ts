/**
 * Canonical graph model.
 *
 * These types are the graph. Nothing here knows about React, Storybook, Dagre
 * or any transport (§3.5). The visualization layer is a projection of this,
 * never the other way round.
 *
 * Two rules are load-bearing and enforced by construction:
 *
 *   1. Identity (§3.3) — every id is built by `ids.ts` from source facts
 *      (repo-relative path, export name, token name). No timestamps, indexes,
 *      random values or Storybook ids appear in an id.
 *   2. Direction (§3.4) — `Edge.source` is always the dependency and
 *      `Edge.target` the dependent. Upstream = what this depends on.
 */

/** Repository-relative POSIX path. */
export type RepoPath = string;

/**
 * 1-based line and column, everywhere (§7).
 *
 * Both are optional because a piece of evidence can be file-scoped (a token
 * referenced from a stylesheet whose only known position is the file).
 */
export type SourceLocation = {
  file: RepoPath;
  line?: number;
  column?: number;
};

export type NodeType = 'token' | 'component' | 'variant' | 'story';

export type EdgeType =
  | 'reference'
  | 'fallback'
  | 'usage'
  | 'variant'
  | 'state'
  | 'story'
  | 'composition';

/**
 * Token layers (§9).
 *
 * `unknown` is a real answer, not a failure state: it is what a token gets when
 * the repository does not structurally place it, which is the case for every
 * referenced-but-undeclared token in this repository.
 */
export type TokenLayer = 'primitive' | 'semantic' | 'component' | 'unknown';

/**
 * How a token came to exist.
 *
 * `declared` — a real custom-property declaration exists in source.
 * `undeclared` — the name is referenced but never declared. The node exists so
 * that §11's required edge shape has a target; `declared: false` keeps it from
 * being mistaken for a definition.
 */
export type TokenOrigin = 'declared' | 'undeclared';

export type BaseNode = {
  id: string;
  type: NodeType;
  /** Canonical id without the type prefix — used by search (§26). */
  name: string;
  /** Every location that establishes this node (§8). Sorted deterministically. */
  evidence: SourceLocation[];
};

export type TokenNode = BaseNode & {
  type: 'token';
  /** CSS custom property name *without* the leading `--`. */
  tokenName: string;
  layer: TokenLayer;
  origin: TokenOrigin;
  /**
   * Declared value, verbatim from source, or undefined when undeclared.
   * Never computed or resolved — this is what the source says, not what the
   * browser would compute (§3.6).
   */
  value?: string;
  /** Selector the declaration was found under. `:root` throughout this repo. */
  selector?: string;
  /**
   * Why this layer was assigned, with a location. Classification must be
   * evidence-backed (§9); `evidence[0]` for a layer is the section banner.
   */
  layerBasis?: string;
};

export type ComponentNode = BaseNode & {
  type: 'component';
  /** Export name, e.g. `Button`. */
  exportName: string;
  /** Canonical implementation file. */
  file: RepoPath;
  /**
   * Component-scoped CSS discovered by following this component's own
   * `import './X.css'` statement — never by filename matching (§3.1).
   */
  styleSheets: RepoPath[];
};

export type VariantNode = BaseNode & {
  type: 'variant';
  /** Owning component id. */
  componentId: string;
  /**
   * `variant` or `state`. This is metadata on a variant node, not a fifth node
   * type: the model has exactly four (§5).
   */
  kind: 'variant' | 'state';
  /** Variant value or pseudo-class, e.g. `primary`, `focus-visible`. */
  variantName: string;
  /** Prop that drives it, when the source names one (`variant`, `size`, `bare`). */
  drivenByProp?: string;
};

export type StoryNode = BaseNode & {
  type: 'story';
  exportName: string;
  file: RepoPath;
  /** CSF `meta.title`, e.g. `Components/Button`. */
  title?: string;
  /**
   * Storybook's own id (`components-button--primary`). Metadata only — it is
   * never used as identity and never parsed to derive relationships (§17).
   */
  storybookId?: string;
};

export type SeiNode = TokenNode | ComponentNode | VariantNode | StoryNode;

export type SeiEdge = {
  id: string;
  type: EdgeType;
  /** The dependency (§3.4). */
  source: string;
  /** The dependent / consumer (§3.4). */
  target: string;
  evidence: SourceLocation[];
  /**
   * Non-normative description of what the edge asserts, used verbatim in the UI.
   * For `fallback` this must read as a conditional statement, not an
   * unconditional dependency (§11).
   */
  description: string;
  /**
   * True for `fallback` edges only. Marks the relationship as conditional so
   * that normal traversal can exclude it without special-casing the edge type
   * everywhere (§12).
   */
  conditional: boolean;
};

export type DiagnosticLevel = 'info' | 'warning';

/**
 * Diagnostics are strictly separate from the graph (§18). A diagnostic is
 * never promoted into an edge, and an absent edge is never an error.
 */
export type Diagnostic = {
  level: DiagnosticLevel;
  /** Stable, greppable, e.g. `token-undeclared`. */
  code: string;
  message: string;
  source?: SourceLocation;
};

/**
 * The canonical Sei Graph. The only mutation path is the builder in `graph.ts`,
 * which exists so that "one logical relationship + many evidence locations"
 * (§8) is the default rather than something each analyzer has to remember.
 */
export type SeiGraph = {
  /** Schema version, so a stale `.sei/graph.json` is detectable in the browser. */
  schemaVersion: string;
  nodes: Record<string, SeiNode>;
  edges: Record<string, SeiEdge>;
  diagnostics: Diagnostic[];
};

/** Minimal serialisable projection used by the browser layer (§25). */
export type GraphPayload = SeiGraph;

export const GRAPH_SCHEMA_VERSION = '1.0.0';