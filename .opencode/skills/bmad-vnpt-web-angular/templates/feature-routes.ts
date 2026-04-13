import { Routes } from '@angular/router';

export const {{feature}}Routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/{{feature}}-page.component').then(m => m.{{FeaturePageComponent}}),
  },
];
