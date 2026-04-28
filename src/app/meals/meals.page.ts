import { Component } from '@angular/core';
import { MealService } from './meal.service';
import { TagService } from '../tags/tag.service';
import { Meal, Ingredient } from './meal.model';
import { Tag } from '../tags/tag.model';

interface MealGroup {
  tagId: string | null;
  tagName: string;
  tagColor: string;
  meals: Meal[];
}

@Component({
  selector: 'app-meals',
  standalone: false,
  templateUrl: './meals.page.html',
  styleUrls: ['./meals.page.scss']
})
export class MealsPage {

  meals: Meal[] = [];
  tags: Tag[] = [];
  groupedMeals: MealGroup[] = [];
  searchQuery: string = '';

  panelVisible: boolean = false;
  editingMealId: string | null = null;
  editingName: string = '';
  editingTagId: string | null = null;
  editingIngredients: Ingredient[] = [];

  ingredientsPopupVisible: boolean = false;

  constructor(
    private readonly mealService: MealService,
    private readonly tagService: TagService
  ) {}

  ionViewWillEnter(): void {
    this.meals = this.mealService.getMeals();
    this.tags = this.tagService.getTags();
    this.computeGroups();
  }

  computeGroups(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const filtered = q
      ? this.meals.filter(m => m.name.toLowerCase().includes(q))
      : [...this.meals];

    const map = new Map<string | null, Meal[]>();
    for (const meal of filtered) {
      const key = meal.tagId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(meal);
    }

    const tagged: MealGroup[] = [];
    for (const [tagId, meals] of map.entries()) {
      if (tagId === null) continue;
      const tag = this.tags.find(t => t.id === tagId);
      tagged.push({
        tagId,
        tagName: tag?.name ?? 'Unknown',
        tagColor: tag?.color ?? '#ccc',
        meals: meals.sort((a, b) => a.name.localeCompare(b.name))
      });
    }
    tagged.sort((a, b) => a.tagName.localeCompare(b.tagName));

    if (map.has(null)) {
      const untagged = map.get(null)!;
      tagged.push({
        tagId: null,
        tagName: '',
        tagColor: '',
        meals: untagged.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    this.groupedMeals = tagged;
  }

  onSearchInput(ev: Event): void {
    this.searchQuery = (ev as CustomEvent).detail.value ?? '';
    this.computeGroups();
  }

  openCreator(): void {
    this.editingMealId = null;
    this.editingName = '';
    this.editingTagId = null;
    this.editingIngredients = [];
    this.panelVisible = true;
  }

  openEditor(meal: Meal): void {
    this.editingMealId = meal.id;
    this.editingName = meal.name;
    this.editingTagId = meal.tagId;
    this.editingIngredients = [...meal.ingredients];
    this.panelVisible = true;
  }

  closePanel(): void {
    this.panelVisible = false;
    this.editingMealId = null;
    this.ingredientsPopupVisible = false;
  }

  savePanel(): void {
    const name = this.editingName.trim();
    if (!name) return;
    const id = this.editingMealId ?? this.mealService.createId();
    this.mealService.saveMeal({ id, name, tagId: this.editingTagId, ingredients: [...this.editingIngredients] });
    this.meals = this.mealService.getMeals();
    this.computeGroups();
    this.closePanel();
  }

  deleteMeal(): void {
    if (!this.editingMealId) return;
    this.mealService.deleteMeal(this.editingMealId);
    this.meals = this.mealService.getMeals();
    this.computeGroups();
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
}
