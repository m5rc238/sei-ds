/**
 * Query semantics (§20).
 *
 * Framework-independent by construction: this module imports nothing but the
 * graph types. React Flow consumes these functions through
 * `reactFlowAdapter.ts` and never implements traversal of its own (§20, §22).
 *
 * Traversal rules (§12):
 *   - `getUpstream` / `getDownstream` / `getImpact` exclude `fallback` edges.
 *   - Fallback-aware traversal must be requested explicitly.
 *   - `getImpact(id)` is the transitive downstream closure, fallback-excluded,
 *     cycle-safe and deterministic.
 */

import type { EdgeType, SeiGraph, SeiNode } from './types.ts';

export type TraversalOptions = {
  /**
   * Include conditional `fallback` edges. Off by default (§12).
   */
  includeFallback?: boolean;
  /** Restrict to these edge types. Defaults to all non-excluded types. */
  edgeTypes?: readonly EdgeType[];
};

const ALL_EDGE_TYPES: readonly EdgeType[] = [
  'reference',
  'fallback',
  'usage',
  'variant',
  'state',
  'story',
  'composition',
];

type Adjacency = Map<string, string[]>;

/**
 * Build a direction-specific adjacency list.
 *
 * Direction is fixed by construction and is the whole point of the graph (§3.4):
 * `downstream` maps dependency → dependent, so walking it answers "what depends
 * on this". `upstream` maps dependent → dependency, walking it answers "what
 * does this depend on".
 */
function buildAdjacency(graph: SeiGraph, direction: 'upstream' | 'downstream', options: TraversalOptions): Adjacency {
  const includeFallback = options.includeFallback === true;
  const allowed = options.edgeTypes ?? ALL_EDGE_TYPES;

  const adjacency: Adjacency = new Map();
  const link = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };

  for (const edge of Object.values(graph.edges)) {
    if (!allowed.includes(edge.type)) continue;
    if (!includeFallback && edge.type === 'fallback') continue;

    // Fallback edges point token → consumer, same as every other edge (§11).
    if (direction === 'downstream') link(edge.source, edge.target);
    else link(edge.target, edge.source);
  }

  // Sort each list so traversal order does not depend on object key order.
  for (const list of adjacency.values()) list.sort();
  return adjacency;
}

/**
 * Breadth-first closure with a visited set.
 *
 * The visited set is what makes this terminate on cycles (§12). Sorting each
 * frontier before expanding is what makes the *order* deterministic even though
 * the result is a set.
 *
 * The starting node is excluded from the result: `getUpstream(x)` answers "what
 * does x depend on", which does not include x.
 */
function closure(start: string, adjacency: Adjacency, reachable: Set<string>): Set<string> {
  const visited = new Set<string>([start]);
  const out = new Set<string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (reachable.has(next) || visited.has(next)) continue;
      visited.add(next);
      out.add(next);
      queue.push(next);
    }
  }

  return out;
}

