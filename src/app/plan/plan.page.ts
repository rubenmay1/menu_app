import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { DayEntry, WeekState, MenuItem, ResolvedMenuItem } from './plan.models';
import { PlanService } from './plan.service';
import { TagService } from '../tags/tag.service';
import { Tag } from '../tags/tag.model';
import { EditorItem } from '../shared/item-editor.component';
import { MealService } from '../meals/meal.service';
import { Meal } from '../meals/meal.model';
import { getISOWeek, getISOWeekYear, getMondayOfISOWeek, formatShortDate } from '../shared/week-utils';

const DAY_NAMES: string[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

@Component({
  selector: 'app-plan',
  standalone: false,
  templateUrl: './plan.page.html',
  styleUrls: ['./plan.page.scss']
})
export class PlanPage implements OnInit, AfterViewInit {

  @ViewChild(IonContent, { read: ElementRef }) private contentRef!: ElementRef;

  week!: WeekState;
  tags: Tag[] = [];

  // Day editor (long-press)
  dayEditorVisible: boolean = false;
  dayEditorIndex: number = -1;

  // Item picker popup (tap)
  itemPopupVisible: boolean = false;
  itemPopupItem: ResolvedMenuItem | null = null;
  itemPopupDayIndex: number = -1;
  pickerMode: 'default' | 'custom' = 'default';
  customName: string = '';
  customStarred: boolean = false;
  pickerMeals: Meal[] = [];
  pickerTags: Tag[] = [];

  private longPressTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private readonly planService: PlanService,
    private readonly tagService: TagService,
    private readonly mealService: MealService
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.loadWeek(getISOWeekYear(today), getISOWeek(today));
  }

  ngAfterViewInit(): void {
    this.setupSwipeGesture();
  }

  ionViewWillEnter(): void {
    if (this.week) {
      this.tags = this.tagService.getTags();
      this.week = { ...this.week, days: this.week.days.map(day => this.resolveDay(day)) };
    }
  }

  isDayComplete(day: DayEntry): boolean {
    return day.items.length > 0 && day.items.every(item => !!(item.mealName?.trim()));
  }

  get isWeekComplete(): boolean {
    if (!this.week) return false;
    const daysWithItems = this.week.days.filter(d => d.items.length > 0);
    return daysWithItems.length > 0 && daysWithItems.every(d => this.isDayComplete(d));
  }

  private resolveDay(day: DayEntry): DayEntry {
    return {
      ...day,
      items: day.items.map(item => {
        const resolvedTags = item.tagIds.map(id => {
          const tag = this.tagService.getTagById(id);
          return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
        }).filter((t): t is { id: string; name: string; color: string } => t !== null);
        return { ...item, resolvedTags };
      })
    };
  }

  private resolveItems(items: MenuItem[]): ResolvedMenuItem[] {
    return items.map(it => {
      const resolvedTags = it.tagIds.map(id => {
        const tag = this.tagService.getTagById(id);
        return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
      }).filter((t): t is { id: string; name: string; color: string } => t !== null);
      return {
        id: it.id,
        name: it.name,
        tagIds: it.tagIds,
        starred: it.starred,
        mealName: it.mealName,
        resolvedTags
      };
    });
  }

  private setupSwipeGesture(): void {
    const el = this.contentRef?.nativeElement as HTMLElement;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    const SWIPE_THRESHOLD = 60;
    const MAX_VERTICAL_RATIO = 0.5;
    el.addEventListener('touchstart', (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(dx) > SWIPE_THRESHOLD && dy / Math.abs(dx) < MAX_VERTICAL_RATIO) {
        if (dx < 0) { this.goToNextWeek(); } else { this.goToPreviousWeek(); }
      }
    }, { passive: true });
  }

  goToPreviousWeek(): void {
    const { year, isoWeek } = this.week;
    if (isoWeek === 1) {
      this.loadWeek(year - 1, this.getLastISOWeekOfYear(year - 1));
    } else {
      this.loadWeek(year, isoWeek - 1);
    }
  }

  goToNextWeek(): void {
    const { year, isoWeek } = this.week;
    const lastWeek = this.getLastISOWeekOfYear(year);
    if (isoWeek >= lastWeek) {
      this.loadWeek(year + 1, 1);
    } else {
      this.loadWeek(year, isoWeek + 1);
    }
  }

  private getLastISOWeekOfYear(year: number): number {
    return getISOWeek(new Date(Date.UTC(year, 11, 28)));
  }

  private loadWeek(year: number, isoWeek: number): void {
    this.tags = this.tagService.getTags();
    const monday = getMondayOfISOWeek(year, isoWeek);
    const days: DayEntry[] = DAY_NAMES.map((name, i) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      return {
        dayIndex: i,
        dayName: name,
        date,
        displayDate: formatShortDate(date),
        items: this.resolveItems(this.planService.getMenuItems(year, isoWeek, i))
      };
    });
    this.week = { year, isoWeek, days };
  }

  // Long-press → day editor
  onDayPointerDown(dayIndex: number): void {
    const timer = setTimeout(() => { this.openDayEditor(dayIndex); }, 500);
    this.longPressTimers.set(dayIndex, timer);
  }

  onDayPointerUp(dayIndex: number): void {
    this.cancelLongPress(dayIndex);
  }

  onDayPointerLeave(dayIndex: number): void {
    this.cancelLongPress(dayIndex);
  }

  private cancelLongPress(dayIndex: number): void {
    const timer = this.longPressTimers.get(dayIndex);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.longPressTimers.delete(dayIndex);
    }
  }

  openDayEditor(dayIndex: number): void {
    this.dayEditorIndex = dayIndex;
    this.dayEditorVisible = true;
  }

  closeDayEditor(): void {
    this.dayEditorVisible = false;
    this.dayEditorIndex = -1;
  }

  get editorDay(): DayEntry | null {
    return this.dayEditorIndex >= 0 ? this.week.days[this.dayEditorIndex] : null;
  }

  onItemAdd(event: { name: string; tagIds: string[] }): void {
    const dayIdx = this.dayEditorIndex;
    const submenus = this.planService.getSubMenus(dayIdx);
    submenus.push({ id: this.planService.createItemId(), name: event.name, tagIds: event.tagIds });
    this.planService.setSubMenus(dayIdx, submenus);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
  }

  removeItem(itemId: string): void {
    const dayIdx = this.dayEditorIndex;
    const submenus = this.planService.getSubMenus(dayIdx).filter(it => it.id !== itemId);
    this.planService.setSubMenus(dayIdx, submenus);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
  }

  handleReorder(reordered: EditorItem[]): void {
    const dayIdx = this.dayEditorIndex;
    const existingItems = this.week.days[dayIdx].items;
    const items: ResolvedMenuItem[] = reordered.map(e => {
      const existing = existingItems.find(it => it.id === e.id);
      return {
        id: e.id,
        name: e.name,
        tagIds: e.tagIds ?? [],
        starred: existing?.starred,
        mealName: existing?.mealName,
        resolvedTags: e.resolvedTags ?? []
      };
    });
    this.week.days[dayIdx] = { ...this.week.days[dayIdx], items };
    this.planService.setSubMenus(dayIdx,
      items.map(it => ({ id: it.id, name: it.name, tagIds: it.tagIds }))
    );
  }

  // Tap item → picker popup
  openItemPopup(item: ResolvedMenuItem, dayIndex: number): void {
    this.itemPopupItem = item;
    this.itemPopupDayIndex = dayIndex;
    this.pickerMode = 'default';
    this.customName = '';
    this.customStarred = false;
    const meals = this.mealService.getMeals();
    if (item.tagIds.length > 0) {
      this.pickerMeals = meals.filter(m => m.tagId !== null && item.tagIds.includes(m.tagId));
      this.pickerTags = item.resolvedTags;
    } else {
      this.pickerMeals = meals;
      this.pickerTags = [];
    }
    this.pickerMeals.sort((a, b) => a.name.localeCompare(b.name));
    this.itemPopupVisible = true;
  }

  closeItemPopup(): void {
    this.itemPopupVisible = false;
    this.itemPopupItem = null;
    this.itemPopupDayIndex = -1;
  }

  setBlank(): void {
    if (!this.itemPopupItem) return;
    this.saveItemUpdate({ mealName: '', starred: false });
    this.closeItemPopup();
  }

  setDashed(): void {
    if (!this.itemPopupItem) return;
    this.saveItemUpdate({ mealName: '--', starred: false });
    this.closeItemPopup();
  }

  openCustomMode(): void {
    this.pickerMode = 'custom';
    this.customName = '';
    this.customStarred = false;
  }

  toggleCustomStar(): void {
    this.customStarred = !this.customStarred;
  }

  saveCustom(): void {
    const name = this.customName.trim();
    if (!name || !this.itemPopupItem) return;
    if (this.customStarred) {
      this.mealService.saveMeal({
        id: this.mealService.createId(),
        name,
        tagId: this.itemPopupItem.tagIds[0] ?? null,
        ingredients: []
      });
    }
    this.saveItemUpdate({ mealName: name, starred: this.customStarred });
    this.closeItemPopup();
  }

  selectMeal(meal: Meal): void {
    if (!this.itemPopupItem) return;
    this.saveItemUpdate({ mealName: meal.name, starred: false });
    this.closeItemPopup();
  }

  private saveItemUpdate(changes: { mealName?: string; starred?: boolean }): void {
    const item = this.itemPopupItem!;
    const dayIndex = this.itemPopupDayIndex;
    const { year, isoWeek } = this.week;
    const entries = this.planService.getWeekMeals(year, isoWeek, dayIndex);
    const idx = entries.findIndex(e => e.itemId === item.id);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...changes };
    } else {
      entries.push({ itemId: item.id, ...changes });
    }
    this.planService.setWeekMeals(year, isoWeek, dayIndex, entries);
    this.week.days[dayIndex] = {
      ...this.week.days[dayIndex],
      items: this.resolveItems(this.planService.getMenuItems(year, isoWeek, dayIndex))
    };
  }
}
