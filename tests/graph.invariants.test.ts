/**
 * Graph invariants — the properties that must hold for the system to be
 * trusted, checked against a graph built from scratch, not the committed one.
 *
 * Freshness is checked separately: the committed .sei/graph.json must be
 * byte-equivalent to what the current sources produce, so a stale committed
 * graph cannot make these checks pass against old data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph } from '../src/graph/build';
import { parseCss } from '../src/graph/analyzers/css/parse';
import type { TokenNode } from '../src/graph/types';

const root = path.resolve(__dirname, '..');
const { graph } = buildGraph({ repoRoot: root });

const COLOR_VALUE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\boklab\(/;

function isComponentNode(id: string): boolean {
  return id.startsWith('component:') && id.includes('/components/');
}

function isColorPrimitive(node: TokenNode): boolean {
  return (
    node.layer === 'primitive' &&
    typeof node.value === 'string' &&
    COLOR_VALUE.test(node.value)
  );
}

describe('graph freshness', () => {
  it('.sei/graph.json matches the sources it was built from', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(root, '.sei/graph.json'), 'utf8'));
    expect(graph).toEqual(committed);
  });
});

describe('component/story coverage', () => {
  it('every component has at least one story', () => {
    const withoutStories = Object.values(graph.nodes)
      .filter((node) => node.type === 'component' && isComponentNode(node.id))
      .filter(
        (node) =>
          !Object.values(graph.edges).some(
            (edge) => edge.type === 'story' && edge.source === node.id,
          ),
      )
      .map((node) => node.id);

    expect(withoutStories, 'components without stories').toEqual([]);
  });
});

describe('colour discipline', () => {
  it('no component stylesheet contains a raw colour value', () => {
    const violations: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.css')) {
          const file = path.relative(root, full).split(path.sep).join('/');
          const parsed = parseCss(fs.readFileSync(full, 'utf8'), file);
          for (const rule of parsed.rules) {
            for (const decl of rule.declarations) {
              // var() references are the mechanism; raw colour VALUES are the
              // violation. A fallback like `var(--x, var(--y))` contains no
              // raw colour either, so matching on the value is sufficient.
              if (COLOR_VALUE.test(decl.value)) {
                violations.push(`${file}:${rule.line} ${decl.property}: ${decl.value}`);
              }
            }
          }
        }
      }
    };
    walk(path.join(root, 'src', 'components'));

    expect(violations, 'component stylesheets must reference tokens, not raw colours').toEqual([]);
  });

  it('no component receives a primitive colour token directly', () => {
    const violations = Object.values(graph.edges)
      .filter((edge) => edge.type === 'usage')
      .filter((edge) => {
        const source = graph.nodes[edge.source];
        const target = graph.nodes[edge.target];
        if (!source || source.type !== 'token') return false;
        if (!target || (target.type !== 'component' && target.type !== 'variant')) return false;
        return isColorPrimitive(source as TokenNode);
      })
      .map((edge) => `${edge.source} -> ${edge.target}`);

    expect(
      violations,
      'components must consume semantic colours; primitives are aliased in tokens.css',
    ).toEqual([]);
  });
});

describe('token discipline', () => {
  it('every semantic and component token is referenced somewhere', () => {
    const touched = new Set<string>();
    for (const edge of Object.values(graph.edges)) {
      touched.add(edge.source);
      touched.add(edge.target);
    }

    const unused = Object.values(graph.nodes)
      .filter(
        (node): node is TokenNode =>
          node.type === 'token' &&
          (node.layer === 'semantic' || node.layer === 'component') &&
          !touched.has(node.id),
      )
      .map((node) => node.name);

    // Primitive palette members may sit unused — they are a scale, waiting.
    // Semantic and component tokens exist BECAUSE something uses them.
    expect(unused, 'declared but unreferenced tokens').toEqual([]);
  });
});
