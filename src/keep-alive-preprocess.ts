/**
 * Experimental Svelte markup preprocessor: rewrite Vue-style `<KeepAlive>`
 * children into a cache-safe `activeKey` + `children(key)` (or `this` + `props`)
 * form that the runtime `KeepAlive` component can park/restore.
 *
 * Supported child shapes (prototype):
 * 1. A single `{#if} / {:else if} / {:else}` chain
 * 2. A single `<svelte:component this={...} ... />`
 *
 * @example
 * // vite.config / svelte.config
 * import { keepAlivePreprocess } from 'better-svelte-router/preprocess';
 * preprocess: [keepAlivePreprocess()]
 */

import { parse } from 'svelte/compiler';

export interface KeepAlivePreprocessOptions {
  /**
   * Component tag name to transform. When omitted, tags are discovered from
   * imports of `KeepAlive` (including `as` aliases) from `from`.
   */
  tag?: string;
  /**
   * When true (default), warn on KeepAlive children that cannot be rewritten.
   */
  warn?: boolean;
  /**
   * Package name (or prefix) that must appear in the import specifier.
   * Defaults to `better-svelte-router` and also matches subpaths
   * (`better-svelte-router/...`). Set to `null` to skip the import gate.
   */
  from?: string | null;
}

type AstNode = {
  type: string;
  start: number;
  end: number;
  name?: string;
  attributes?: AstNode[];
  fragment?: { nodes: AstNode[] };
  nodes?: AstNode[];
  test?: AstNode;
  consequent?: { nodes: AstNode[] };
  alternate?: { nodes: AstNode[] } | null;
  elseif?: boolean;
  expression?: AstNode;
  value?: unknown;
};

export interface TransformKeepAliveResult {
  code: string;
  transforms: number;
}

/**
 * Transform KeepAlive markup in a Svelte component source string.
 * Exported for unit tests. Runs multiple passes so nested KeepAlive can be
 * rewritten inside-out without stale offsets.
 */
export function transformKeepAliveMarkup(
  content: string,
  options: KeepAlivePreprocessOptions = {}
): TransformKeepAliveResult {
  const from = options.from === undefined ? 'better-svelte-router' : options.from;
  const tags = resolveTransformTags(content, options.tag, from);
  if (tags.length === 0) {
    return { code: content, transforms: 0 };
  }

  let code = content;
  let transforms = 0;
  for (const tag of tags) {
    for (let pass = 0; pass < 8; pass++) {
      // Import already validated via resolveTransformTags; skip per-tag re-check.
      const once = transformKeepAliveMarkupOnce(code, {
        ...options,
        tag,
        from: null,
      });
      transforms += once.transforms;
      code = once.code;
      if (once.transforms === 0) break;
    }
  }
  return { code, transforms };
}

function resolveTransformTags(
  content: string,
  tag: string | undefined,
  from: string | null
): string[] {
  if (from == null) {
    return [tag ?? 'KeepAlive'];
  }
  const imported = resolveKeepAliveLocalNames(content, from);
  if (tag) {
    return imported.includes(tag) ? [tag] : [];
  }
  return imported;
}

function transformKeepAliveMarkupOnce(
  content: string,
  options: KeepAlivePreprocessOptions
): TransformKeepAliveResult {
  const tag = options.tag ?? 'KeepAlive';
  const warn = options.warn ?? true;
  const from = options.from === undefined ? 'better-svelte-router' : options.from;

  if (from != null && !hasLibraryKeepAliveImport(content, tag, from)) {
    return { code: content, transforms: 0 };
  }

  let ast: { fragment?: { nodes: AstNode[] } };
  try {
    ast = parse(content, { modern: true }) as typeof ast;
  } catch {
    return { code: content, transforms: 0 };
  }

  const targets: AstNode[] = [];
  walk(ast.fragment?.nodes ?? [], (node) => {
    if (node.type === 'Component' && node.name === tag) {
      targets.push(node);
    }
  });

  if (targets.length === 0) {
    return { code: content, transforms: 0 };
  }

  const innermost = targets.filter(
    (n) =>
      !targets.some(
        (inner) => inner !== n && inner.start > n.start && inner.end < n.end
      )
  );

  const ordered = [...innermost].sort((a, b) => b.start - a.start);
  let code = content;
  let transforms = 0;
  let id = 0;

  for (const node of ordered) {
    const rewritten = rewriteKeepAlive(node, content, id, tag, warn);
    id += 1;
    if (!rewritten) continue;
    code = code.slice(0, node.start) + rewritten + code.slice(node.end);
    transforms += 1;
  }

  return { code, transforms };
}

