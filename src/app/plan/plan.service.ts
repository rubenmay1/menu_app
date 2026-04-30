import { Injectable } from '@angular/core';
import { MenuItem, SubMenu, WeekMealEntry, ExtraEntry } from './plan.models';
import { DbService } from '../shared/db.service';

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private readonly db: DbService) {}

  getSubMenus(dayIndex: number): Promise<SubMenu[]> { return this.db.getSubMenus(dayIndex); }
  setSubMenus(dayIndex: number, items: SubMenu[]): Promise<void> { return this.db.setSubMenus(dayIndex, items); }
  getWeekMeals(year: number, week: number, dayIndex: number): Promise<WeekMealEntry[]> { return this.db.getWeekMeals(year, week, dayIndex); }
  setWeekMeals(year: number, week: number, dayIndex: number, entries: WeekMealEntry[]): Promise<void> { return this.db.setWeekMeals(year, week, dayIndex, entries); }
  deleteSubMenuHistory(itemId: string, dayIndex: number): Promise<void> { return this.db.deleteSubMenuHistory(itemId, dayIndex); }

  async getMenuItems(year: number, week: number, dayIndex: number): Promise<MenuItem[]> {
    const submenus = await this.db.getSubMenus(dayIndex);
    const weekMeals = await this.db.getWeekMeals(year, week, dayIndex);
    return submenus.map(sm => {
      const meal = weekMeals.find(m => m.itemId === sm.id);
      return {
        id: sm.id,
        name: sm.name,
        tagIds: sm.tagIds,
        mealName: meal?.mealName
      };
    });
  }

  getExtras(year: number, week: number): Promise<ExtraEntry[]> { return this.db.getExtras(year, week); }
  setExtras(year: number, week: number, entries: ExtraEntry[]): Promise<void> { return this.db.setExtras(year, week, entries); }

  createItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
