/**
 * Canonical id construction and path normalization (§7).
 *
 * Every function here is a pure function of source facts. There is no
 * counter, no clock and no random source, so building the graph twice from
 * unchanged source produces byte-identical ids (§3.3, §19).
 */

import type { RepoPath } from './types.ts';

/**
 * Normalize a path to repository-relative POSIX.
 *
 * Strips the repository root and converts separators, so an id built on Windows
 * matches one built on macOS. The leading `./` that glob results often carry is
 * removed because `./src/x.ts` and `src/x.ts` must not be two identities.
 */
export function toRepoPath(absoluteOrRelative: string, repoRoot: string): RepoPath {
  let path = absoluteOrRelative;

  if (path.startsWith(repoRoot)) {
    path = path.slice(repoRoot.length);
  }

  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/** `token:<canonical-token-name>`. The name excludes the leading `--`. */
export function tokenId(tokenName: string): string {
  return `token:${tokenName}`;
}

/**
 * `component:<canonical-source>#<export-name>`.
 *
 * Canonical source is the implementation file, so a barrel re-export resolves
 * to the same id as the original declaration (§14).
 */
export function componentId(file: RepoPath, exportName: string): string {
  return `component:${file}#${exportName}`;
}

/**
 * `variant:<component-id>:variant:<name>` / `variant:<component-id>:state:<name>`.
 *
 * Built from the component id so variants cannot collide across components, and
 * so the owning component is recoverable from the id alone.
 */
export function variantNodeId(
  ownerComponentId: string,
  kind: 'variant' | 'state',
  name: string,
): string {
  return `${ownerComponentId}:${kind}:${name}`;
}

/** `story:<repo-relative-file>#<export-name>` */
export function storyId(file: RepoPath, exportName: string): string {
  return `story:${file}#${exportName}`;
}

/**
 * Edge ids are derived from their endpoints and type, which is what makes the
 * "one logical relationship, many evidence locations" collapse (§8) work: two
 * analyzers that find the same relationship compute the same id, and the second
 * one merges its evidence into the first.
 */
export function edgeId(type: string, source: string, target: string): string {
  return `${type}:${source}->${target}`;
}

/** Strip the type prefix from a canonical id — used by search (§26). */
export function bareName(id: string): string {
  const withoutPrefix = id.replace(/^(token|component|variant|story):/, '');
  const hashIndex = withoutPrefix.lastIndexOf('#');
  const colonIndex = withoutPrefix.lastIndexOf(':');

  if (hashIndex > colonIndex) return withoutPrefix.slice(hashIndex + 1);
  return withoutPrefix;
}

/** Sort key guaranteeing a total, platform-independent order. */
export function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Sort evidence locations by file, then line, then column. */
export function byLocation(
  a: { file: string; line?: number; column?: number },
  b: { file: string; line?: number; column?: number },
): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  const al = a.line ?? 0;
  const bl = b.line ?? 0;
  if (al !== bl) return al - bl;
  const ac = a.column ?? 0;
  const bc = b.column ?? 0;
  return ac - bc;
}

/**
 * Deduplicate evidence locations (§8).
 *
 * A relationship evidenced by the same location twice is one piece of evidence,
 * not two. Comparison is structural, so `{file, line}` and `{file, line, undefined}`
 * collapse to one.
 */
export function dedupeLocations(
  locations: { file: string; line?: number; column?: number }[],
): { file: string; line?: number; column?: number }[] {
  const seen = new Map<string, { file: string; line?: number; column?: number }>();
  for (const loc of locations) {
    const key = `${loc.file}:${loc.line ?? ''}:${loc.column ?? ''}`;
    if (!seen.has(key)) seen.set(key, { file: loc.file, line: loc.line, column: loc.column });
  }
  return [...seen.values()].sort(byLocation);
}