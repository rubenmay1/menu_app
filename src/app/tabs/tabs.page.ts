import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ViewPlanService } from '../shared/view-plan.service';
import { PreferenceService } from '../shared/preference.service';

@Component({
  selector: 'app-tabs',
  standalone: false,
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss']
})
export class TabsPage implements OnInit, OnDestroy {

  isReadMode = false;
  private sub!: Subscription;

  get showPlan(): boolean   { return this.prefs.showPlan; }
  get showList(): boolean   { return this.prefs.showList; }
  get showShared(): boolean { return this.prefs.showShared; }
  get showMeals(): boolean  { return this.prefs.showMeals; }
  get showTags(): boolean   { return this.prefs.showTags; }

  constructor(
    private readonly viewPlan: ViewPlanService,
    private readonly router: Router,
    private readonly prefs: PreferenceService,
  ) {}

  ngOnInit(): void {
    this.sub = this.viewPlan.sharedPlan$.subscribe(data => {
      this.isReadMode = data !== null;
    });
    if (!this.prefs.showPlan) {
      const fallback = this.prefs.showShared ? '/tabs/shared'
        : this.prefs.showList ? '/tabs/shopping'
        : this.prefs.showMeals ? '/tabs/meals'
        : this.prefs.showTags ? '/tabs/tags'
        : '/tabs/settings';
      void this.router.navigate([fallback], { replaceUrl: true });
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  exitReadMode(): void {
    const source = this.viewPlan.entrySource;
    this.viewPlan.exit();
    if (source === 'history') {
      void this.router.navigate(['/tabs/shared']);
    }
  }
}
