# better-svelte-router

A type-safe, reactive router for Svelte 5 applications using the runes API.

## Features

- 🚀 **Svelte 5 Runes** - Reactive state management with `$state` and `$derived`
- 🔒 **Type Safe** - Full TypeScript support with route path autocompletion
- 🛡️ **Navigation Guards** - `beforeEach` and `afterEach` hooks for route access control
- 📦 **Lazy Loading** - Component lazy loading and code splitting support
- 🔀 **Three Routing Modes** - Hash, History, and Memory (WebView-safe hybrid)
- 📝 **Route Meta** - Attach custom metadata to routes

## Installation

```bash
npm install better-svelte-router
```

Or using other package managers:

```bash
# pnpm
pnpm add better-svelte-router

# yarn
yarn add better-svelte-router
```

### Peer Dependencies

This library requires Svelte 5 as a peer dependency:

```bash
npm install svelte@^5.0.0
```

## Quick Start

### 1. Define Route Configuration

```typescript
// routes.ts
import type { IRoute } from 'better-svelte-router';

export const routes: IRoute[] = [
  {
    path: '/',
    redirect: '/home',
    meta: { title: 'Home' },
    children: [
      {
        path: 'home',
        component: () => import('./pages/Home.svelte'),
        meta: { title: 'Home Page' }
      },
      {
        path: 'users',
        component: () => import('./pages/Users.svelte'),
        meta: { title: 'Users', requiresAuth: true },
        children: [
          {
            path: ':id',
            component: () => import('./pages/UserDetail.svelte'),
            meta: { title: 'User Detail' }
          }
        ]
      }
    ]
  }
];
```

### 2. Initialize Router Mode

```typescript
// main.ts or App.svelte
import { createRouterMode } from 'better-svelte-router';

// History mode (recommended for normal web apps)
createRouterMode({ mode: 'history' });

// Or Hash mode
createRouterMode({ mode: 'hash' });

// Or Memory mode (recommended for Android/iOS WebViews)
createRouterMode({ mode: 'memory', syncHash: true });

// With base path (history mode)
createRouterMode({ mode: 'history', base: '/my-app' });

// Optional: HEAD-probe lazy chunks before import() (WKWebView-safe Retry)
createRouterMode({ mode: 'hash', lazyHeadCheck: true });
```

### 3. Use RouterView Component

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import { routes } from './routes';
</script>

<RouterView {routes} />
```

## Router Modes

### History Mode (Default)

Uses HTML5 History API with URL format `/path`:

```typescript
import { createRouterMode } from 'better-svelte-router';

// Initialize history mode
createRouterMode({ mode: 'history' });

// With base path (for apps deployed in subdirectories)
createRouterMode({ mode: 'history', base: '/app' });
```

### Hash Mode

Uses URL hash with format `/#/path`, suitable for environments without server-side configuration:

```typescript
import { createRouterMode } from 'better-svelte-router';

// Initialize hash mode
createRouterMode({ mode: 'hash' });
```

Hash `replace()` prefers a single `history.replaceState` that preserves the position tag (vue-router-style). If `replaceState` throws, it falls back to `location.replace`. Very old Android WebKits (Android 2.x / 4.0 Mobile Safari without Chrome) skip straight to `location.replace`.

### Memory Mode (WebView-safe)

Hybrid mode for native shells: **seed once from `location.hash`**, then keep the route stack **in memory** and **ignore** `hashchange` / `popstate`. This prevents Android WebView from restoring a launch URL like `#/auth?token=…` and remounting the auth page.

```typescript
import { createRouterMode } from 'better-svelte-router';

// Seed from hash, then ignore WebView history afterwards
createRouterMode({ mode: 'memory', syncHash: true });

// Same, but do not mirror the path back into location.hash
createRouterMode({ mode: 'memory', syncHash: false });

// React Router-style: seed (or restore) the in-memory stack yourself
createRouterMode({
  mode: 'memory',
  initialEntries: ['/home', '/list?type=staff'],
  initialIndex: 1,
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `syncHash` | `true` | Mirror the current path into `location.hash` via `history.replaceState` for display/debugging. Inbound hash/popstate changes are still ignored. |
| `initialEntries` | *(from hash)* | Optional stack of path strings (may include `?query`). When set, skips hash seeding. |
| `initialIndex` | last entry | Index into `initialEntries` to start at. |

Typical deep-link flow:

```text
WebView opens  https://app/#/auth?token=…
  → MemoryModeAdapter seeds stack at /auth?token=…
  → replace('/new-event') updates memory stack only
  → even if WebView restores #/auth, the router stays on /new-event
