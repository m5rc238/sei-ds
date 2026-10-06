import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphToReactFlow } from '../graph/reactFlowAdapter';
import { layoutGraph } from '../graph/layout';
import type { SeiGraph, SeiNode } from '../graph/types';
import { createQuery } from '../graph/query';

export type GraphExplorerProps = {
  graph: SeiGraph;
  onSelect?: (id: string) => void;
};

function GraphExplorerInner({ graph, onSelect }: GraphExplorerProps) {
  const rf = useMemo(() => graphToReactFlow(graph), [graph]);
  const laidOut = useMemo(() => layoutGraph(rf.nodes, rf.edges), [rf]);

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidOut.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useMemo(() => createQuery(graph), [graph]);

  useEffect(() => {
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
  }, [laidOut, setNodes, setEdges]);

  const selectionInfo = useMemo(() => {
    if (!selectedId) return null;
    const node = graph.nodes[selectedId];
    if (!node) return null;

    const upstream = query.getUpstream(selectedId);
    const downstream = query.getDownstream(selectedId);
    const impact = query.getImpact(selectedId);

    return {
      node,
      upstream,
      downstream,
      impact,
    };
  }, [graph, query, selectedId]);

  const onNodeClick = (_event: ReactMouseEvent, node: FlowNode) => {
    setSelectedId(node.id);
    onSelect?.(node.id);
  };

  const show = (n: SeiNode) => (n.type === 'token' ? `--${n.tokenName}` : n.name);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {selectionInfo && (
        <aside
          style={{
            width: 320,
            padding: '1rem',
            borderLeft: '1px solid #e5e5e5',
            overflowY: 'auto',
            background: '#fff',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{selectionInfo.node.type}</h3>
          <p style={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {selectionInfo.node.type === 'token'
              ? `--${selectionInfo.node.tokenName}`
              : selectionInfo.node.name}
          </p>
          

          {selectionInfo.upstream.length > 0 && (
            <div>
              <h4>Upstream ({selectionInfo.upstream.length})</h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                {selectionInfo.upstream.map((n: SeiNode) => (
                  <li key={n.id}>{show(n)}</li>
                ))}
              </ul>
            </div>
          )}

          {selectionInfo.downstream.length > 0 && (
            <div>
              <h4>Downstream ({selectionInfo.downstream.length})</h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                {selectionInfo.downstream.map((n: SeiNode) => (
                  <li key={n.id}>{show(n)}</li>
                ))}
              </ul>
            </div>
          )}

          {selectionInfo.impact.length > 0 && (
            <div>
              <h4>Impact ({selectionInfo.impact.length})</h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                {selectionInfo.impact.map((n: SeiNode) => (
                  <li key={n.id}>{show(n)}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

export function GraphExplorer(props: GraphExplorerProps) {
  return (
    <ReactFlowProvider>
      <GraphExplorerInner {...props} />
    </ReactFlowProvider>
  );
}
