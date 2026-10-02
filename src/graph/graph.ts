/**
 * The canonical Sei Graph and the only way to mutate it.
 *
 * Analyzers do not write into the graph directly; they call `addNode`/`addEdge`.
 * That is what makes §8 hold by construction: two analyzers that independently
 * discover the same logical relationship produce the same edge id, so their
 * evidence merges instead of duplicating the relationship.
 *
 * `query.ts` reads this structure. It never writes to it, which is what lets
 * the Explorer project a focused subgraph without mutating the graph (§21).
 */

import { byId, byLocation, dedupeLocations, edgeId } from './ids';
import {
  GRAPH_SCHEMA_VERSION,
  type Diagnostic,
  type SeiEdge,
  type SeiGraph,
  type SeiNode,
  type SourceLocation,
} from './types';

export class SeiGraphBuilder {
  readonly #nodes = new Map<string, SeiNode>();
  readonly #edges = new Map<string, SeiEdge>();
  readonly #diagnostics: Diagnostic[] = [];
  readonly #diagnosticKeys = new Set<string>();

  /**
   * Add a node, or merge evidence into an existing one.
   *
   * Node identity is the id. A second `addNode` with the same id is not a
   * conflict — it is corroborating evidence about the same node, which is the
   * normal case for a variant found by both the TS union type and a CSS rule
   * (§16).
   *
   * Later non-undefined fields win, so a caller that knows more (e.g. a value
   * discovered after the node was first seen as undeclared) can upgrade it.
   */
  addNode(node: SeiNode): SeiNode {
    const existing = this.#nodes.get(node.id);

    if (!existing) {
      this.#nodes.set(node.id, {
        ...node,
        evidence: dedupeLocations(node.evidence),
      });
      return this.#nodes.get(node.id)!;
    }

    const merged: SeiNode = {
      ...existing,
      ...stripUndefined(node),
      evidence: dedupeLocations([...existing.evidence, ...node.evidence]),
    } as SeiNode;

    this.#nodes.set(node.id, merged);
    return merged;
  }

  hasNode(id: string): boolean {
    return this.#nodes.has(id);
  }

  /**
   * Read a node without mutating.
   *
   * Analyzers legitimately need this: the story analyzer will only connect an
   * arg to a variant that already exists from component or CSS evidence, and
   * that check must not create the node it is checking for.
   */
  getNodeSafe(id: string): SeiNode | undefined {
    return this.#nodes.get(id);
  }

  /**
   * Add an edge, or merge evidence into an existing one.
   *
   * Both endpoints are required to exist. A dangling edge would mean an analyzer
   * invented a relationship to a node it never created, so this throws rather
   * than silently emitting it — a loud failure is the correct response to a bug
   * in an analyzer.
   */
  addEdge(edge: Omit<SeiEdge, 'id'>): SeiEdge {
    if (!this.#nodes.has(edge.source)) {
      throw new Error(`edge source not in graph: ${edge.source} (${edge.type})`);
    }
    if (!this.#nodes.has(edge.target)) {
      throw new Error(`edge target not in graph: ${edge.target} (${edge.type})`);
    }

    const id = edgeId(edge.type, edge.source, edge.target);
    const existing = this.#edges.get(id);

    if (!existing) {
      const created: SeiEdge = {
        ...edge,
        id,
        evidence: dedupeLocations(edge.evidence),
        // `conditional` is derived from the edge type rather than trusted from
        // the caller: a fallback edge is conditional by definition (§11) and a
        // non-fallback edge never is.
        conditional: edge.type === 'fallback',
      };
      this.#edges.set(id, created);
      return created;
    }

    const merged: SeiEdge = {
      ...existing,
      evidence: dedupeLocations([...existing.evidence, ...edge.evidence]),
    };
    this.#edges.set(id, merged);
    return merged;
  }

  /**
   * Record a diagnostic (§18).
   *
   * Deduplicated on code + location so a repeated finding across analyzer runs
   * does not flood the report. Diagnostics are never turned into edges, and this
   * method has no return value that could be mistaken for one.
   */
  addDiagnostic(diagnostic: Diagnostic): void {
    const key = `${diagnostic.code}:${diagnostic.source?.file ?? ''}:${
      diagnostic.source?.line ?? ''
    }:${diagnostic.source?.column ?? ''}`;
    if (this.#diagnosticKeys.has(key)) return;
    this.#diagnosticKeys.add(key);
    this.#diagnostics.push(diagnostic);
  }

  /**
   * Freeze into a plain, deterministically ordered object.
   *
   * `schemaVersion` is fixed, not stamped, so repeated generation is stable.
   */
  build(): SeiGraph {
    const nodes = [...this.#nodes.values()].sort(byId);
    const edges = [...this.#edges.values()].sort(byId);

    const diagnostics = [...this.#diagnostics].sort(
      (a, b) =>
        a.level === b.level
          ? 0
          : a.level === 'warning'
            ? -1
            : 1,
    );
    diagnostics.sort((a, b) => {
      const af = a.source?.file ?? '';
      const bf = b.source?.file ?? '';
      if (af !== bf) return af < bf ? -1 : 1;
      return (a.source?.line ?? 0) - (b.source?.line ?? 0);
    });

    return {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      edges: Object.fromEntries(edges.map((e) => [e.id, e])),
      diagnostics,
    };
  }
}

/** Drop keys whose value is `undefined`, so spreads do not clobber known data. */
function stripUndefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

/** Convenience: the single location a file-level fact has. */
export function fileLocation(file: string): SourceLocation {
  return { file };
}

/** Convenience: a fully specified 1-based location (§7). */
export function at(file: string, line: number, column: number): SourceLocation {
  return { file, line, column };
}

/**
 * Sort an array of locations canonically. Re-exported so analyzers do not each
 * invent an ordering.
 */
export { byLocation };