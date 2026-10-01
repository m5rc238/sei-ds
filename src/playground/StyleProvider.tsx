import { useId, useMemo } from 'react';

/**
 * A StyleProvider-shaped wrapper built from a plain React context and one
 * injected <style> element.
 *
 * This is the smallest mechanism that lets Storybook controls change tokens for
 * a subtree. It is deliberately NOT a theme engine: it does not resolve token
 * names, does not know about components, and does not merge themes. It sets the
 * custom properties on the wrapper and lets CSS cascade do the rest, which means
 * the components underneath are the real components reading the real tokens.
 *
 * If token values ever need to be computed rather than overridden (e.g.
 * deriving a hover colour from a base), that is the point at which this file
 * would need to grow — and it should be resisted until then.
 */
export interface StyleProviderProps {
  /** Custom property overrides, e.g. { '--button-height-md': '48px' }. */
  values?: Record<string, string>;
  children: React.ReactNode;
  /** Class applied to the wrapper. Defaults to the page canvas. */
  className?: string;
}

/**
 * Turns a values object into a scoped CSS rule. Custom property names are not
 * valid JS identifiers, so this must be built as a string — which is also why
 * values arrive as strings from Storybook controls.
 */
function useScopedRule(scopeId: string, values?: Record<string, string>): string | undefined {
  return useMemo(() => {
    if (!values) return undefined;
    const declarations = Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([property, value]) => `  ${property}: ${value};`)
      .join('\n');

    if (!declarations) return undefined;
    return `[data-sei-scope='${scopeId}'] {\n${declarations}\n}`;
  }, [scopeId, values]);
}

export function StyleProvider({ values, children, className }: StyleProviderProps) {
  // useId gives a stable id across server and client render, but its value
  // contains characters (':' or guillemets depending on the React version) that
  // are not valid unquoted-in-a-selector, so reduce it to a safe token. The
  // attribute scopes the rule to this wrapper only, so two Providers on one page
  // cannot affect each other.
  const rawId = useId();
  const scopeId = useMemo(() => `s${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId]);
  const rule = useScopedRule(scopeId, values);

  return (
    <>
      {rule ? <style>{rule}</style> : null}
      <div data-sei-scope={scopeId} className={className ?? 'sei-canvas'}>
        {children}
      </div>
    </>
  );
}