```

Use `back()` / `forward()` (not the system back button alone) so navigation goes through the in-memory stack and guards.

The library does **not** persist the memory stack across hard reloads. If you need that (e.g. before `reload()`), snapshot and restore yourself:

```typescript
import { createRouterMode, getRouterMode, reload } from 'better-svelte-router';

const STACK_KEY = 'app-memory-stack';

// Boot
const saved = sessionStorage.getItem(STACK_KEY);
sessionStorage.removeItem(STACK_KEY);
const snapshot = saved ? JSON.parse(saved) as { entries: string[]; index: number } : null;

createRouterMode({
  mode: 'memory',
  initialEntries: snapshot?.entries,
  initialIndex: snapshot?.index,
});

// Before hard reload (lazy-chunk miss, etc.)
function hardReload() {
  const adapter = getRouterMode();
  if (adapter.getEntries && adapter.getIndex) {
    sessionStorage.setItem(
      STACK_KEY,
      JSON.stringify({ entries: adapter.getEntries(), index: adapter.getIndex() })
    );
  }
  reload();
}
```

## Programmatic Navigation

```typescript
import { push, replace, back, forward, reload } from 'better-svelte-router';

// Navigate to a new route (adds history entry)
await push('/users');

// With query parameters (object)
await push('/search', { q: 'test', page: 1 });

// Path may also embed a query string
await push('/list?type=staff');

// Replace current history entry
await replace('/login');

// History navigation (memory mode uses the in-memory stack)
await back();
await forward();

// Hard-reload after a deploy / lazy-chunk miss (persists current route first)
reload();
```

`back()` / `forward()` return `Promise<boolean>`: `false` when cancelled by a guard, out of bounds (memory mode), or otherwise unable to move; otherwise `true`.

`reload()` forces a document load via `location.replace` with a cache-busting query (`_bsr_reload`) on the document URL (before `#`). This is required on some Android WebViews where `location.reload()` is a no-op and `location.replace` only navigates when the URL string changes. Any prior `_bsr_reload` is replaced (not stacked), stripped from history-mode route search, and scrubbed from the address bar on router `start()`.

Before navigating, `reload()` also best-effort re-fetches any lazy chunk URLs that failed earlier in the session (`fetch` with `cache: 'reload'`). That matters on WKWebView (and the HTML module map): an offline failed `import()` can stick a bad response to the **same chunk URL**, and a document-only bust does not change those URLs—revalidate overwrites the bad cache once the network is back, then the hard navigation runs.

The API stays `reload(): void`, but navigation is **not** synchronous: `location.replace` runs after revalidation settles (or after a **~3s** timeout if revalidation is still pending). With no remembered failures, replace still happens on the next microtask—not in the same turn as the `reload()` call. Prefer `reload()` over bare `location.reload()` for Retry after a lazy-load failure or stale chunks after a deploy. It does **not** restore the in-memory back-stack — use `initialEntries` / `initialIndex` if your app needs that.

### Lazy HEAD check (WKWebView)

Opt-in via `createRouterMode({ lazyHeadCheck: true })`. Before each lazy `import()`, the router issues a `HEAD` request to the chunk URL with a unique `_bsr_probe` query so the probe itself is never served from cache. If the probe fails (404 / network), RouterView shows the `error` snippet **without** calling `import()`, which avoids poisoning WKWebView's module map with a sticky failure.

On failure the snippet receives a `LazyChunkError` (`Error` subclass) with:
- `err.retry()` — re-run HEAD, then `import()` if the probe succeeds
- `err.reason` — `'network'` (HEAD `fetch` threw), `'http'` (e.g. 404), or `'import'` (probe ok / skipped but `import()` failed)
- `err.isNetwork` — shorthand for `err.reason === 'network'`
- `err.status` — HTTP status when `reason === 'http'`, otherwise `null`

