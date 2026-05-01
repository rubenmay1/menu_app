import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SharedPlanData } from '../plan/plan.models';

export type ViewPlanSource = 'link' | 'history';

@Injectable({ providedIn: 'root' })
export class ViewPlanService {
  private readonly subject = new BehaviorSubject<SharedPlanData | null>(null);
  readonly sharedPlan$: Observable<SharedPlanData | null> = this.subject.asObservable();

  private source: ViewPlanSource = 'link';

  enter(data: SharedPlanData, source: ViewPlanSource = 'link'): void {
    this.source = source;
    this.subject.next(data);
  }

  exit(): void { this.subject.next(null); }

  get isActive(): boolean { return this.subject.value !== null; }
  get entrySource(): ViewPlanSource { return this.source; }
}
