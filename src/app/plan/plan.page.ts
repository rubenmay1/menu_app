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

  dayEditorVisible: boolean = false;
  dayEditorIndex: number = -1;

  itemPopupVisible: boolean = false;
  itemPopupItem: ResolvedMenuItem | null = null;
  itemPopupDayIndex: number = -1;
  pickerMode: 'default' | 'custom' = 'default';
  customName: string = '';
  customStarred: boolean = false;
  pickerMeals: Meal[] = [];
  pickerTags: Tag[] = [];
  mealUsageCounts: Map<string, number> = new Map();

  slideDir: 'left' | 'right' | '' = '';

  private longPressTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private itemLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private itemLongPressActive = false;
  private lastWeekNavAt = 0;
  private slideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly planService: PlanService,
    private readonly tagService: TagService,
    private readonly mealService: MealService
  ) {}

  async ngOnInit(): Promise<void> {
    const today = new Date();
    await this.loadWeek(getISOWeekYear(today), getISOWeek(today));
  }

  ngAfterViewInit(): void {
    this.setupSwipeGesture();
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.week) {
      this.tags = await this.tagService.getTags();
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
          const tag = this.tags.find(t => t.id === id);
          return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
        }).filter((t): t is { id: string; name: string; color: string } => t !== null);
        return { ...item, resolvedTags };
      })
    };
  }

  private resolveItems(items: MenuItem[]): ResolvedMenuItem[] {
    return items.map(it => {
      const resolvedTags = it.tagIds.map(id => {
        const tag = this.tags.find(t => t.id === id);
        return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
      }).filter((t): t is { id: string; name: string; color: string } => t !== null);
      return {
        id: it.id,
        name: it.name,
        tagIds: it.tagIds,
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
        if (dx < 0) { void this.goToNextWeek(); } else { void this.goToPreviousWeek(); }
      }
    }, { passive: true });
  }

  async goToPreviousWeek(): Promise<void> {
    const now = Date.now();
    if (now - this.lastWeekNavAt < 400) return;
    this.lastWeekNavAt = now;
    this.startSlide('left');
    const { year, isoWeek } = this.week;
    if (isoWeek === 1) {
      await this.loadWeek(year - 1, this.getLastISOWeekOfYear(year - 1));
    } else {
      await this.loadWeek(year, isoWeek - 1);
    }
  }

  async goToNextWeek(): Promise<void> {
    const now = Date.now();
    if (now - this.lastWeekNavAt < 400) return;
    this.lastWeekNavAt = now;
    this.startSlide('right');
    const { year, isoWeek } = this.week;
    const lastWeek = this.getLastISOWeekOfYear(year);
    if (isoWeek >= lastWeek) {
      await this.loadWeek(year + 1, 1);
    } else {
      await this.loadWeek(year, isoWeek + 1);
    }
  }

  async goToCurrentWeek(): Promise<void> {
    const now = Date.now();
    if (now - this.lastWeekNavAt < 400) return;
    const today = new Date();
    const targetYear = getISOWeekYear(today);
    const targetWeek = getISOWeek(today);
    if (targetYear === this.week.year && targetWeek === this.week.isoWeek) return;
    this.lastWeekNavAt = now;
    const isForward = targetYear > this.week.year ||
      (targetYear === this.week.year && targetWeek > this.week.isoWeek);
    this.startSlide(isForward ? 'right' : 'left');
    await this.loadWeek(targetYear, targetWeek);
  }

  private startSlide(dir: 'left' | 'right'): void {
    if (this.slideTimer !== null) clearTimeout(this.slideTimer);
    this.slideDir = dir;
    this.slideTimer = setTimeout(() => {
      this.slideDir = '';
      this.slideTimer = null;
    }, 250);
  }

  private getLastISOWeekOfYear(year: number): number {
    return getISOWeek(new Date(Date.UTC(year, 11, 28)));
  }

  private async loadWeek(year: number, isoWeek: number): Promise<void> {
    this.tags = await this.tagService.getTags();
    const monday = getMondayOfISOWeek(year, isoWeek);
    const days = await Promise.all(DAY_NAMES.map(async (name, i) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      return {
        dayIndex: i,
        dayName: name,
        date,
        displayDate: formatShortDate(date),
        items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, i))
      };
    }));
    this.week = { year, isoWeek, days };
  }

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

  onItemPointerDown(dayIndex: number): void {
    this.itemLongPressTimer = setTimeout(() => {
      this.itemLongPressActive = true;
      this.itemLongPressTimer = null;
      this.openDayEditor(dayIndex);
    }, 500);
  }

  onItemPointerUp(): void {
    if (this.itemLongPressTimer !== null) {
      clearTimeout(this.itemLongPressTimer);
      this.itemLongPressTimer = null;
    }
  }

  onItemPointerLeave(): void {
    if (this.itemLongPressTimer !== null) {
      clearTimeout(this.itemLongPressTimer);
      this.itemLongPressTimer = null;
    }
  }

  onItemClick(item: ResolvedMenuItem, dayIndex: number): void {
    if (this.itemLongPressActive) {
      this.itemLongPressActive = false;
      return;
    }
    void this.openItemPopup(item, dayIndex);
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

  async onItemAdd(event: { name: string; tagIds: string[] }): Promise<void> {
    const dayIdx = this.dayEditorIndex;
    const submenus = await this.planService.getSubMenus(dayIdx);
    submenus.push({ id: this.planService.createItemId(), name: event.name, tagIds: event.tagIds });
    await this.planService.setSubMenus(dayIdx, submenus);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
  }

  async removeItem(itemId: string): Promise<void> {
    const dayIdx = this.dayEditorIndex;
    const submenus = (await this.planService.getSubMenus(dayIdx)).filter(it => it.id !== itemId);
    await this.planService.setSubMenus(dayIdx, submenus);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
  }

  async handleReorder(reordered: EditorItem[]): Promise<void> {
    const dayIdx = this.dayEditorIndex;
    const existingItems = this.week.days[dayIdx].items;
    const items: ResolvedMenuItem[] = reordered.map(e => {
      const existing = existingItems.find(it => it.id === e.id);
      return {
        id: e.id,
        name: e.name,
        tagIds: e.tagIds ?? [],
        mealName: existing?.mealName,
        resolvedTags: e.resolvedTags ?? []
      };
    });
    this.week.days[dayIdx] = { ...this.week.days[dayIdx], items };
    await this.planService.setSubMenus(dayIdx,
      items.map(it => ({ id: it.id, name: it.name, tagIds: it.tagIds }))
    );
  }

  async openItemPopup(item: ResolvedMenuItem, dayIndex: number): Promise<void> {
    this.itemPopupItem = item;
    this.itemPopupDayIndex = dayIndex;
    this.pickerMode = 'default';
    this.customName = '';
    this.customStarred = false;
    const [meals, usageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts()
    ]);
    this.mealUsageCounts = usageCounts;
    if (item.tagIds.length > 0) {
      this.pickerMeals = meals.filter(m => m.tagIds.length === 0 || m.tagIds.some(tid => item.tagIds.includes(tid)));
      this.pickerTags = item.resolvedTags;
    } else {
      this.pickerMeals = meals;
      this.pickerTags = [];
    }
    this.pickerMeals.sort((a, b) => {
      const ua = this.mealUsageCounts.get(a.name) ?? 0;
      const ub = this.mealUsageCounts.get(b.name) ?? 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
    this.itemPopupVisible = true;
  }

  closeItemPopup(): void {
    this.itemPopupVisible = false;
    this.itemPopupItem = null;
    this.itemPopupDayIndex = -1;
  }

  async setNone(): Promise<void> {
    if (!this.itemPopupItem) return;
    await this.saveItemUpdate({ mealName: 'None' });
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

  async saveCustom(): Promise<void> {
    const name = this.customName.trim();
    if (!name || !this.itemPopupItem) return;
    if (this.customStarred) {
      await this.mealService.saveMeal({
        id: this.mealService.createId(),
        name,
        tagIds: [],
        ingredients: []
      });
    }
    await this.saveItemUpdate({ mealName: name });
    this.closeItemPopup();
  }

  getMatchingTags(meal: Meal): { id: string; name: string; color: string }[] {
    if (!this.itemPopupItem || this.itemPopupItem.tagIds.length === 0) return [];
    return meal.tagIds
      .filter(tid => this.itemPopupItem!.tagIds.includes(tid))
      .map(tid => this.tags.find(t => t.id === tid))
      .filter((t): t is Tag => t !== null && t !== undefined)
      .map(t => ({ id: t.id, name: t.name, color: t.color }));
  }

  async selectMeal(meal: Meal): Promise<void> {
    if (!this.itemPopupItem) return;
    await this.saveItemUpdate({ mealName: meal.name });
    this.closeItemPopup();
  }

  private async saveItemUpdate(changes: { mealName?: string }): Promise<void> {
    const item = this.itemPopupItem!;
    const dayIndex = this.itemPopupDayIndex;
    const { year, isoWeek } = this.week;
    const entries = await this.planService.getWeekMeals(year, isoWeek, dayIndex);
    const idx = entries.findIndex(e => e.itemId === item.id);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...changes };
    } else {
      entries.push({ itemId: item.id, ...changes });
    }
    await this.planService.setWeekMeals(year, isoWeek, dayIndex, entries);
    this.week.days[dayIndex] = {
      ...this.week.days[dayIndex],
      items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, dayIndex))
    };
  }
}