You can also call `retryLazyLoad()` to retry all registered lazy loads.

```svelte
<script lang="ts">
  import { RouterView, retryLazyLoad, LazyChunkError } from 'better-svelte-router';
  import { routes } from './routes';
</script>

{#snippet error(err)}
  <div class="error">
    <p>
      {err instanceof LazyChunkError && err.isNetwork
        ? 'Network unavailable'
        : err.message}
    </p>
    <button
      onclick={() =>
        err instanceof LazyChunkError ? err.retry() : retryLazyLoad()}
    >
      Retry
    </button>
  </div>
{/snippet}

<RouterView {routes} {error} />
```

## Navigation Guards

### beforeEach Guard

Executes before navigation occurs, can cancel or redirect navigation:

```typescript
import { beforeEach } from 'better-svelte-router';

// Authentication guard
const removeGuard = beforeEach((from, to) => {
  if (to.startsWith('/admin') && !isAuthenticated) {
    return '/login'; // Redirect to login page
  }
  return true; // Allow navigation
});

// Remove guard
removeGuard();
```

Guard return values:
- `true` or `void` - Allow navigation
- `false` - Cancel navigation
- `string` - Redirect to specified path

### afterEach Hook

Executes after navigation completes:

```typescript
import { afterEach } from 'better-svelte-router';

// Page view tracking
const removeHook = afterEach((from, to) => {
  analytics.trackPageView(to);
});
```

## Reactive State

Access current route state using `routerState`:

```svelte
<script lang="ts">
  import { routerState } from 'better-svelte-router';

  // Reactive access to route state
  $effect(() => {
    console.log('Current path:', routerState.pathname);
    console.log('Query params:', routerState.query);
    console.log('Route meta:', routerState.meta);
    
    // Update page title
    document.title = routerState.meta.title ?? 'App';
  });
</script>

<p>Current path: {routerState.pathname}</p>
<p>Query params: {JSON.stringify(routerState.query)}</p>
```

### routerState Properties

| Property | Type | Description |
|----------|------|-------------|
| `href` | `string` | Full URL |
| `pathname` | `string` | Current path |
| `search` | `string` | Query string (including `?`) |
| `hash` | `string` | URL hash (including `#`) |
| `query` | `Record<string, string>` | Parsed query parameters |
| `meta` | `RouteMeta` | Current route metadata |

## Route Meta

Attach custom metadata to routes:

```typescript
import type { IRoute } from 'better-svelte-router';

const routes: IRoute[] = [
  {
    path: '/admin',
    component: AdminLayout,
    meta: {
      title: 'Admin Panel',
      requiresAuth: true,
      permissions: ['admin']
    }
  }
];
```

### Keep-alive (mount cache)

Set `meta.keepAlive` so a route stays mounted when you navigate away. Inactive instances are parked off-document inside a stable mount `host` (Vue-style), so **local `$state` / DOM state does not need to be lifted out**. Keep-alive itself adds **zero DOM nodes** to the outlet template: it captures Svelte's `$$anchor`, `mount()`s the route into a host, and re-parents that host before the anchor when active (never moving Svelte-owned children out from under the host).

```typescript
const routes: IRoute[] = [
  {
    path: '/',
    component: MainLayout,
    // Children inherit keep-alive; a child may set keepAlive: false to opt out
    meta: { keepAlive: { deep: true, max: 10 } },
    children: [
      { path: 'list', component: ListPage },
      { path: 'detail/:id', component: DetailPage, meta: { keepAlive: { key: 'full', max: 5 } } },
      { path: 'about', component: AboutPage, meta: { keepAlive: false } },
    ],
  },
];
```

| Option | Default | Meaning |
|--------|---------|---------|
| `key: 'path'` | ✓ | One instance per route pattern (good for tabs) |
| `key: 'full'` | | One instance per resolved URL (e.g. per-id drafts) |
| `max` | `10` | LRU cap per route in that `RouterView` outlet |
| `deep` | `false` | Nested `RouterView` children inherit keep-alive (`false` on a child opts out) |

#### Semantics

