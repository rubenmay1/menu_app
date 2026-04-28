import { Injectable } from '@angular/core';
import { MenuItem, SubMenu, WeekMealEntry } from './plan.models';

@Injectable({ providedIn: 'root' })
export class PlanService {

  getSubMenus(dayIndex: number): SubMenu[] {
    try {
      return JSON.parse(localStorage.getItem(`day-submenus-${dayIndex}`) ?? '[]');
    } catch {
      return [];
    }
  }

  setSubMenus(dayIndex: number, items: SubMenu[]): void {
    localStorage.setItem(`day-submenus-${dayIndex}`, JSON.stringify(items));
  }

  getWeekMeals(year: number, week: number, dayIndex: number): WeekMealEntry[] {
    try {
      return JSON.parse(localStorage.getItem(`week-meals-${year}-${week}-${dayIndex}`) ?? '[]');
    } catch {
      return [];
    }
  }

  setWeekMeals(year: number, week: number, dayIndex: number, entries: WeekMealEntry[]): void {
    localStorage.setItem(`week-meals-${year}-${week}-${dayIndex}`, JSON.stringify(entries));
  }

  getMenuItems(year: number, week: number, dayIndex: number): MenuItem[] {
    const submenus = this.getSubMenus(dayIndex);
    const weekMeals = this.getWeekMeals(year, week, dayIndex);
    return submenus.map(sm => {
      const meal = weekMeals.find(m => m.itemId === sm.id);
      return {
        id: sm.id,
        name: sm.name,
        tagIds: sm.tagIds,
        mealName: meal?.mealName,
        starred: meal?.starred
      };
    });
  }

  createItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
