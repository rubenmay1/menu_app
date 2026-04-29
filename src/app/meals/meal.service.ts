import { Injectable } from '@angular/core';
import { Meal } from './meal.model';
import { DbService } from '../shared/db.service';

@Injectable({ providedIn: 'root' })
export class MealService {
  constructor(private readonly db: DbService) {}

  getMeals(): Promise<Meal[]> { return this.db.getMeals(); }
  saveMeal(meal: Meal): Promise<void> { return this.db.saveMeal(meal); }
  deleteMeal(id: string): Promise<void> { return this.db.deleteMeal(id); }
  getMealUsageCounts(): Promise<Map<string, number>> { return this.db.getMealUsageCounts(); }

  createId(): string {
    return `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
