import { Component, Input, Output, EventEmitter } from '@angular/core';
import { getISOWeek, getISOWeekYear } from './week-utils';

@Component({
  selector: 'app-week-nav',
  standalone: false,
  templateUrl: './week-nav.component.html',
  styleUrls: ['./week-nav.component.scss'],
})
export class WeekNavComponent {
  @Input() isoWeek = 0;
  @Input() year = 0;
  @Input() showArrows = true;
  @Input() showShare = false;
  @Input() showClear = false;

  @Output() readonly previousWeek = new EventEmitter<void>();
  @Output() readonly nextWeek = new EventEmitter<void>();
  @Output() readonly currentWeek = new EventEmitter<void>();
  @Output() readonly share = new EventEmitter<void>();
  @Output() readonly clearWeek = new EventEmitter<void>();

  get isCurrentWeek(): boolean {
    const today = new Date();
    return this.isoWeek === getISOWeek(today) && this.year === getISOWeekYear(today);
  }
}
