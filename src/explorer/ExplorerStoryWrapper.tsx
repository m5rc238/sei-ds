import { useEffect, useState } from 'react';
import { GraphExplorer } from './GraphExplorer';
import { loadGraph } from './graphLoader';
import type { SeiGraph } from '../graph/types';

export function ExplorerStoryWrapper() {
  const [graph, setGraph] = useState<SeiGraph | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadGraph()
      .then(setGraph)
      .catch((e) => setError(e as Error));
  }, []);

  if (error) {
    return (
      <div style={{ padding: '1rem' }}>
        <h3>Failed to load graph</h3>
        <pre>{error.message}</pre>
        <p>Run: <code>npm run sei:graph</code></p>
      </div>
    );
  }

  if (!graph) {
    return <div style={{ padding: '1rem' }}>Loading graph…</div>;
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <GraphExplorer graph={graph} />
    </div>
  );
}