/**
 * Local binding names that refer to `KeepAlive` from `packageName`
 * (exact or subpath). Supports:
 * - `import { KeepAlive } from 'better-svelte-router'`
 * - `import { KeepAlive as KA } from 'better-svelte-router'`
 * - `import { KeepAlive } from 'better-svelte-router/foo'`
 * - `export { KeepAlive as KA } from 'better-svelte-router'` (re-export aliases
 *   are collected for completeness; template use still needs a local import)
 */
export function resolveKeepAliveLocalNames(
  content: string,
  packageName: string = 'better-svelte-router'
): string[] {
  const names = new Set<string>();
  const pkgRe = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // import { … } from 'pkg' | 'pkg/…'
  // export { … } from 'pkg' | 'pkg/…'
  const stmtRe = new RegExp(
    String.raw`(?:import|export)\s*\{([^}]*)\}\s*from\s*['"](${pkgRe}(?:\/[^'"]*)?)['"]`,
    'g'
  );

  let m: RegExpExecArray | null;
  while ((m = stmtRe.exec(content)) !== null) {
    const spec = m[1] ?? '';
    for (const part of spec.split(',').map((p) => p.trim()).filter(Boolean)) {
      const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(part);
      if (asMatch) {
        const [, orig, alias] = asMatch;
        if (orig === 'KeepAlive') names.add(alias!);
      } else if (part === 'KeepAlive') {
        names.add('KeepAlive');
      }
    }
  }

  return [...names];
}

/**
 * True when `tag` is a local name bound to KeepAlive from `from` (or subpath).
 */
export function hasLibraryKeepAliveImport(
  content: string,
  tag: string = 'KeepAlive',
  from: string = 'better-svelte-router'
): boolean {
  return resolveKeepAliveLocalNames(content, from).includes(tag);
}

/**
 * Svelte preprocessor factory.
 * Auto-discovers `<KeepAlive>` / aliased tags from package imports when `tag`
 * is omitted.
 */
export function keepAlivePreprocess(options: KeepAlivePreprocessOptions = {}) {
  return {
    name: 'better-svelte-router:keep-alive',
    markup({ content, filename }: { content: string; filename?: string }) {
      if (filename && /\.(svx|md)$/.test(filename)) {
        return { code: content };
      }
      if (!content.includes('KeepAlive') && !options.tag) {
        // Still allow alias-only files: scan imports cheaply
        const from =
          options.from === undefined ? 'better-svelte-router' : options.from;
        if (from != null && resolveKeepAliveLocalNames(content, from).length === 0) {
          return { code: content };
        }
      }
      const { code } = transformKeepAliveMarkup(content, options);
      return { code };
    },
  };
}

function walk(nodes: AstNode[], visit: (node: AstNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.fragment?.nodes) walk(node.fragment.nodes, visit);
    if (node.nodes) walk(node.nodes, visit);
    if (node.consequent?.nodes) walk(node.consequent.nodes, visit);
    if (node.alternate?.nodes) walk(node.alternate.nodes, visit);
  }
}

function rewriteKeepAlive(
  node: AstNode,
  content: string,
  id: number,
  tag: string,
  warn: boolean
): string | null {
  const attrNames = new Set(
    (node.attributes ?? [])
      .filter((a) => a.type === 'Attribute' && a.name)
      .map((a) => a.name!)
  );
  if (attrNames.has('activeKey') || attrNames.has('this') || attrNames.has('is')) {
    return null;
  }

  const childNodes = (node.fragment?.nodes ?? []).filter(
    (n) => !(n.type === 'Text' && !String((n as { data?: string }).data ?? '').trim())
  );

  if (childNodes.length === 0) {
    return null;
  }

  if (childNodes.some((n) => n.type === 'SnippetBlock' || n.type === 'Snippet')) {
    return null;
  }

  if (childNodes.length === 1 && childNodes[0]!.type === 'IfBlock') {
    return rewriteIfChain(node, childNodes[0]!, content, id, tag);
  }

  if (childNodes.length === 1 && childNodes[0]!.type === 'SvelteComponent') {
    return rewriteSvelteComponent(node, childNodes[0]!, content, tag);
  }

  if (warn && typeof console !== 'undefined') {
    console.warn(
      `[better-svelte-router/preprocess] <${tag}> child is not a single {#if} chain ` +
        `or <svelte:component>; left unchanged.`
    );
  }
  return null;
}

type Branch = { test: string | null; body: string };

