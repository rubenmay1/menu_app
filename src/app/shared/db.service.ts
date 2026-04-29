import { Injectable } from '@angular/core';
import { Tag } from '../tags/tag.model';
import { Meal } from '../meals/meal.model';
import { SubMenu, WeekMealEntry } from '../plan/plan.models';

// All storage is localStorage. To migrate to SQLite:
// 1. Import CapacitorSQLite, SQLiteConnection from @capacitor-community/sqlite
// 2. Add connection setup + table creation in initialize()
// 3. Replace each method body with the equivalent SQL (see git history for
//    the full SQLite implementation that was prototyped before this revision)

@Injectable({ providedIn: 'root' })
export class DbService {

  async initialize(): Promise<void> {
    this.seedDefaultsIfNeeded();
  }

  private seedDefaultsIfNeeded(): void {
    if (localStorage.getItem('day-submenus-0') !== null) return;
    for (let i = 0; i < 7; i++) {
      const items: SubMenu[] = [
        { id: `default-lunch-${i}`, name: 'Lunch', tagIds: [] },
        { id: `default-dinner-${i}`, name: 'Dinner', tagIds: [] },
      ];
      localStorage.setItem(`day-submenus-${i}`, JSON.stringify(items));
    }
  }

  // ---- Tags ----

  async getTags(): Promise<Tag[]> {
    return JSON.parse(localStorage.getItem('tags') ?? '[]');
  }

  async getTagById(id: string): Promise<Tag | null> {
    const tags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');
    return tags.find(t => t.id === id) ?? null;
  }

  async saveTag(tag: Tag): Promise<void> {
    const tags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');
    const idx = tags.findIndex(t => t.id === tag.id);
    if (idx >= 0) tags[idx] = tag; else tags.push(tag);
    localStorage.setItem('tags', JSON.stringify(tags));
  }

  async deleteTag(id: string): Promise<void> {
    const tags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');
    localStorage.setItem('tags', JSON.stringify(tags.filter(t => t.id !== id)));
  }

  // ---- Meals ----

  async getMeals(): Promise<Meal[]> {
    const raw: (Meal & { tagId?: string | null })[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    return raw.map(m => {
      if (!Array.isArray(m.tagIds)) {
        const { tagId, ...rest } = m;
        return { ...rest, tagIds: tagId ? [tagId] : [] };
      }
      return m;
    });
  }

  async saveMeal(meal: Meal): Promise<void> {
    const meals: Meal[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    const idx = meals.findIndex(m => m.id === meal.id);
    if (idx >= 0) meals[idx] = meal; else meals.push(meal);
    localStorage.setItem('meals', JSON.stringify(meals));
  }

  async deleteMeal(id: string): Promise<void> {
    const meals: Meal[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    localStorage.setItem('meals', JSON.stringify(meals.filter(m => m.id !== id)));
  }

  async getMealUsageCounts(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('week-meals-')) continue;
      const entries: WeekMealEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      for (const entry of entries) {
        if (entry.mealName && entry.mealName !== '' && entry.mealName !== '--') {
          map.set(entry.mealName, (map.get(entry.mealName) ?? 0) + 1);
        }
      }
    }
    return map;
  }

  // ---- SubMenus ----

  async getSubMenus(dayIndex: number): Promise<SubMenu[]> {
    return JSON.parse(localStorage.getItem(`day-submenus-${dayIndex}`) ?? '[]');
  }

  async setSubMenus(dayIndex: number, items: SubMenu[]): Promise<void> {
    localStorage.setItem(`day-submenus-${dayIndex}`, JSON.stringify(items));
  }

  // ---- WeekMeals ----

  async getWeekMeals(year: number, week: number, dayIndex: number): Promise<WeekMealEntry[]> {
    return JSON.parse(localStorage.getItem(`week-meals-${year}-${week}-${dayIndex}`) ?? '[]');
  }

  async setWeekMeals(year: number, week: number, dayIndex: number, entries: WeekMealEntry[]): Promise<void> {
    localStorage.setItem(`week-meals-${year}-${week}-${dayIndex}`, JSON.stringify(entries));
  }

  // ---- Backup / Restore ----

  exportAll(): string {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isDataKey(key)) {
        data[key] = localStorage.getItem(key) ?? '';
      }
    }
    return JSON.stringify(data);
  }

  importAll(json: string): void {
    const data: Record<string, string> = JSON.parse(json);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isDataKey(key)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  }

  private isDataKey(key: string): boolean {
    return (
      key === 'tags' ||
      key === 'meals' ||
      key.startsWith('day-submenus-') ||
      key.startsWith('week-meals-')
    );
  }
}
