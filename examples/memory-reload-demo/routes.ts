import type { IRoute } from 'better-svelte-router';
import DemoLayout from './DemoLayout.svelte';
import HomePage from './pages/HomePage.svelte';
import ListPage from './pages/ListPage.svelte';
import DetailPage from './pages/DetailPage.svelte';

export const routes: IRoute[] = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/',
    component: DemoLayout,
    children: [
      {
        path: 'home',
        component: HomePage,
        meta: { title: 'Home' },
      },
      {
        path: 'list',
        component: ListPage,
        meta: { title: 'List' },
      },
      {
        path: 'detail/:id',
        component: DetailPage,
        meta: { title: 'Detail' },
      },
    ],
  },
];
