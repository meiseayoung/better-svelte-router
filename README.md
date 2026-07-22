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
```

| Option | Default | Description |
|--------|---------|-------------|
| `syncHash` | `true` | Mirror the current path into `location.hash` via `history.replaceState` for display/debugging. Inbound hash/popstate changes are still ignored. |

Typical deep-link flow:

```text
WebView opens  https://app/#/auth?token=…
  → MemoryModeAdapter seeds stack at /auth?token=…
  → replace('/new-event') updates memory stack only
  → even if WebView restores #/auth, the router stays on /new-event
```

Use `back()` / `forward()` (not the system back button alone) so navigation goes through the in-memory stack and guards.

## Programmatic Navigation

```typescript
import { push, replace, back, forward } from 'better-svelte-router';

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
```

`back()` / `forward()` return `Promise<boolean>`: `false` when cancelled by a guard, out of bounds (memory mode), or otherwise unable to move; otherwise `true`.

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
import { push, replace, back, forward, buildSearchString } from 'better-svelte-router';

// Navigate to a new route (`to` may include `?query`)
push(to: RoutePath, query?: QueryParams): Promise<boolean>

// Replace current route (`to` may include `?query`)
replace(to: RoutePath, query?: QueryParams): Promise<boolean>

// Go back (memory mode: in-memory stack; otherwise browser history)
back(): Promise<boolean>

// Go forward (memory mode: in-memory stack; otherwise browser history)
forward(): Promise<boolean>

// Build query string
buildSearchString(query?: QueryParams): string
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
  [key: string]: unknown;
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
