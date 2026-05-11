import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private read(key: string): boolean {
    const v = localStorage.getItem(key);
    return v === null ? true : v === 'true';
  }

  private write(key: string, value: boolean): void {
    localStorage.setItem(key, String(value));
  }

  get showPlan(): boolean  { return this.read('pref-show-plan'); }
  set showPlan(v: boolean) { this.write('pref-show-plan', v); }

  get showList(): boolean  { return this.read('pref-show-list'); }
  set showList(v: boolean) { this.write('pref-show-list', v); }

  get showShared(): boolean  { return this.read('pref-show-shared'); }
  set showShared(v: boolean) { this.write('pref-show-shared', v); }

  get showMeals(): boolean  { return this.read('pref-show-meals'); }
  set showMeals(v: boolean) { this.write('pref-show-meals', v); }

  get showTags(): boolean  { return this.read('pref-show-tags'); }
  set showTags(v: boolean) { this.write('pref-show-tags', v); }

  get colouredCards(): boolean  { return localStorage.getItem('pref-coloured-cards') === 'true'; }
  set colouredCards(v: boolean) { this.write('pref-coloured-cards', v); }

  get frozenThresholdWeeks(): number {
    const v = localStorage.getItem('pref-frozen-threshold-weeks');
    return v !== null ? Math.max(1, parseInt(v, 10)) : 4;
  }
  set frozenThresholdWeeks(v: number) {
    localStorage.setItem('pref-frozen-threshold-weeks', String(Math.max(1, v)));
  }
}
