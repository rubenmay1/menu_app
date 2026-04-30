import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ViewPlanService } from '../shared/view-plan.service';

@Component({
  selector: 'app-tabs',
  standalone: false,
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss']
})
export class TabsPage implements OnInit, OnDestroy {

  isReadMode = false;
  private sub!: Subscription;

  constructor(private readonly viewPlan: ViewPlanService) {}

  ngOnInit(): void {
    this.sub = this.viewPlan.sharedPlan$.subscribe(data => {
      this.isReadMode = data !== null;
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  exitReadMode(): void {
    this.viewPlan.exit();
  }
}
