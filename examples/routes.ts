/**
 * Route Configuration Example
 * Demonstrates nested routes, dynamic parameters, lazy loading, redirects, etc.
 */
import type { IRoute } from 'better-svelte-router';

export const routes: IRoute[] = [
  // Root path redirect
  {
    path: '/',
    redirect: '/home'
  },
  // Main layout routes
  {
    path: '/',
    component: () => import('./layouts/MainLayout.svelte'),
    children: [
      // Home page
      {
        path: 'home',
        component: () => import('./pages/Home.svelte'),
        meta: { title: 'Home' }
      },
      // Users module - nested routes example
      {
        path: 'users',
        component: () => import('./pages/users/UserList.svelte'),
        meta: { title: 'User List', requiresAuth: true }
      },
      {
        path: 'users/:id',
        component: () => import('./pages/users/UserDetail.svelte'),
        meta: { title: 'User Detail', requiresAuth: true }
      },
      // Login page
      {
        path: 'login',
        component: () => import('./pages/Login.svelte'),
        meta: { title: 'Login' }
      }
    ]
  },
  // Admin panel - separate layout example
  {
    path: '/admin',
    component: () => import('./layouts/AdminLayout.svelte'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/admin/dashboard'
      },
      {
        path: 'dashboard',
        component: () => import('./pages/admin/Dashboard.svelte'),
        meta: { title: 'Admin Dashboard' }
      },
      {
        path: 'settings',
        component: () => import('./pages/admin/Settings.svelte'),
        meta: { title: 'System Settings' }
      }
    ]
  },
  // 404 page
  {
    path: '/:path(.*)',
    component: () => import('./pages/NotFound.svelte'),
    meta: { title: 'Page Not Found' }
  }
];
