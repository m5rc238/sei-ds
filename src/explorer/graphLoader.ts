/**
 * Load the graph from the built output or source. For Storybook/static use,
 * we expect the graph to be served from /sei/graph.json. This loader
 * tries that first, then falls back to the local .sei/graph.json path.
 */
import type { SeiGraph } from '../graph/types';

export async function loadGraph(): Promise<SeiGraph> {
  // Try fetching from public static location first (Storybook staticDirs)
  try {
    const res = await fetch('/sei/graph.json');
    if (res.ok) {
      return (await res.json()) as SeiGraph;
    }
  } catch (err) {
    // ignore and fall back
  }

  // Dynamic import fallback when running in dev/Vite context
  try {
    const mod = await import('../../.sei/graph.json');
    return mod as any as SeiGraph;
  } catch (err) {
    // last resort: throw
    throw new Error(
      'Failed to load graph.json. Run `npm run sei:graph` to generate .sei/graph.json and ensure /sei is served.',
    );
  }
}
