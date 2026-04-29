import { Component } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { MealService } from './meal.service';
import { TagService } from '../tags/tag.service';
import { Meal, Ingredient } from './meal.model';
import { Tag } from '../tags/tag.model';

@Component({
  selector: 'app-meals',
  standalone: false,
  templateUrl: './meals.page.html',
  styleUrls: ['./meals.page.scss']
})
export class MealsPage {

  meals: Meal[] = [];
  filteredMeals: Meal[] = [];
  tags: Tag[] = [];
  searchQuery: string = '';
  mealUsageCounts: Map<string, number> = new Map();

  panelVisible: boolean = false;
  editingMealId: string | null = null;
  editingName: string = '';
  editingTagIds: string[] = [];
  editingIngredients: Ingredient[] = [];
  editingRecipeUrl: string = '';

  ingredientsPopupVisible: boolean = false;

  tooltipVisible: boolean = false;
  tooltipMeal: Meal | null = null;

  private readonly longPressTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private longPressActive = false;

  constructor(
    private readonly mealService: MealService,
    private readonly tagService: TagService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    [this.meals, this.tags, this.mealUsageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.tagService.getTags(),
      this.mealService.getMealUsageCounts()
    ]);
    this.applySearch();
  }

  onSearchInput(ev: Event): void {
    this.searchQuery = (ev as CustomEvent).detail.value ?? '';
    this.applySearch();
  }

  private applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const source = q ? this.meals.filter(m => m.name.toLowerCase().includes(q)) : [...this.meals];
    this.filteredMeals = source.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---- Long-press / tap handling on meal rows ----

  onMealPointerDown(meal: Meal): void {
    const timer = setTimeout(() => {
      this.longPressActive = true;
      this.longPressTimers.delete(meal.id);
      this.openEditor(meal);
    }, 500);
    this.longPressTimers.set(meal.id, timer);
  }

  onMealPointerUp(meal: Meal): void {
    this.cancelLongPress(meal.id);
  }

  onMealPointerLeave(meal: Meal): void {
    this.cancelLongPress(meal.id);
  }

  onMealClick(meal: Meal): void {
    if (this.longPressActive) {
      this.longPressActive = false;
      return;
    }
    if (meal.recipeUrl) {
      this.tooltipMeal = meal;
      this.tooltipVisible = true;
    }
  }

  private cancelLongPress(id: string): void {
    const timer = this.longPressTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.longPressTimers.delete(id);
    }
  }

  // ---- Recipe tooltip ----

  closeTooltip(): void {
    this.tooltipVisible = false;
    this.tooltipMeal = null;
  }

  async openRecipe(): Promise<void> {
    const url = this.tooltipMeal?.recipeUrl;
    if (!url) return;
    await Browser.open({ url });
  }

  // ---- Editor panel ----

  openCreator(): void {
    this.editingMealId = null;
    this.editingName = '';
    this.editingTagIds = [];
    this.editingIngredients = [];
    this.editingRecipeUrl = '';
    this.panelVisible = true;
  }

  openEditor(meal: Meal): void {
    this.editingMealId = meal.id;
    this.editingName = meal.name;
    this.editingTagIds = [...meal.tagIds];
    this.editingIngredients = [...meal.ingredients];
    this.editingRecipeUrl = meal.recipeUrl ?? '';
    this.panelVisible = true;
  }

  closePanel(): void {
    this.panelVisible = false;
    this.editingMealId = null;
    this.ingredientsPopupVisible = false;
  }

  async savePanel(): Promise<void> {
    const name = this.editingName.trim();
    if (!name) return;
    const id = this.editingMealId ?? this.mealService.createId();
    const recipeUrl = this.editingRecipeUrl.trim() || undefined;
    await this.mealService.saveMeal({ id, name, tagIds: [...this.editingTagIds], ingredients: [...this.editingIngredients], recipeUrl });
    [this.meals, this.mealUsageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts()
    ]);
    this.applySearch();
    this.closePanel();
  }

  async deleteMeal(): Promise<void> {
    if (!this.editingMealId) return;
    await this.mealService.deleteMeal(this.editingMealId);
    [this.meals, this.mealUsageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.mealService.getMealUsageCounts()
    ]);
    this.applySearch();
    this.closePanel();
  }

  openIngredientsPopup(): void {
    this.ingredientsPopupVisible = true;
  }

  closeIngredientsPopup(): void {
    this.ingredientsPopupVisible = false;
  }

  onIngredientAdd(event: { name: string; tagIds: string[] }): void {
    this.editingIngredients.push({
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: event.name
    });
  }

  removeIngredient(id: string): void {
    this.editingIngredients = this.editingIngredients.filter(i => i.id !== id);
  }

  getTag(tagId: string): Tag | undefined {
    return this.tags.find(t => t.id === tagId);
  }

  toggleTag(tagId: string): void {
    if (this.editingTagIds.includes(tagId)) {
      this.editingTagIds = this.editingTagIds.filter(id => id !== tagId);
    } else {
      this.editingTagIds = [...this.editingTagIds, tagId];
    }
  }
}