function resolveNodes(graph: SeiGraph, ids: Iterable<string>): SeiNode[] {
  const nodes: SeiNode[] = [];
  for (const id of ids) {
    const node = graph.nodes[id];
    if (node) nodes.push(node);
  }
  return nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export class SeiGraphQuery {
  readonly #graph: SeiGraph;

  constructor(graph: SeiGraph) {
    this.#graph = graph;
  }

  get graph(): SeiGraph {
    return this.#graph;
  }

  getNode(id: string): SeiNode | undefined {
    return this.#graph.nodes[id];
  }

  /** Immediate dependencies. Fallback excluded unless requested (§12). */
  getDirectUpstream(id: string, options?: TraversalOptions): SeiNode[] {
    const adjacency = buildAdjacency(this.#graph, 'upstream', options ?? {});
    return resolveNodes(this.#graph, adjacency.get(id) ?? []);
  }

  /** Immediate dependents. Fallback excluded unless requested (§12). */
  getDirectDownstream(id: string, options?: TraversalOptions): SeiNode[] {
    const adjacency = buildAdjacency(this.#graph, 'downstream', options ?? {});
    return resolveNodes(this.#graph, adjacency.get(id) ?? []);
  }

  /** Transitive upstream closure. Does not include the node itself. */
  getUpstream(id: string, options?: TraversalOptions): SeiNode[] {
    const adjacency = buildAdjacency(this.#graph, 'upstream', options ?? {});
    return resolveNodes(this.#graph, closure(id, adjacency, new Set()));
  }

  /** Transitive downstream closure. Does not include the node itself. */
  getDownstream(id: string, options?: TraversalOptions): SeiNode[] {
    const adjacency = buildAdjacency(this.#graph, 'downstream', options ?? {});
    return resolveNodes(this.#graph, closure(id, adjacency, new Set()));
  }

  /**
   * Impact of changing a node: everything that transitively depends on it.
   *
   * §12 fixes this as the transitive downstream closure with fallback excluded,
   * cycle-safe and deterministic. It is a source-evidenced estimate of impact,
   * not a runtime guarantee — the UI says "source-evidenced" for this reason
   * (§3.6).
   */
  getImpact(id: string, options?: TraversalOptions): SeiNode[] {
    return this.getDownstream(id, { ...options, includeFallback: false });
  }

  /**
   * The fallback branches reachable from a node.
   *
   * This is the explicit, opt-in view of conditional relationships (§11): "if
   * you change this token, these are the components whose rendering depends on
   * whether the primary value is present."
   */
  getFallbacks(id: string): Array<{ token: SeiNode; consumer: SeiNode; evidence: SeiGraph['edges'][string]['evidence'] }> {
    const out: Array<{
      token: SeiNode;
      consumer: SeiNode;
      evidence: SeiGraph['edges'][string]['evidence'];
    }> = [];

    for (const edge of Object.values(this.#graph.edges)) {
      if (edge.type !== 'fallback') continue;
      const token = this.#graph.nodes[edge.source];
      const consumer = this.#graph.nodes[edge.target];
      // Report fallbacks where this node is either end: changing the fallback
      // token matters, and so does knowing which consumer it is conditional for.
      if (edge.source !== id && edge.target !== id) continue;
      if (token && consumer) out.push({ token, consumer, evidence: edge.evidence });
    }

    return out.sort(
      (a, b) =>
        (a.token.id < b.token.id ? -1 : a.token.id > b.token.id ? 1 : 0) ||
        (a.consumer.id < b.consumer.id ? -1 : 1),
    );
  }

  /**
   * Search (§26).
   *
   * Deliberately does not require matching the canonical id: the canonical id
   * contains a repo path, so an id-only search would make `--radius-md` harder
   * to find than `radius`. Token names are matched both bare (`radius-md`) and
   * in CSS form (`--radius-md`) because the tokenName is stored without dashes.
   */
  findNodes(query: string): SeiNode[] {
    const q = query.trim().toLowerCase();
    if (q === '') return [];

    return Object.values(this.#graph.nodes)
      .filter((node) => this.#matches(node, q))
      .sort((a, b) => {
        // Exact name matches first, then id order — deterministic either way.
        const aExact = a.name.toLowerCase() === q || a.id.toLowerCase() === q ? 0 : 1;
        const bExact = b.name.toLowerCase() === q || b.id.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }

  #matches(node: SeiNode, q: string): boolean {
    const haystacks: string[] = [node.name, node.id];

    if (node.type === 'token') {
      haystacks.push(node.tokenName, `--${node.tokenName}`, node.layer);
      if (node.value) haystacks.push(node.value);
    }
    if (node.type === 'component') {
      haystacks.push(node.exportName, node.file, ...node.styleSheets);
    }
    if (node.type === 'variant') {
      haystacks.push(node.variantName, node.kind);
      if (node.drivenByProp) haystacks.push(node.drivenByProp);
    }
    if (node.type === 'story') {
      haystacks.push(node.exportName, node.file);
      if (node.title) haystacks.push(node.title);
      if (node.storybookId) haystacks.push(node.storybookId);
    }

    return haystacks.some((h) => h.toLowerCase().includes(q));
  }
}

/** Convenience for one-off use. */
export function createQuery(graph: SeiGraph): SeiGraphQuery {
  return new SeiGraphQuery(graph);
}