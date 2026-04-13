import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { {{FeatureApi}} } from '../data/{{feature}}.api';
import { {{FeatureModel}} } from '../models/{{feature}}.model';

@Injectable({ providedIn: 'root' })
export class {{FeatureStore}} {
  private readonly api = inject({{FeatureApi}});

  readonly items = signal<{{FeatureModel}}[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const items = await firstValueFrom(this.api.list());
      this.items.set(items);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.loading.set(false);
    }
  }
}
