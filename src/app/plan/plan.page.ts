import { Component, OnInit, OnDestroy, AfterViewInit, AfterViewChecked, ViewChild, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { IonContent, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { DayEntry, WeekState, MenuItem, ResolvedMenuItem, ExtraEntry } from './plan.models';
import { PlanService } from './plan.service';
import { TagService } from '../tags/tag.service';
import { Tag } from '../tags/tag.model';
import { EditorItem } from '../shared/item-editor.component';
import { MealService } from '../meals/meal.service';
import { Meal } from '../meals/meal.model';
import { DbService } from '../shared/db.service';
import { getISOWeek, getISOWeekYear, getMondayOfISOWeek, formatShortDate } from '../shared/week-utils';
import { WeekStateService } from '../shared/week-state.service';

const DAY_NAMES: string[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

@Component({
  selector: 'app-plan',
  standalone: false,
  templateUrl: './plan.page.html',
  styleUrls: ['./plan.page.scss']
})
export class PlanPage implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {

  @ViewChild(IonContent, { read: ElementRef }) private contentRef!: ElementRef;
  @ViewChildren('mealNameEl') private mealNameEls!: QueryList<ElementRef>;

  readonly tagVisibility: Map<string, number> = new Map();
  private tagVisibilityCheckPending = false;
  private tagVisibilityCheckScheduled = false;

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

  extrasEntries: ExtraEntry[] = [];
  extrasPickerVisible: boolean = false;
  extrasPickerMode: 'default' | 'custom' = 'default';
  extrasCustomName: string = '';
  extrasCustomStarred: boolean = false;

  slideDir: 'left' | 'right' | '' = '';

  private longPressTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private itemLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private itemLongPressActive = false;
  private lastWeekNavAt = 0;
  private slideTimer: ReturnType<typeof setTimeout> | null = null;
  private dataChangedSub!: Subscription;
  private backButtonSub: Subscription | null = null;

  constructor(
    private readonly planService: PlanService,
    private readonly tagService: TagService,
    private readonly mealService: MealService,
    private readonly weekState: WeekStateService,
    private readonly db: DbService,
    private readonly platform: Platform,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadWeek(this.weekState.year, this.weekState.isoWeek);
    this.dataChangedSub = this.db.dataChanged$.subscribe(() => {
      this.loadWeek(this.weekState.year, this.weekState.isoWeek);
    });
  }

  ngOnDestroy(): void {
    this.dataChangedSub.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.setupSwipeGesture();
  }

  ngAfterViewChecked(): void {
    if (!this.tagVisibilityCheckPending || this.tagVisibilityCheckScheduled) return;
    this.tagVisibilityCheckScheduled = true;
    setTimeout(() => {
      this.tagVisibilityCheckScheduled = false;
      let changed = false;
      for (const elRef of this.mealNameEls ?? []) {
        const el = elRef.nativeElement as HTMLElement;
        const itemId = el.getAttribute('data-item-id') ?? '';
        if (el.scrollHeight > el.clientHeight + 1) {
          const count = this.tagVisibility.get(itemId) ?? 0;
          if (count > 0) {
            this.tagVisibility.set(itemId, count - 1);
            changed = true;
          }
        }
      }
      if (!changed) this.tagVisibilityCheckPending = false;
    }, 0);
  }

  private initTagVisibility(): void {
    for (const day of this.week?.days ?? []) {
      for (const item of day.items) {
        this.tagVisibility.set(item.id, item.resolvedTags.length);
      }
    }
    this.tagVisibilityCheckPending = true;
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.week &&
        this.week.year === this.weekState.year &&
        this.week.isoWeek === this.weekState.isoWeek) {
      this.tags = await this.tagService.getTags();
      this.week = { ...this.week, days: this.week.days.map(day => this.resolveDay(day)) };
      this.initTagVisibility();
    } else {
      await this.loadWeek(this.weekState.year, this.weekState.isoWeek);
    }
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
      if (this.extrasPickerVisible) {
        if (this.extrasPickerMode === 'custom') { this.extrasPickerMode = 'default'; }
        else { this.closeExtrasPicker(); }
      } else if (this.itemPopupVisible) {
        if (this.pickerMode === 'custom') { this.pickerMode = 'default'; }
        else { this.closeItemPopup(); }
      } else if (this.dayEditorVisible) {
        this.closeDayEditor();
      } else {
        processNextHandler();
      }
    });
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = null;
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
    this.weekState.setWeek(year, isoWeek);
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
    this.extrasEntries = await this.planService.getExtras(year, isoWeek);
    this.week = { year, isoWeek, days };
    this.initTagVisibility();
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
    this.initTagVisibility();
  }

  async removeItem(itemId: string): Promise<void> {
    const dayIdx = this.dayEditorIndex;
    const submenus = (await this.planService.getSubMenus(dayIdx)).filter(it => it.id !== itemId);
    await this.planService.setSubMenus(dayIdx, submenus);
    await this.planService.deleteSubMenuHistory(itemId, dayIdx);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
    this.initTagVisibility();
  }

  async onItemUpdate(event: { id: string; name: string; tagIds: string[] }): Promise<void> {
    const dayIdx = this.dayEditorIndex;
    const submenus = await this.planService.getSubMenus(dayIdx);
    const idx = submenus.findIndex(s => s.id === event.id);
    if (idx < 0) return;
    submenus[idx] = { ...submenus[idx], name: event.name, tagIds: event.tagIds };
    await this.planService.setSubMenus(dayIdx, submenus);
    const { year, isoWeek } = this.week;
    this.week.days[dayIdx] = {
      ...this.week.days[dayIdx],
      items: this.resolveItems(await this.planService.getMenuItems(year, isoWeek, dayIdx))
    };
    this.initTagVisibility();
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
    this.initTagVisibility();
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
      this.pickerTags = [...item.resolvedTags].sort((a, b) => a.name.localeCompare(b.name));
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

  async openExtrasPicker(): Promise<void> {
    const [meals, usageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts()
    ]);
    this.mealUsageCounts = usageCounts;
    this.pickerMeals = meals.sort((a, b) => {
      const ua = usageCounts.get(a.name) ?? 0;
      const ub = usageCounts.get(b.name) ?? 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
    this.extrasPickerMode = 'default';
    this.extrasCustomName = '';
    this.extrasCustomStarred = false;
    this.extrasPickerVisible = true;
  }

  closeExtrasPicker(): void {
    this.extrasPickerVisible = false;
  }

  async selectExtra(meal: Meal): Promise<void> {
    await this.addExtra(meal.name);
    this.closeExtrasPicker();
  }

  async saveExtrasCustom(): Promise<void> {
    const name = this.extrasCustomName.trim();
    if (!name) return;
    if (this.extrasCustomStarred) {
      await this.mealService.saveMeal({ id: this.mealService.createId(), name, tagIds: [], ingredients: [] });
    }
    await this.addExtra(name);
    this.closeExtrasPicker();
  }

  private async addExtra(mealName: string): Promise<void> {
    const { year, isoWeek } = this.week;
    this.extrasEntries = [...this.extrasEntries, { id: this.planService.createItemId(), mealName }];
    await this.planService.setExtras(year, isoWeek, this.extrasEntries);
  }

  async removeExtra(id: string): Promise<void> {
    const { year, isoWeek } = this.week;
    this.extrasEntries = this.extrasEntries.filter(e => e.id !== id);
    await this.planService.setExtras(year, isoWeek, this.extrasEntries);
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
    this.initTagVisibility();
  }
}
