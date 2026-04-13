import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExampleApi } from '../data/example.api';
import { ExampleModel } from '../models/example.model';

@Injectable({ providedIn: 'root' })
export class ExampleStore {
  private readonly api = inject(ExampleApi);

  readonly items = signal<ExampleModel[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.loading.set(false);
    }
  }
}