- **Scope:** keep-alive is per `RouterView` outlet (siblings under that outlet). Marking a parent does not cache the whole app—use `deep: true` if nested child routes should inherit.
- **Lifecycle:** first visit runs `onMount` as usual. Leaving parks the instance (no `onDestroy`). Coming back restores the same instance (no second `onMount`). LRU eviction or removing the route destroys it and `onDestroy` runs then.
- **Guards:** `beforeEach` / `afterEach` follow URL navigation only, not park/restore of a cached instance.
- **Opt-out:** `meta.keepAlive: false` disables caching for that route and stops `deep` inheritance for its subtree.

#### Side effects when inactive

Parking does **not** tear down the component, so `$effect` does **not** stop automatically. Timers, sockets, and listeners can keep running in the background.

Use `whileRouteActive` so work starts only while the instance is active and cleans up on deactivate:

```svelte
<script lang="ts">
  import { whileRouteActive, getRouteAlive } from 'better-svelte-router';

  const alive = getRouteAlive();

  whileRouteActive(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  });
</script>
```

Or gate a manual `$effect` with `isRouteActive()` / `alive?.active` if you need custom control. Call `whileRouteActive` during component init (same rules as `$effect`).

#### Known limitations

- **`$effect` is not paused for you.** Always use `whileRouteActive` (or an equivalent `isRouteActive()` check) for intervals, subscriptions, and in-flight work tied to the visible page.
- **`key: 'full'` and global URL.** Each resolved URL gets its own instance, but parked instances still live under the app. Do **not** treat `routerState.pathname` / live route params as that instance’s identity while inactive—capture params into local `$state` on activate (or when the instance is created). Otherwise a hidden cache entry may react to the current URL.
- **Not a full Vue `<KeepAlive>` clone.** Caching is route/outlet based via `meta.keepAlive`, not an arbitrary wrapper around any dynamic component. Nested depth is controlled with `deep`, not by wrapping `RouterView` in a separate keep-alive component.

Try the interactive demo: `npm run demo:keep-alive`.

### Experimental: Vue-style `<KeepAlive>` + preprocessor

For **non-route** tab UIs, there is an experimental `KeepAlive` component plus a Svelte **markup preprocessor** that rewrites Vue-like usage into a cache-safe form (inspired by Vue Vapor: no VNode, but compile-time identity for branches).

```svelte
<script>
  import { KeepAlive } from 'better-svelte-router';
  let tab = $state('a');
</script>

<KeepAlive max={10}>
  {#if tab === 'a'}
    <PageA />
  {:else if tab === 'b'}
    <PageB />
  {:else}
    <PageC />
  {/if}
</KeepAlive>
```

Enable the preprocessor (Vite / `svelte.config`):

```ts
import { keepAlivePreprocess } from 'better-svelte-router/preprocess';

svelte({
  preprocess: [keepAlivePreprocess()],
});
```

**Requirements / behavior**

- Preprocess auto-discovers tags from `import { KeepAlive }` / `import { KeepAlive as KA }` (and subpaths like `better-svelte-router/...`). Aliased tags are rewritten without passing `tag:` in options.
- Supported children: a single `{#if} / {:else if} / {:else}` chain, or a single `<svelte:component this={...} />`. Unsupported children are left unchanged (console warning) and the runtime **falls back to a normal render** (no cache, no blank screen).
- Runtime props (also preserved by preprocess): `max`, `include` / `exclude` (name, cache key, `RegExp`, or component ref), and `cacheKey` (with `is={Component}` — separate instances of the same component).
- Hooks inside cached pages: `onActivated` / `onDeactivated` (also work with route `meta.keepAlive`), plus existing `whileRouteActive` / `isRouteActive`.
- Prefer **page components** inside branches. Inline markup that reads the switch variable can still update while parked; put switch-driven UI inside child components when possible.
- Client-only (`document` park/restore). Does **not** replace `meta.keepAlive` for routing.
- **No wrapper element** in the parent tree: each cache slot captures Svelte's `$$anchor` and park/restores a mount `host` before that anchor (same strategy as route `meta.keepAlive`).

