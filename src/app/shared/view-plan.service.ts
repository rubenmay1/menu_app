import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SharedPlanData } from '../plan/plan.models';

@Injectable({ providedIn: 'root' })
export class ViewPlanService {
  private readonly subject = new BehaviorSubject<SharedPlanData | null>(null);
  readonly sharedPlan$: Observable<SharedPlanData | null> = this.subject.asObservable();

  enter(data: SharedPlanData): void { this.subject.next(data); }
  exit(): void { this.subject.next(null); }
  get isActive(): boolean { return this.subject.value !== null; }
}
