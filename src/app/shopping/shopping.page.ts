import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { PlanService } from '../plan/plan.service';
import { MealService } from '../meals/meal.service';
import { Meal } from '../meals/meal.model';
import { getISOWeek, getISOWeekYear } from '../shared/week-utils';

interface ShoppingItem {
  key: string;
  ingredientName: string;
  mealName: string;
  done: boolean;
}

const DAY_COUNT = 7;

@Component({
  selector: 'app-shopping',
  standalone: false,
  templateUrl: './shopping.page.html',
  styleUrls: ['./shopping.page.scss']
})
export class ShoppingPage implements AfterViewInit {

  @ViewChild(IonContent, { read: ElementRef }) private contentRef!: ElementRef;

  week: { year: number; isoWeek: number } | null = null;
  activeItems: ShoppingItem[] = [];
  doneItems: ShoppingItem[] = [];

  constructor(
    private readonly planService: PlanService,
    private readonly mealService: MealService
  ) {}

  ngAfterViewInit(): void {
    this.setupSwipeGesture();
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.week) {
      const today = new Date();
      await this.loadWeek(getISOWeekYear(today), getISOWeek(today));
    } else {
      await this.loadWeek(this.week.year, this.week.isoWeek);
    }
  }

  async goToPreviousWeek(): Promise<void> {
    if (!this.week) return;
    const { year, isoWeek } = this.week;
    if (isoWeek === 1) {
      await this.loadWeek(year - 1, this.getLastISOWeekOfYear(year - 1));
    } else {
      await this.loadWeek(year, isoWeek - 1);
    }
  }

  async goToNextWeek(): Promise<void> {
    if (!this.week) return;
    const { year, isoWeek } = this.week;
    const lastWeek = this.getLastISOWeekOfYear(year);
    if (isoWeek >= lastWeek) {
      await this.loadWeek(year + 1, 1);
    } else {
      await this.loadWeek(year, isoWeek + 1);
    }
  }

  private getLastISOWeekOfYear(year: number): number {
    return getISOWeek(new Date(Date.UTC(year, 11, 28)));
  }

  private async loadWeek(year: number, isoWeek: number): Promise<void> {
    this.week = { year, isoWeek };
    const meals = await this.mealService.getMeals();
    const mealByName = new Map<string, Meal>(meals.map(m => [m.name.toLowerCase(), m]));
    const doneKeys = this.loadDoneKeys(year, isoWeek);
    const seen = new Set<string>();
    const allItems: ShoppingItem[] = [];

    for (let dayIndex = 0; dayIndex < DAY_COUNT; dayIndex++) {
      const menuItems = await this.planService.getMenuItems(year, isoWeek, dayIndex);
      for (const menuItem of menuItems) {
        if (!menuItem.mealName || menuItem.mealName === '--' || menuItem.mealName === '') continue;
        const meal = mealByName.get(menuItem.mealName.toLowerCase());
        if (!meal || meal.ingredients.length === 0) continue;
        for (const ingredient of meal.ingredients) {
          const key = `${meal.id}-${ingredient.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allItems.push({
            key,
            ingredientName: ingredient.name,
            mealName: meal.name,
            done: doneKeys.has(key)
          });
        }
      }
    }

    allItems.sort((a, b) =>
      a.ingredientName.localeCompare(b.ingredientName, undefined, { sensitivity: 'base' })
    );

    this.activeItems = allItems.filter(i => !i.done);
    this.doneItems = allItems.filter(i => i.done);
  }

  toggleItem(item: ShoppingItem): void {
    item.done = !item.done;
    const doneKeys = this.loadDoneKeys(this.week!.year, this.week!.isoWeek);
    if (item.done) {
      doneKeys.add(item.key);
    } else {
      doneKeys.delete(item.key);
    }
    this.saveDoneKeys(this.week!.year, this.week!.isoWeek, doneKeys);

    if (item.done) {
      this.activeItems = this.activeItems.filter(i => i.key !== item.key);
      this.doneItems = [...this.doneItems, item].sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName, undefined, { sensitivity: 'base' })
      );
    } else {
      this.doneItems = this.doneItems.filter(i => i.key !== item.key);
      this.activeItems = [...this.activeItems, item].sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName, undefined, { sensitivity: 'base' })
      );
    }
  }

  private loadDoneKeys(year: number, isoWeek: number): Set<string> {
    const raw = localStorage.getItem(`shopping-done-${year}-${isoWeek}`);
    return new Set<string>(raw ? JSON.parse(raw) as string[] : []);
  }

  private saveDoneKeys(year: number, isoWeek: number, keys: Set<string>): void {
    localStorage.setItem(`shopping-done-${year}-${isoWeek}`, JSON.stringify([...keys]));
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
}
