import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { SharedPlanRecord } from '../plan/plan.models';
import { SharedPlansService, SharedPlanGroup } from './shared-plans.service';
import { ViewPlanService } from '../shared/view-plan.service';

@Component({
  selector: 'app-shared-plans',
  standalone: false,
  templateUrl: './shared-plans.page.html',
  styleUrls: ['./shared-plans.page.scss'],
})
export class SharedPlansPage implements OnInit {

  groups: SharedPlanGroup[] = [];
  deleteTargetGuid: string | null = null;

  private longPressTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private backButtonSub: Subscription | null = null;

  constructor(
    private readonly sharedPlans: SharedPlansService,
    private readonly viewPlan: ViewPlanService,
    private readonly router: Router,
    private readonly platform: Platform,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  ionViewWillEnter(): void {
    this.reload();
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
      if (this.deleteTargetGuid !== null) {
        this.cancelDelete();
      } else {
        processNextHandler();
      }
    });
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = null;
  }

  private reload(): void {
    this.groups = this.sharedPlans.getGroups();
  }

  openPlan(record: SharedPlanRecord): void {
    this.viewPlan.enter(record.data, 'history');
    void this.router.navigate(['/tabs/plan']);
  }

  onPointerDown(guid: string): void {
    const timer = setTimeout(() => {
      this.longPressTimers.delete(guid);
      this.deleteTargetGuid = guid;
    }, 500);
    this.longPressTimers.set(guid, timer);
  }

  onPointerUp(guid: string): void {
    this.cancelLongPress(guid);
  }

  onPointerLeave(guid: string): void {
    this.cancelLongPress(guid);
  }

  private cancelLongPress(guid: string): void {
    const timer = this.longPressTimers.get(guid);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.longPressTimers.delete(guid);
    }
  }

  confirmDelete(): void {
    if (this.deleteTargetGuid !== null) {
      this.sharedPlans.delete(this.deleteTargetGuid);
      this.deleteTargetGuid = null;
      this.reload();
    }
  }

  cancelDelete(): void {
    this.deleteTargetGuid = null;
  }

  recordTitle(record: SharedPlanRecord): string {
    return `Week ${record.isoWeek} – ${record.year}`;
  }
}
