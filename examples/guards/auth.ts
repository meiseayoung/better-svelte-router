/**
 * Authentication Guard Example
 * Demonstrates beforeEach and afterEach usage
 */
import { beforeEach, afterEach, matchRoute } from 'better-svelte-router';
import { routes } from '../routes';

// Simulated user state (use state management in real projects)
export const authState = {
  isAuthenticated: false,
  isAdmin: false,
  user: null as { id: string; name: string; role: string } | null
};

// Simulated login
export function login(username: string, password: string): boolean {
  // In real projects, call API here
  if (username === 'admin' && password === 'admin') {
    authState.isAuthenticated = true;
    authState.isAdmin = true;
    authState.user = { id: '1', name: 'Admin', role: 'admin' };
    return true;
  }
  if (username === 'user' && password === 'user') {
    authState.isAuthenticated = true;
    authState.isAdmin = false;
    authState.user = { id: '2', name: 'User', role: 'user' };
    return true;
  }
  return false;
}

// Simulated logout
export function logout(): void {
  authState.isAuthenticated = false;
  authState.isAdmin = false;
  authState.user = null;
}

/**
 * Setup authentication guard
 */
export function setupAuthGuard(): void {
  // Before guard - route access control
  beforeEach((from, to) => {
    const matched = matchRoute(routes, to);
    
    if (!matched) {
      return true; // Let 404 page handle it
    }

    const { meta } = matched;

    // Check if login is required
    if (meta.requiresAuth && !authState.isAuthenticated) {
      console.log(`[Guard] Login required, redirecting to /login`);
      return '/login';
    }

    // Check if admin permission is required
    if (meta.requiresAdmin && !authState.isAdmin) {
      console.log(`[Guard] Admin permission required, redirecting to /home`);
      return '/home';
    }

    // Redirect logged-in users away from login page
    if (to === '/login' && authState.isAuthenticated) {
      console.log(`[Guard] Already logged in, redirecting to /home`);
      return '/home';
    }

    return true;
  });

  // After hook - page view tracking
  afterEach((from, to) => {
    console.log(`[Analytics] Page view: ${from} -> ${to}`);
    
    // In real projects, send analytics data
    // analytics.trackPageView(to);
  });
}
