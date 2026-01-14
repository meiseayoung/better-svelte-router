# better-svelte-router

A type-safe, reactive router for Svelte 5 applications using the runes API.

## Features

- 🚀 **Svelte 5 Runes** - Reactive state management with `$state` and `$derived`
- 🔒 **Type Safe** - Full TypeScript support with route path autocompletion
- 🛡️ **Navigation Guards** - `beforeEach` and `afterEach` hooks for route access control
- 📦 **Lazy Loading** - Component lazy loading and code splitting support
- 🔀 **Dual Mode Routing** - Hash mode and History mode support
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

// History mode (recommended)
createRouterMode({ mode: 'history' });

// Or Hash mode
createRouterMode({ mode: 'hash' });

// With base path
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

## Programmatic Navigation

```typescript
import { push, replace, back, forward } from 'better-svelte-router';

// Navigate to a new route (adds history entry)
await push('/users');

// With query parameters
await push('/search', { q: 'test', page: 1 });

// Replace current history entry
await replace('/login');

// Browser history navigation
back();
forward();
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

// Navigate to a new route
push(to: RoutePath, query?: QueryParams): Promise<boolean>

// Replace current route
replace(to: RoutePath, query?: QueryParams): Promise<boolean>

// Go back
back(): void

// Go forward
forward(): void

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
import { createRouterMode, getRouterMode, resetRouterMode } from 'better-svelte-router';

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
type RouterMode = 'hash' | 'history';

interface RouterModeConfig {
  mode: RouterMode;
  base?: string;
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
