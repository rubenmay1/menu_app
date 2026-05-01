import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Tag } from '../tags/tag.model';
import { Meal } from '../meals/meal.model';
import { SubMenu, WeekMealEntry, ExtraEntry } from '../plan/plan.models';
import { getMondayOfISOWeek } from './week-utils';

// All storage is localStorage. To migrate to SQLite:
// 1. Import CapacitorSQLite, SQLiteConnection from @capacitor-community/sqlite
// 2. Add connection setup + table creation in initialize()
// 3. Replace each method body with the equivalent SQL (see git history for
//    the full SQLite implementation that was prototyped before this revision)

@Injectable({ providedIn: 'root' })
export class DbService {

  private readonly dataChangedSubject = new Subject<void>();
  readonly dataChanged$: Observable<void> = this.dataChangedSubject.asObservable();

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
      if (!key) continue;
      if (key.startsWith('week-meals-')) {
        const entries: WeekMealEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        for (const entry of entries) {
          if (entry.mealName && entry.mealName !== '' && entry.mealName !== '--' && entry.mealName !== 'None') {
            map.set(entry.mealName, (map.get(entry.mealName) ?? 0) + 1);
          }
        }
      } else if (key.startsWith('week-extras-')) {
        const entries: ExtraEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        for (const entry of entries) {
          if (entry.mealName) {
            map.set(entry.mealName, (map.get(entry.mealName) ?? 0) + 1);
          }
        }
      }
    }
    return map;
  }

  async getMealLastUsedDates(): Promise<Map<string, Date>> {
    const weekMap = new Map<string, { year: number; isoWeek: number }>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('week-meals-')) {
        const parts = key.split('-');
        const year = parseInt(parts[2], 10);
        const isoWeek = parseInt(parts[3], 10);
        if (isNaN(year) || isNaN(isoWeek)) continue;
        const entries: WeekMealEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        for (const entry of entries) {
          if (!entry.mealName || entry.mealName === '' || entry.mealName === '--' || entry.mealName === 'None') continue;
          const existing = weekMap.get(entry.mealName);
          if (!existing || year > existing.year || (year === existing.year && isoWeek > existing.isoWeek)) {
            weekMap.set(entry.mealName, { year, isoWeek });
          }
        }
      } else if (key.startsWith('week-extras-')) {
        const parts = key.split('-');
        const year = parseInt(parts[2], 10);
        const isoWeek = parseInt(parts[3], 10);
        if (isNaN(year) || isNaN(isoWeek)) continue;
        const entries: ExtraEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        for (const entry of entries) {
          if (!entry.mealName) continue;
          const existing = weekMap.get(entry.mealName);
          if (!existing || year > existing.year || (year === existing.year && isoWeek > existing.isoWeek)) {
            weekMap.set(entry.mealName, { year, isoWeek });
          }
        }
      }
    }

    const dateMap = new Map<string, Date>();
    for (const [name, { year, isoWeek }] of weekMap) {
      dateMap.set(name, getMondayOfISOWeek(year, isoWeek));
    }
    return dateMap;
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

  async deleteSubMenuHistory(itemId: string, dayIndex: number): Promise<void> {
    const suffix = `-${dayIndex}`;
    const keysToUpdate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('week-meals-') && key.endsWith(suffix)) keysToUpdate.push(key);
    }
    for (const key of keysToUpdate) {
      const entries: WeekMealEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      const filtered = entries.filter(e => e.itemId !== itemId);
      if (filtered.length !== entries.length) localStorage.setItem(key, JSON.stringify(filtered));
    }
  }

  // ---- Share / Import ----

  exportTagsAndMeals(): { tags: Tag[]; meals: Meal[] } {
    const tags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');
    const meals: Meal[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    return { tags, meals };
  }

  importTagsAndMeals(data: { tags: Tag[]; meals: Meal[] }): { tagsAdded: number; tagsOverwritten: number; mealsAdded: number; mealsOverwritten: number } {
    let tagsAdded = 0, tagsOverwritten = 0;
    const existingTags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');
    for (const imported of data.tags) {
      const idx = existingTags.findIndex(t => t.name.toLowerCase() === imported.name.toLowerCase());
      if (idx >= 0) {
        existingTags[idx] = { ...imported, id: existingTags[idx].id };
        tagsOverwritten++;
      } else {
        existingTags.push(imported);
        tagsAdded++;
      }
    }
    localStorage.setItem('tags', JSON.stringify(existingTags));

    let mealsAdded = 0, mealsOverwritten = 0;
    const existingMeals: Meal[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    for (const imported of data.meals) {
      const idx = existingMeals.findIndex(m => m.name.toLowerCase() === imported.name.toLowerCase());
      if (idx >= 0) {
        existingMeals[idx] = { ...imported, id: existingMeals[idx].id };
        mealsOverwritten++;
      } else {
        existingMeals.push(imported);
        mealsAdded++;
      }
    }
    localStorage.setItem('meals', JSON.stringify(existingMeals));

    this.dataChangedSubject.next();
    return { tagsAdded, tagsOverwritten, mealsAdded, mealsOverwritten };
  }

  async clearWeekMeals(year: number, week: number): Promise<void> {
    for (let i = 0; i < 7; i++) {
      localStorage.removeItem(`week-meals-${year}-${week}-${i}`);
    }
    localStorage.removeItem(`week-extras-${year}-${week}`);
    this.dataChangedSubject.next();
  }

  // ---- Extras ----

  async getExtras(year: number, week: number): Promise<ExtraEntry[]> {
    return JSON.parse(localStorage.getItem(`week-extras-${year}-${week}`) ?? '[]');
  }

  async setExtras(year: number, week: number, entries: ExtraEntry[]): Promise<void> {
    localStorage.setItem(`week-extras-${year}-${week}`, JSON.stringify(entries));
  }

  // ---- Stats ----

  getDataStats(): { totalSizeKb: number; mealCount: number; tagCount: number; weeksPlanned: number } {
    const meals: Meal[] = JSON.parse(localStorage.getItem('meals') ?? '[]');
    const tags: Tag[] = JSON.parse(localStorage.getItem('tags') ?? '[]');

    // Count all localStorage chars (covers all keys, no UTF-16 double-counting)
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      totalChars += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }

    const weeksWithMeals = new Map<string, string[]>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('week-meals-')) continue;
      const parts = key.split('-');
      if (parts.length < 5) continue;
      const weekKey = `${parts[2]}-${parts[3]}`;
      const entries: WeekMealEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      for (const e of entries) {
        if (e.mealName && e.mealName !== '' && e.mealName !== '--' && e.mealName !== 'None') {
          const existing = weeksWithMeals.get(weekKey) ?? [];
          if (!existing.includes(e.mealName)) existing.push(e.mealName);
          weeksWithMeals.set(weekKey, existing);
        }
      }
    }

    return {
      totalSizeKb: Math.round(totalChars / 1024 * 10) / 10, // totalChars is bytes (UTF-16: length * 2)
      mealCount: meals.length,
      tagCount: tags.length,
      weeksPlanned: weeksWithMeals.size,
    };
  }

  // ---- Reset ----

  resetAll(): void {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isDataKey(key)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    this.seedDefaultsIfNeeded();
    this.dataChangedSubject.next();
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
    this.dataChangedSubject.next();
  }

  private isDataKey(key: string): boolean {
    return (
      key === 'tags' ||
      key === 'meals' ||
      key.startsWith('day-submenus-') ||
      key.startsWith('week-meals-') ||
      key.startsWith('week-extras-')
    );
  }
}
