/**
 * React Flow adapter: convert SeiGraph to React Flow nodes/edges.
 *
 * The adapter maps the canonical graph to a view model. It preserves
 * identity via canonical IDs, and adds a minimal set of fields React Flow
 * and Dagre need for layout. No layout math is performed here.
 */
import type { SeiEdge, SeiGraph, SeiNode } from './types';

export type RfNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: string;
    kind: SeiNode['type'];
    name: string;
    node: SeiNode;
  };
  className?: string;
};

export type RfEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  data?: {
    edge: SeiEdge;
  };
};

export type RfGraph = {
  nodes: RfNode[];
  edges: RfEdge[];
};

function labelForNode(n: SeiNode): string {
  if (n.type === 'token') return `--${n.tokenName}`;
  if (n.type === 'component') return n.name;
  if (n.type === 'variant') return n.name;
  return n.name
}

export function graphToReactFlow(graph: SeiGraph): RfGraph {
  const nodes: RfNode[] = Object.values(graph.nodes).map((n) => ({
    id: n.id,
    position: { x: 0, y: 0 },
    data: {
      label: labelForNode(n),
      kind: n.type,
      name: n.name,
      node: n,
    },
  }));

  const edges: RfEdge[] = Object.values(graph.edges).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: { edge: e },
  }));

  return { nodes, edges };
}
