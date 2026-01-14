# better-svelte-router Examples

This directory contains various usage examples for better-svelte-router.

## Directory Structure

```
example/
├── routes.ts              # Complete route configuration example
├── App.svelte             # Root component example
├── layouts/
│   ├── MainLayout.svelte  # Main layout (nested routes)
│   └── AdminLayout.svelte # Admin panel layout
├── pages/
│   ├── Home.svelte        # Home page
│   ├── Login.svelte       # Login page
│   ├── NotFound.svelte    # 404 page
│   └── users/
│       ├── UserList.svelte    # User list
│       └── UserDetail.svelte  # User detail (dynamic params)
└── guards/
    └── auth.ts            # Authentication guard example
```

## Feature Demonstrations

- **Nested Routes**: `layouts/MainLayout.svelte`, `layouts/AdminLayout.svelte`
- **Dynamic Parameters**: `pages/users/UserDetail.svelte`
- **Navigation Guards**: `guards/auth.ts`
- **Lazy Loading**: `component: () => import(...)` in `routes.ts`
- **Route Meta**: `meta` configuration in routes
- **Programmatic Navigation**: `pages/Login.svelte`
- **Reactive State**: `pages/Home.svelte`
