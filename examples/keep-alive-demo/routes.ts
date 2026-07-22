import type { IRoute } from 'better-svelte-router';
import DemoLayout from './DemoLayout.svelte';
import DraftPage from './pages/DraftPage.svelte';
import CounterPage from './pages/CounterPage.svelte';
import FreshPage from './pages/FreshPage.svelte';

export const routes: IRoute[] = [
  {
    path: '/',
    redirect: '/draft',
  },
  {
    path: '/',
    component: DemoLayout,
    // deep: children inherit keep-alive unless they opt out
    meta: {
      keepAlive: { deep: true },
    },
    children: [
      {
        path: 'draft',
        component: DraftPage,
        meta: {
          title: 'Draft (keep-alive via deep)',
        },
      },
      {
        path: 'counter',
        component: CounterPage,
        meta: {
          title: 'Counter (keep-alive via deep)',
        },
      },
      {
        path: 'fresh',
        component: FreshPage,
        meta: {
          title: 'Fresh (opt-out)',
        },
      },
    ],
  },
];