```svelte
<script>
  import { KeepAlive, onActivated } from 'better-svelte-router';
  import UserPage from './UserPage.svelte';
  let id = $state('1');
</script>

<!-- Same component, different cache entries via cacheKey -->
<KeepAlive is={UserPage} cacheKey={id} props={{ id }} max={5} />

<!-- include / exclude (component refs or names / regex) -->
<KeepAlive is={Current} include={[UserPage]} exclude={/Temp/} />
```

Demo (`npm run demo:keep-alive-component`): preprocess `{#if}`, dynamic `is`/`cacheKey`, and `include`/`exclude`.

Use meta in guards:

```typescript
import { beforeEach, matchRoute } from 'better-svelte-router';
import { routes } from './routes';

beforeEach((from, to) => {
  const matched = matchRoute(routes, to);
  if (matched?.meta.requiresAuth && !isAuthenticated) {
    return '/login';
  }
});
```

## RouterView Component

### Props

| Prop | Type | Description |
|------|------|-------------|
| `routes` | `IRoute[]` | Route configuration array |
| `prefix` | `string` | Path prefix (for nested routes) |
| `error` | `Snippet<[Error]>` | Custom error display |
| `loading` | `Snippet` | Custom loading display |

### Custom Loading and Error States

```svelte
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import { routes } from './routes';
</script>

{#snippet loading()}
  <div class="loading">Loading...</div>
{/snippet}

{#snippet error(err)}
  <div class="error">
    <h2>Failed to load</h2>
    <p>{err.message}</p>
  </div>
{/snippet}

<RouterView {routes} {loading} {error} />
```


## Nested Routes

Nested routes allow you to render child routes within parent components, suitable for layout nesting scenarios.

### Route Configuration

```typescript
// routes.ts
import type { IRoute } from 'better-svelte-router';

export const routes: IRoute[] = [
  {
    path: '/',
    component: () => import('./layouts/MainLayout.svelte'),
    children: [
      {
        path: 'dashboard',
        component: () => import('./pages/Dashboard.svelte'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'settings',
        component: () => import('./layouts/SettingsLayout.svelte'),
        meta: { title: 'Settings' },
        children: [
          {
            path: 'profile',
            component: () => import('./pages/settings/Profile.svelte'),
            meta: { title: 'Profile Settings' }
          },
          {
            path: 'security',
            component: () => import('./pages/settings/Security.svelte'),
            meta: { title: 'Security Settings' }
          }
        ]
      }
    ]
  }
];
```

The above configuration generates these routes:
- `/dashboard` → MainLayout > Dashboard
- `/settings/profile` → MainLayout > SettingsLayout > Profile
- `/settings/security` → MainLayout > SettingsLayout > Security

### Parent Layout Component

Parent components need to use `RouterView` to render child routes, passing the current path prefix via the `prefix` prop:

```svelte
<!-- layouts/MainLayout.svelte -->
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import type { IRoute } from 'better-svelte-router';

  interface Props {
    routes: IRoute[];
    prefix?: string;
  }

  let { routes, prefix = '' }: Props = $props();
</script>

<div class="main-layout">
  <header>
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/settings/profile">Settings</a>
    </nav>
  </header>
  
  <main>
    <!-- Render child routes -->
    <RouterView {routes} {prefix} />
  </main>
  
  <footer>© 2024 My App</footer>
</div>
```

### Nested Layout Component

Nested layout components also receive `routes` and `prefix`, continuing to pass them down:

```svelte
<!-- layouts/SettingsLayout.svelte -->
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import type { IRoute } from 'better-svelte-router';

  interface Props {
    routes: IRoute[];
    prefix?: string;
  }

  let { routes, prefix = '' }: Props = $props();
</script>

<div class="settings-layout">
  <aside>
    <nav>
      <a href="/settings/profile">Profile</a>
      <a href="/settings/security">Security</a>
    </nav>
  </aside>
  
  <section class="settings-content">
    <!-- Render settings sub-pages -->
    <RouterView {routes} {prefix} />
  </section>
</div>
```

### Leaf Page Component

Leaf page components don't need to render child routes and can display content directly:

```svelte
<!-- pages/settings/Profile.svelte -->
<script lang="ts">
  import { routerState } from 'better-svelte-router';
</script>

<div class="profile-page">
  <h1>Profile Settings</h1>
  <p>Current path: {routerState.pathname}</p>
  <!-- Page content -->
</div>
```

