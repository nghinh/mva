import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/example/example.routes').then(m => m.exampleRoutes),
  },
];
