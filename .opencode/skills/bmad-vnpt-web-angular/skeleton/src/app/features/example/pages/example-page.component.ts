import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingStateComponent } from '../../../shared/ui/loading-state/loading-state.component';
import { ExampleStore } from '../state/example.store';

@Component({
  selector: 'app-example-page',
  standalone: true,
  imports: [CommonModule, LoadingStateComponent],
  templateUrl: './example-page.component.html',
  styleUrl: './example-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamplePageComponent {
  private readonly store = inject(ExampleStore);
  readonly vm = computed(() => ({
    items: this.store.items(),
    loading: this.store.loading(),
    error: this.store.error(),
  }));

  ngOnInit(): void {
    void this.store.load();
  }
}
