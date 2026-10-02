/**
 * Dagre layout for the Explorer.
 *
 * Uses @dagrejs/dagre to compute deterministic positions. The layout is
 * direction-aware (TB) and uses simple defaults; the caller may tune later.
 */
import dagre from '@dagrejs/dagre';
import type { RfEdge, RfNode } from './reactFlowAdapter';

export type LayoutOptions = {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  ranksep?: number;
  nodesep?: number;
};

export function layoutGraph(
  nodes: RfNode[],
  edges: RfEdge[],
  options: LayoutOptions = {},
): { nodes: RfNode[]; edges: RfEdge[] } {
  const {
    direction = 'TB',
    nodeWidth = 180,
    nodeHeight = 60,
    ranksep = 70,
    nodesep = 30,
  } = options;

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep, nodesep });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const laidOutNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: laidOutNodes, edges };
}