### Dynamic Parameters with Nested Routes

Nested routes support dynamic parameters, which are automatically passed to matched components:

```typescript
const routes: IRoute[] = [
  {
    path: '/',
    component: () => import('./layouts/MainLayout.svelte'),
    children: [
      {
        path: 'users/:userId',
        component: () => import('./layouts/UserLayout.svelte'),
        children: [
          {
            path: 'posts',
            component: () => import('./pages/UserPosts.svelte')
          },
          {
            path: 'posts/:postId',
            component: () => import('./pages/PostDetail.svelte')
          }
        ]
      }
    ]
  }
];
```

Access route parameters in components:

```svelte
<!-- pages/PostDetail.svelte -->
<script lang="ts">
  interface Props {
    params: { userId: string; postId: string };
  }

  let { params }: Props = $props();
</script>

<div>
  <h1>Post {params.postId}</h1>
  <p>By User {params.userId}</p>
</div>
```

## API Reference

### Navigation Functions

```typescript
import { push, replace, back, forward, reload, buildSearchString } from 'better-svelte-router';

// Navigate to a new route (`to` may include `?query`)
push(to: RoutePath, query?: QueryParams): Promise<boolean>

// Replace current route (`to` may include `?query`)
replace(to: RoutePath, query?: QueryParams): Promise<boolean>

// Go back (memory mode: in-memory stack; otherwise browser history)
back(): Promise<boolean>

// Go forward (memory mode: in-memory stack; otherwise browser history)
forward(): Promise<boolean>

// Hard-reload: revalidate failed lazy chunks, then location.replace + document cache-bust (WebView-safe).
// Not sync: replace runs after revalidation (or ~3s timeout); with no failures, next microtask.
reload(): void

// Build query string
buildSearchString(query?: QueryParams): string

// Re-run HEAD probe + lazy import for mounted RouterViews (lazyHeadCheck)
retryLazyLoad(): void
```

### Guard Functions

```typescript
import { beforeEach, afterEach, clearGuards } from 'better-svelte-router';

// Register before guard
beforeEach(guard: NavigationGuard): () => void

// Register after hook
afterEach(hook: AfterEachHook): () => void

// Clear all guards (for testing)
clearGuards(): void
```

### Router Mode

```typescript
import {
  createRouterMode,
  getRouterMode,
  resetRouterMode,
  HistoryModeAdapter,
  HashModeAdapter,
  MemoryModeAdapter,
} from 'better-svelte-router';

// Create router mode
createRouterMode(config: RouterModeConfig): IRouterModeAdapter

// Get current router mode adapter
getRouterMode(): IRouterModeAdapter

// Reset router mode (for testing)
resetRouterMode(): void
```

### Route Matching

```typescript
import { matchRoute, findMatchingRoutes } from 'better-svelte-router';

// Match a single route
matchRoute(routes: IRoute[], pathname: string, prefix?: string): MatchedRoute | null

// Find all matching routes (including parents)
findMatchingRoutes(routes: IRoute[], pathname: string, prefix?: string): MatchedRoute[]
```

## Type Definitions

```typescript
import type {
  IRoute,
  RouteMeta,
  QueryParams,
  NavigationGuard,
  RouterMode,
  RouterModeConfig,
  MatchedRoute
} from 'better-svelte-router';

// Route configuration
interface IRoute {
  path: string;
  name?: string;
  component?: Component | LazyComponent;
  children?: IRoute[];
  redirect?: string;
  meta?: RouteMeta;
}

// Route metadata
interface RouteMeta {
  title?: string;
  requiresAuth?: boolean;
  keepAlive?: boolean | KeepAliveOptions;
  [key: string]: unknown;
}

interface KeepAliveOptions {
  key?: 'path' | 'full';
  max?: number;
  deep?: boolean;
}

// Query parameters
type QueryParams = Record<string, string | number | boolean | undefined | null>;

// Navigation guard
type NavigationGuard = (from: string, to: string) => 
  boolean | string | void | Promise<boolean | string | void>;

// Router mode
type RouterMode = 'hash' | 'history' | 'memory';

interface RouterModeConfig {
  mode: RouterMode;
  base?: string;
  /** memory mode only: mirror path into location.hash (default true) */
  syncHash?: boolean;
  /** memory mode only: seed/restore stack (React Router-style) */
  initialEntries?: string[];
  /** memory mode only: index into initialEntries (default: last) */
  initialIndex?: number;
  /** HEAD-probe lazy chunks before import() (default false; WKWebView-safe) */
  lazyHeadCheck?: boolean;
}

interface IRouterModeAdapter {
  getCurrentPath(): string;
  getCurrentSearch(): string;
  buildUrl(path: string, search?: string): string;
  push(path: string, search?: string): void;
  replace(path: string, search?: string): void;
  setupListener(callback: () => void): () => void;
  getMode(): RouterMode;
  /** memory mode: move within the in-memory stack */
  go?(delta: number): boolean;
  /** memory mode: path at index+delta, or null if out of bounds */
  peekPath?(delta: number): string | null;
  /** memory mode: snapshot stack as path strings */
  getEntries?(): string[];
  /** memory mode: current stack index */
  getIndex?(): number;
}
```

