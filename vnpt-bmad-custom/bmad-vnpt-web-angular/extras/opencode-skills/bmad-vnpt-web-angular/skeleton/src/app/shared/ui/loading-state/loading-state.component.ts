import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  template: '<p>Loading…</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {}
