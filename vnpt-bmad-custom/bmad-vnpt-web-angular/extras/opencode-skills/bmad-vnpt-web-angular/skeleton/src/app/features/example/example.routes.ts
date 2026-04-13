import { Routes } from '@angular/router';

export const exampleRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/example-page.component').then(m => m.ExamplePageComponent),
  },
];