## Complete Example

### Route Configuration

```typescript
// routes.ts
import type { IRoute } from 'better-svelte-router';

export const routes: IRoute[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/',
    component: () => import('./layouts/MainLayout.svelte'),
    children: [
      {
        path: 'dashboard',
        component: () => import('./pages/Dashboard.svelte'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'users',
        component: () => import('./layouts/UsersLayout.svelte'),
        meta: { title: 'Users', requiresAuth: true },
        children: [
          {
            path: '',
            component: () => import('./pages/users/UserList.svelte'),
            meta: { title: 'User List' }
          },
          {
            path: ':id',
            component: () => import('./pages/users/UserDetail.svelte'),
            meta: { title: 'User Detail' }
          }
        ]
      },
      {
        path: 'login',
        component: () => import('./pages/Login.svelte'),
        meta: { title: 'Login' }
      }
    ]
  }
];
```

### Root Component

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { 
    RouterView, 
    routerState, 
    beforeEach, 
    afterEach,
    createRouterMode 
  } from 'better-svelte-router';
  import { routes } from './routes';

  // Initialize router mode
  createRouterMode({ mode: 'history' });

  // Authentication guard
  beforeEach((from, to) => {
    if (to.startsWith('/users') && !localStorage.getItem('token')) {
      return '/login';
    }
    return true;
  });

  // Page view tracking
  afterEach((from, to) => {
    console.log(`Navigated: ${from} -> ${to}`);
  });

  // Update page title
  $effect(() => {
    document.title = routerState.meta.title ?? 'My App';
  });
</script>

{#snippet loading()}
  <div class="flex items-center justify-center h-screen">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{/snippet}

{#snippet error(err)}
  <div class="alert alert-error">
    <span>Failed to load page: {err.message}</span>
  </div>
{/snippet}

<RouterView {routes} {loading} {error} />
```

### Main Layout Component

```svelte
<!-- layouts/MainLayout.svelte -->
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import type { IRoute } from 'better-svelte-router';

  interface Props {
    routes: IRoute[];
    prefix?: string;
  }

  let { routes, prefix = '' }: Props = $props();
</script>

<div class="app-container">
  <header>
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/users">Users</a>
    </nav>
  </header>
  
  <main>
    <RouterView {routes} {prefix} />
  </main>
</div>
```

### Nested Layout Component

```svelte
<!-- layouts/UsersLayout.svelte -->
<script lang="ts">
  import { RouterView } from 'better-svelte-router';
  import type { IRoute } from 'better-svelte-router';

  interface Props {
    routes: IRoute[];
    prefix?: string;
  }

  let { routes, prefix = '' }: Props = $props();
</script>

<div class="users-layout">
  <aside>
    <h3>Users Menu</h3>
    <a href="/users">All Users</a>
  </aside>
  
  <section>
    <RouterView {routes} {prefix} />
  </section>
</div>
```

### Page Component

```svelte
<!-- pages/users/UserDetail.svelte -->
<script lang="ts">
  interface Props {
    params: { id: string };
  }

  let { params }: Props = $props();
</script>

<div>
  <h1>User Detail</h1>
  <p>User ID: {params.id}</p>
</div>
```

## License

MIT
