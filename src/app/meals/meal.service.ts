import { Injectable } from '@angular/core';
import { Meal } from './meal.model';

@Injectable({ providedIn: 'root' })
export class MealService {

  private readonly KEY = 'meals';

  getMeals(): Meal[] {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : [];
  }

  saveMeal(meal: Meal): void {
    const meals = this.getMeals();
    const idx = meals.findIndex(m => m.id === meal.id);
    if (idx >= 0) meals[idx] = meal;
    else meals.push(meal);
    localStorage.setItem(this.KEY, JSON.stringify(meals));
  }

  deleteMeal(id: string): void {
    const meals = this.getMeals().filter(m => m.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(meals));
  }

  createId(): string {
    return `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
