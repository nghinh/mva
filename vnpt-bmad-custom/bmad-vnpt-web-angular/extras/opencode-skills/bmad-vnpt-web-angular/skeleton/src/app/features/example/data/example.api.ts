import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExampleModel } from '../models/example.model';

@Injectable({ providedIn: 'root' })
export class ExampleApi {
  private readonly http = inject(HttpClient);

  list(): Observable<ExampleModel[]> {
    return this.http.get<ExampleModel[]>('/api/examples');
  }
}
