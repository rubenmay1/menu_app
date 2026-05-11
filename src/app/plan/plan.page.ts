import { Component, OnInit, OnDestroy, AfterViewInit, AfterViewChecked, ViewChild, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, Platform } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import * as LZString from 'lz-string';
import { Subscription } from 'rxjs';
import { DayEntry, WeekState, MenuItem, ResolvedMenuItem, ExtraEntry, SharedPlanData } from './plan.models';
import { PlanService } from './plan.service';
import { TagService } from '../tags/tag.service';
import { Tag } from '../tags/tag.model';
import { EditorItem } from '../shared/item-editor.component';
import { MealService } from '../meals/meal.service';
import { Meal } from '../meals/meal.model';
import { DbService } from '../shared/db.service';
import { ViewPlanService } from '../shared/view-plan.service';
import { PreferenceService } from '../shared/preference.service';
import { getISOWeek, getISOWeekYear, getMondayOfISOWeek, formatShortDate } from '../shared/week-utils';
import { WeekStateService } from '../shared/week-state.service';
import { ComponentOverflowService } from '../shared/component-overflow.service';

const DAY_NAMES: string[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

@Component({
  selector: 'app-plan',
  standalone: false,
  templateUrl: './plan.page.html',
  styleUrls: ['./plan.page.scss'],
  providers: [ComponentOverflowService]
})
export class PlanPage implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {

  @ViewChild(IonContent, { read: ElementRef }) private contentRef!: ElementRef;
  @ViewChildren('mealNameEl') private mealNameEls!: QueryList<ElementRef>;
  @ViewChildren('pickerMealEl') private pickerMealEls!: QueryList<ElementRef>;

  readonly pickerOverflowSvc = new ComponentOverflowService();

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
  pickerFilterActive = true;
  private allPickerMeals: Meal[] = [];
  mealUsageCounts: Map<string, number> = new Map();
  mealLastUsedDates: Map<string, Date> = new Map();
  snowTooltipText: string | null = null;
  snowTooltipTop: number | null = null;
  snowTooltipFading = false;
  private snowTooltipTimer: ReturnType<typeof setTimeout> | null = null;

  pickerSearchQuery: string = '';
  extrasPickerSearchQuery: string = '';

  extrasEntries: ExtraEntry[] = [];
  extrasPickerVisible: boolean = false;
  extrasPickerMode: 'default' | 'custom' = 'default';
  extrasCustomName: string = '';
  extrasCustomStarred: boolean = false;

  mealActionVisible: boolean = false;
  mealActionItem: ResolvedMenuItem | null = null;
  mealActionDayIndex: number = -1;
  mealActionMeal: Meal | null = null;

  readMode = false;
  clearWeekPromptVisible = false;

  slideDir: 'left' | 'right' | '' = '';

  private longPressTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private itemLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private itemLongPressActive = false;
  private lastWeekNavAt = 0;
  private slideTimer: ReturnType<typeof setTimeout> | null = null;
  private dataChangedSub!: Subscription;
  private viewPlanSub!: Subscription;
  private backButtonSub: Subscription | null = null;

  constructor(
    private readonly planService: PlanService,
    private readonly tagService: TagService,
    private readonly mealService: MealService,
    private readonly weekState: WeekStateService,
    private readonly db: DbService,
    private readonly viewPlanService: ViewPlanService,
    private readonly prefs: PreferenceService,
    private readonly platform: Platform,
    private readonly router: Router,
    readonly overflowSvc: ComponentOverflowService,
  ) {
    overflowSvc.configure(6, [
      { fromStage: 6, maxChips: 0 },
      { fromStage: 5, maxChips: 1 },
      { fromStage: 2, maxChips: 2 },
    ]);
    this.pickerOverflowSvc.configure(4, [
      { fromStage: 4, maxChips: 0 },
      { fromStage: 3, maxChips: 1 },
      { fromStage: 2, maxChips: 2 },
    ]);
  }

  async ngOnInit(): Promise<void> {
    await this.loadWeek(this.weekState.year, this.weekState.isoWeek);
    this.dataChangedSub = this.db.dataChanged$.subscribe(() => {
      if (!this.readMode) void this.loadWeek(this.weekState.year, this.weekState.isoWeek);
    });
    this.viewPlanSub = this.viewPlanService.sharedPlan$.subscribe(data => {
      if (data) {
        this.readMode = true;
        this.week = this.sharedToWeek(data);
        this.extrasEntries = data.extras;
        this.initItemStages();
      } else {
        this.readMode = false;
        void this.loadWeek(this.weekState.year, this.weekState.isoWeek);
      }
    });
  }

  ngOnDestroy(): void {
    this.dataChangedSub.unsubscribe();
    this.viewPlanSub.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.setupSwipeGesture();
  }

  ngAfterViewChecked(): void {
    this.overflowSvc.afterViewChecked(this.mealNameEls);
    this.pickerOverflowSvc.afterViewChecked(this.pickerMealEls);
  }

  private initItemStages(): void {
    const ids = (this.week?.days ?? []).reduce<string[]>((acc, d) => acc.concat(d.items.map(it => it.id)), []);
    this.overflowSvc.init(ids);
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.readMode) {
      if (this.week &&
          this.week.year === this.weekState.year &&
          this.week.isoWeek === this.weekState.isoWeek) {
        this.tags = await this.tagService.getTags();
        this.week = { ...this.week, days: this.week.days.map(day => this.resolveDay(day)) };
        this.initItemStages();
      } else {
        await this.loadWeek(this.weekState.year, this.weekState.isoWeek);
      }
    }
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
      if (this.clearWeekPromptVisible) {
        this.onClearWeekCancel();
      } else if (this.mealActionVisible) {
        this.closeMealActionPopup();
      } else if (this.extrasPickerVisible) {
        if (this.extrasPickerMode === 'custom') { this.extrasPickerMode = 'default'; }
        else { this.closeExtrasPicker(); }
      } else if (this.itemPopupVisible) {
        if (this.pickerMode === 'custom') { this.pickerMode = 'default'; }
        else { this.closeItemPopup(); }
      } else if (this.dayEditorVisible) {
        this.closeDayEditor();
      } else if (this.readMode && this.viewPlanService.entrySource === 'history') {
        this.viewPlanService.exit();
        void this.router.navigate(['/tabs/shared']);
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

  getDayStatus(day: DayEntry): 'past' | 'today' | 'future' {
    if (!this.prefs.colouredCards) return 'future';
    const now = new Date();
    const todayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dayTime = day.date.getTime();
    if (dayTime < todayTime) return 'past';
    if (dayTime === todayTime) return 'today';
    return 'future';
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

  openClearWeekPrompt(): void {
    this.clearWeekPromptVisible = true;
  }

  onClearWeekCancel(): void {
    this.clearWeekPromptVisible = false;
  }

  async onClearWeekConfirm(): Promise<void> {
    this.clearWeekPromptVisible = false;
    await this.planService.clearWeekMeals(this.week.year, this.week.isoWeek);
  }

  async shareWeek(): Promise<void> {
    const data: SharedPlanData = {
      guid: crypto.randomUUID(),
      year: this.week.year,
      isoWeek: this.week.isoWeek,
      days: this.week.days.map(d => ({
        dayName: d.dayName,
        displayDate: d.displayDate,
        items: d.items.map(i => ({
          id: i.id,
          name: i.name,
          mealName: i.mealName,
          tags: i.resolvedTags.map(t => ({ name: t.name, color: t.color }))
        }))
      })),
      extras: this.extrasEntries.map(e => ({ id: e.id, mealName: e.mealName }))
    };
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = `https://rubenmay1.github.io/menu_app/view-plan/?data=${compressed}`;
    try {
      await Share.share({ title: 'My Meal Plan', text: `Week ${this.week.isoWeek} Meal Plan:`, url, dialogTitle: 'Share Meal Plan' });
    } catch { /* user cancelled */ }
  }

  private sharedToWeek(data: SharedPlanData): WeekState {
    return {
      year: data.year,
      isoWeek: data.isoWeek,
      days: data.days.map((d, i) => ({
        dayIndex: i,
        dayName: d.dayName,
        date: new Date(),
        displayDate: d.displayDate,
        items: d.items.map(item => ({
          id: item.id,
          name: item.name,
          tagIds: [],
          mealName: item.mealName,
          resolvedTags: item.tags.map(t => ({ id: t.name, name: t.name, color: t.color }))
        }))
      }))
    };
  }

  async goToPreviousWeek(): Promise<void> {
    if (this.readMode) return;
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
    if (this.readMode) return;
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
    if (this.readMode) return;
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
    this.initItemStages();
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
    if (this.readMode) return;
    if (this.itemLongPressActive) {
      this.itemLongPressActive = false;
      return;
    }
    if (item.mealName && item.mealName !== 'None') {
      void this.openMealActionPopup(item, dayIndex);
    } else {
      void this.openItemPopup(item, dayIndex);
    }
  }

  openDayEditor(dayIndex: number): void {
    if (this.readMode) return;
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
    this.initItemStages();
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
    this.initItemStages();
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
    this.initItemStages();
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
    this.initItemStages();
  }

  async openItemPopup(item: ResolvedMenuItem, dayIndex: number): Promise<void> {
    this.itemPopupItem = item;
    this.itemPopupDayIndex = dayIndex;
    this.pickerMode = 'default';
    this.customName = '';
    this.customStarred = false;
    const [meals, usageCounts, lastUsed] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts(),
      this.mealService.getMealLastUsedDates()
    ]);
    this.mealUsageCounts = usageCounts;
    this.mealLastUsedDates = lastUsed;
    const sorted = meals.sort((a, b) => {
      const ua = this.mealUsageCounts.get(a.name) ?? 0;
      const ub = this.mealUsageCounts.get(b.name) ?? 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
    this.allPickerMeals = sorted;
    this.pickerSearchQuery = '';
    this.pickerFilterActive = true;
    if (item.tagIds.length > 0) {
      this.pickerMeals = sorted.filter(m => m.tagIds.length === 0 || m.tagIds.some(tid => item.tagIds.includes(tid)));
      this.pickerTags = [...item.resolvedTags].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      this.pickerMeals = sorted;
      this.pickerTags = [];
    }
    this.pickerOverflowSvc.init(this.pickerMeals.map(m => m.id));
    this.itemPopupVisible = true;
  }

  closeItemPopup(): void {
    this.itemPopupVisible = false;
    this.itemPopupItem = null;
    this.itemPopupDayIndex = -1;
    this.snowTooltipText = null;
    this.snowTooltipTop = null;
    this.snowTooltipFading = false;
  }

  togglePickerFilter(): void {
    this.pickerFilterActive = !this.pickerFilterActive;
    if (this.pickerFilterActive) {
      this.pickerSearchQuery = '';
    }
    const item = this.itemPopupItem;
    if (this.pickerFilterActive && item && item.tagIds.length > 0) {
      this.pickerMeals = this.allPickerMeals.filter(m =>
        m.tagIds.length === 0 || m.tagIds.some(tid => item.tagIds.includes(tid))
      );
    } else {
      this.pickerMeals = this.allPickerMeals;
    }
    this.pickerOverflowSvc.init(this.pickerMeals.map(m => m.id));
  }

  onPickerSearchInput(ev: Event): void {
    this.pickerSearchQuery = (ev as CustomEvent).detail.value ?? '';
    const q = this.pickerSearchQuery.toLowerCase().trim();
    if (q) {
      this.pickerFilterActive = false;
      this.pickerMeals = this.allPickerMeals.filter(m => m.name.toLowerCase().includes(q));
    } else {
      const item = this.itemPopupItem;
      if (this.pickerFilterActive && item && item.tagIds.length > 0) {
        this.pickerMeals = this.allPickerMeals.filter(m =>
          m.tagIds.length === 0 || m.tagIds.some(tid => item.tagIds.includes(tid))
        );
      } else {
        this.pickerMeals = [...this.allPickerMeals];
      }
    }
    this.pickerOverflowSvc.init(this.pickerMeals.map(m => m.id));
  }

  onExtrasPickerSearchInput(ev: Event): void {
    this.extrasPickerSearchQuery = (ev as CustomEvent).detail.value ?? '';
    const q = this.extrasPickerSearchQuery.toLowerCase().trim();
    this.pickerMeals = q
      ? this.allPickerMeals.filter(m => m.name.toLowerCase().includes(q))
      : [...this.allPickerMeals];
  }

  async setNone(): Promise<void> {
    if (!this.itemPopupItem) return;
    await this.saveItemUpdate(this.itemPopupItem, this.itemPopupDayIndex, { mealName: 'None' });
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
    await this.saveItemUpdate(this.itemPopupItem, this.itemPopupDayIndex, { mealName: name });
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
    await this.saveItemUpdate(this.itemPopupItem, this.itemPopupDayIndex, { mealName: meal.name });
    this.closeItemPopup();
  }

  async openExtrasPicker(): Promise<void> {
    const [meals, usageCounts, lastUsed] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts(),
      this.mealService.getMealLastUsedDates()
    ]);
    this.mealUsageCounts = usageCounts;
    this.mealLastUsedDates = lastUsed;
    const sorted = meals.sort((a, b) => {
      const ua = usageCounts.get(a.name) ?? 0;
      const ub = usageCounts.get(b.name) ?? 0;
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
    this.allPickerMeals = sorted;
    this.pickerMeals = [...sorted];
    this.extrasPickerSearchQuery = '';
    this.extrasPickerMode = 'default';
    this.extrasCustomName = '';
    this.extrasCustomStarred = false;
    this.extrasPickerVisible = true;
  }

  isMealFrozen(mealName: string): boolean {
    const threshold = this.prefs.frozenThresholdWeeks;
    const lastUsed = this.mealLastUsedDates.get(mealName);
    if (!lastUsed) return true;
    const weeksAgo = (Date.now() - lastUsed.getTime()) / (7 * 24 * 60 * 60 * 1000);
    return weeksAgo >= threshold;
  }

  showSnowflakeTooltip(mealName: string, event: Event): void {
    event.stopPropagation();

    const path = event.composedPath() as Element[];
    const row = path.find(el => (el as HTMLElement).classList?.contains('picker-meal-row')) as HTMLElement | undefined;
    const popup = path.find(el => (el as HTMLElement).classList?.contains('picker-popup')) as HTMLElement | undefined;
    if (row && popup) {
      const scrollEl = popup.querySelector('.picker-popup-scroll') as HTMLElement | null;
      const rowRect = row.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      this.snowTooltipTop = rowRect.top - popupRect.top + (scrollEl?.scrollTop ?? 0) + rowRect.height / 2;
    }

    const lastUsed = this.mealLastUsedDates.get(mealName);
    if (!lastUsed) {
      this.snowTooltipText = 'Never used';
    } else {
      const weeks = Math.floor((Date.now() - lastUsed.getTime()) / (7 * 24 * 60 * 60 * 1000));
      this.snowTooltipText = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    this.snowTooltipFading = false;
    if (this.snowTooltipTimer !== null) clearTimeout(this.snowTooltipTimer);
    this.snowTooltipTimer = setTimeout(() => {
      this.snowTooltipFading = true;
      this.snowTooltipTimer = setTimeout(() => {
        this.snowTooltipText = null;
        this.snowTooltipTop = null;
        this.snowTooltipFading = false;
        this.snowTooltipTimer = null;
      }, 300);
    }, 2500);
  }

  closeExtrasPicker(): void {
    this.extrasPickerVisible = false;
    this.snowTooltipText = null;
    this.snowTooltipTop = null;
    this.snowTooltipFading = false;
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

  async openMealActionPopup(item: ResolvedMenuItem, dayIndex: number): Promise<void> {
    this.mealActionItem = item;
    this.mealActionDayIndex = dayIndex;
    const meals = await this.mealService.getMeals();
    this.mealActionMeal = meals.find(m => m.name === item.mealName) ?? null;
    this.mealActionVisible = true;
  }

  closeMealActionPopup(): void {
    this.mealActionVisible = false;
    this.mealActionItem = null;
    this.mealActionDayIndex = -1;
    this.mealActionMeal = null;
  }

  async mealActionChange(): Promise<void> {
    const item = this.mealActionItem!;
    const dayIndex = this.mealActionDayIndex;
    this.closeMealActionPopup();
    await this.openItemPopup(item, dayIndex);
  }

  async mealActionRemove(): Promise<void> {
    const item = this.mealActionItem!;
    const dayIndex = this.mealActionDayIndex;
    this.closeMealActionPopup();
    await this.saveItemUpdate(item, dayIndex, { mealName: undefined });
  }

  async mealActionGoToRecipe(): Promise<void> {
    const url = this.mealActionMeal?.recipeUrl;
    if (!url) return;
    await Browser.open({ url });
  }

  private async saveItemUpdate(item: ResolvedMenuItem, dayIndex: number, changes: { mealName?: string }): Promise<void> {
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
    this.initItemStages();
  }
}
