import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { {{FeatureStore}} } from '../state/{{feature}}.store';

@Component({
  selector: 'app-{{feature}}-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './{{feature}}-page.component.html',
  styleUrl: './{{feature}}-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {{FeaturePageComponent}} {
  private readonly store = inject({{FeatureStore}});

  readonly vm = computed(() => ({
    items: this.store.items(),
    loading: this.store.loading(),
    error: this.store.error(),
  }));

  ngOnInit(): void {
    this.store.load();
  }
}
