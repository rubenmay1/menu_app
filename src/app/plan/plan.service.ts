import { Injectable } from '@angular/core';
import { MenuItem } from './plan.models';

@Injectable({ providedIn: 'root' })
export class PlanService {

  getMenuItems(year: number, week: number, dayIndex: number): MenuItem[] {
    try {
      const raw: any[] = JSON.parse(localStorage.getItem(`menu-items-${year}-${week}-${dayIndex}`) ?? '[]');
      return raw.map(item => ({
        ...item,
        tagIds: item.tagIds ?? (item.tagId != null ? [item.tagId] : [])
      }));
    } catch {
      return [];
    }
  }

  setMenuItems(year: number, week: number, dayIndex: number, items: MenuItem[]): void {
    localStorage.setItem(`menu-items-${year}-${week}-${dayIndex}`, JSON.stringify(items));
  }

  createItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