function rewriteIfChain(
  keepAlive: AstNode,
  ifBlock: AstNode,
  content: string,
  id: number,
  tag: string
): string {
  const branches = collectIfBranches(ifBlock, content);
  const activeExpr = buildActiveKeyExpr(branches);
  // Preserve max / include / exclude / cacheKey / etc.
  const attrs = attributeSource(keepAlive, content, ['activeKey', 'this', 'props']);
  const snippetBody = buildSnippetIfBody(branches);

  const attrPart = attrs ? ` ${attrs}` : '';
  void id;
  return (
    `<${tag}${attrPart} activeKey={${activeExpr}}>\n` +
    `{#snippet children(__bsr_k)}\n` +
    `${snippetBody}\n` +
    `{/snippet}\n` +
    `</${tag}>`
  );
}

function collectIfBranches(ifBlock: AstNode, content: string): Branch[] {
  const branches: Branch[] = [];
  let block: AstNode | null = ifBlock;

  while (block && block.type === 'IfBlock') {
    const test = block.test
      ? content.slice(block.test.start, block.test.end)
      : null;
    const body = fragmentSource(block.consequent?.nodes ?? [], content);
    branches.push({ test, body });

    const altNodes = block.alternate?.nodes ?? [];
    const elseif = altNodes.find((n) => n.type === 'IfBlock' && n.elseif);
    if (elseif) {
      block = elseif;
      continue;
    }
    if (altNodes.length) {
      branches.push({
        test: null,
        body: fragmentSource(altNodes, content),
      });
    }
    break;
  }

  return branches;
}

function fragmentSource(nodes: AstNode[], content: string): string {
  if (!nodes.length) return '';
  const start = nodes[0]!.start;
  const end = nodes[nodes.length - 1]!.end;
  return content.slice(start, end).replace(/^\n+/, '').replace(/\n+$/, '');
}

function buildActiveKeyExpr(branches: Branch[]): string {
  let expr = '-1';
  for (let i = branches.length - 1; i >= 0; i--) {
    const b = branches[i]!;
    if (b.test == null) {
      expr = String(i);
    } else {
      expr = `(${b.test}) ? ${i} : (${expr})`;
    }
  }
  return expr;
}

function buildSnippetIfBody(branches: Branch[]): string {
  const lines: string[] = [];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]!;
    if (i === 0) {
      lines.push(`{#if __bsr_k === ${i}}`);
    } else if (b.test == null && i === branches.length - 1) {
      lines.push(`{:else}`);
    } else {
      lines.push(`{:else if __bsr_k === ${i}}`);
    }
    lines.push(b.body);
  }
  lines.push(`{/if}`);
  return lines.join('\n');
}

function rewriteSvelteComponent(
  keepAlive: AstNode,
  comp: AstNode,
  content: string,
  tag: string
): string {
  const thisExpr = comp.expression
    ? content.slice(comp.expression.start, comp.expression.end)
    : 'undefined';

  const propEntries: string[] = [];
  for (const attr of comp.attributes ?? []) {
    if (attr.type !== 'Attribute' || !attr.name) continue;
    if (attr.name === 'this') continue;
    const value = attr.value as AstNode | AstNode[] | boolean | undefined;
    if (value === true || value === undefined) {
      propEntries.push(`${attr.name}: true`);
      continue;
    }
    if (Array.isArray(value)) {
      const raw = value.map((v) => content.slice(v.start, v.end)).join('');
      propEntries.push(`${attr.name}: ${JSON.stringify(raw)}`);
      continue;
    }
    if (typeof value === 'object' && value && 'start' in value) {
      const expr =
        value.type === 'ExpressionTag' && (value as AstNode).expression
          ? content.slice(
              (value as AstNode).expression!.start,
              (value as AstNode).expression!.end
            )
          : content.slice(value.start, value.end);
      propEntries.push(`${attr.name}: ${expr}`);
    }
  }

  const baseAttrs = attributeSource(keepAlive, content, ['activeKey', 'this', 'is', 'props']);
  const parts = [baseAttrs, `is={${thisExpr}}`].filter(Boolean);
  if (propEntries.length) {
    parts.push(`props={{ ${propEntries.join(', ')} }}`);
  }
  return `<${tag} ${parts.join(' ')} />`;
}

function attributeSource(
  node: AstNode,
  content: string,
  exclude: string[]
): string {
  return (node.attributes ?? [])
    .filter((a) => a.type === 'Attribute' && a.name && !exclude.includes(a.name))
    .map((a) => content.slice(a.start, a.end))
    .join(' ');
}

export default keepAlivePreprocess;
