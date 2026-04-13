import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { {{FeatureModel}} } from '../models/{{feature}}.model';

@Injectable({ providedIn: 'root' })
export class {{FeatureApi}} {
  private readonly http = inject(HttpClient);

  list(): Observable<{{FeatureModel}}[]> {
    return this.http.get<{{FeatureModel}}[]>('/api/{{feature}}');
  }
}
