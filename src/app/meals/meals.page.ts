import { Component, OnDestroy, OnInit, AfterViewChecked, ViewChildren, ViewChild, QueryList, ElementRef } from '@angular/core';
import { IonSearchbar, Platform } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { Subscription } from 'rxjs';
import * as LZString from 'lz-string';
import { MealService } from './meal.service';
import { TagService } from '../tags/tag.service';
import { DbService } from '../shared/db.service';
import { Meal, Ingredient } from './meal.model';
import { Tag } from '../tags/tag.model';
import { ComponentOverflowService } from '../shared/component-overflow.service';

@Component({
  selector: 'app-meals',
  standalone: false,
  templateUrl: './meals.page.html',
  styleUrls: ['./meals.page.scss'],
  providers: [ComponentOverflowService]
})
export class MealsPage implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChildren('mealNameEl') private mealNameEls!: QueryList<ElementRef>;
  @ViewChild(IonSearchbar) private searchbar?: IonSearchbar;

  meals: Meal[] = [];
  filteredMeals: Meal[] = [];
  tags: Tag[] = [];
  searchQuery: string = '';
  filterTagIds: string[] = [];
  mealUsageCounts: Map<string, number> = new Map();

  panelVisible: boolean = false;
  editingMealId: string | null = null;
  editingName: string = '';
  editingTagIds: string[] = [];
  editingIngredients: Ingredient[] = [];
  editingRecipeUrl: string = '';

  editingNoIngredientsRequired: boolean = false;

  ingredientsPopupVisible: boolean = false;

  tooltipVisible: boolean = false;
  tooltipMeal: Meal | null = null;

  private readonly longPressTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private longPressActive = false;
  private dataChangedSub!: Subscription;
  private backButtonSub: Subscription | null = null;

  constructor(
    private readonly mealService: MealService,
    private readonly tagService: TagService,
    private readonly db: DbService,
    private readonly platform: Platform,
    readonly overflowSvc: ComponentOverflowService,
  ) {
    overflowSvc.configure(4, [
      { fromStage: 4, maxChips: 0 },
      { fromStage: 3, maxChips: 1 },
      { fromStage: 2, maxChips: 2 },
    ]);
  }

  ngOnInit(): void {
    this.dataChangedSub = this.db.dataChanged$.subscribe(() => {
      void this.reload();
    });
  }

  ngOnDestroy(): void {
    this.dataChangedSub.unsubscribe();
  }

  ngAfterViewChecked(): void {
    this.overflowSvc.afterViewChecked(this.mealNameEls);
  }

  async ionViewWillEnter(): Promise<void> {
    this.filterTagIds = [];
    await this.reload();
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
      if (this.ingredientsPopupVisible) {
        this.closeIngredientsPopup();
      } else if (this.panelVisible) {
        this.closePanel();
      } else if (this.tooltipVisible) {
        this.closeTooltip();
      } else {
        processNextHandler();
      }
    });
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = null;
    this.searchQuery = '';
    if (this.searchbar) this.searchbar.value = '';
    this.applySearch();
  }

  private async reload(): Promise<void> {
    const [meals, tags, usageCounts] = await Promise.all([
      this.mealService.getMeals(),
      this.tagService.getTags(),
      this.mealService.getMealUsageCounts()
    ]);
    this.meals = meals;
    this.tags = tags.sort((a, b) => a.name.localeCompare(b.name));
    this.mealUsageCounts = usageCounts;
    this.applySearch();
  }

  onSearchInput(ev: Event): void {
    this.searchQuery = (ev as CustomEvent).detail.value ?? '';
    this.applySearch();
  }

  toggleFilterTag(tagId: string): void {
    if (this.filterTagIds.includes(tagId)) {
      this.filterTagIds = this.filterTagIds.filter(id => id !== tagId);
    } else {
      this.filterTagIds = [...this.filterTagIds, tagId];
    }
    this.applySearch();
  }

  private applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    let source = q ? this.meals.filter(m => m.name.toLowerCase().includes(q)) : [...this.meals];
    if (this.filterTagIds.length > 0) {
      source = source.filter(m => m.tagIds.some(id => this.filterTagIds.includes(id)));
    }
    this.filteredMeals = source.sort((a, b) => a.name.localeCompare(b.name));
    this.overflowSvc.init(this.filteredMeals.map(m => m.id));
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
    this.tooltipMeal = meal;
    this.tooltipVisible = true;
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

  editFromTooltip(): void {
    const meal = this.tooltipMeal;
    this.closeTooltip();
    if (meal) this.openEditor(meal);
  }

  async shareMeal(): Promise<void> {
    const meal = this.tooltipMeal;
    if (!meal) return;
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(meal));
    const url = `https://rubenmay1.github.io/menu_app/import-meal/?data=${compressed}`;
    try {
      await Share.share({ title: meal.name, url, dialogTitle: 'Share Meal' });
    } catch { /* user cancelled */ }
  }

  // ---- Editor panel ----

  openCreator(): void {
    this.editingMealId = null;
    this.editingName = '';
    this.editingTagIds = [];
    this.editingIngredients = [];
    this.editingRecipeUrl = '';
    this.editingNoIngredientsRequired = false;
    this.panelVisible = true;
  }

  openEditor(meal: Meal): void {
    this.editingMealId = meal.id;
    this.editingName = meal.name;
    this.editingTagIds = [...meal.tagIds];
    this.editingIngredients = [...meal.ingredients];
    this.editingRecipeUrl = meal.recipeUrl ?? '';
    this.editingNoIngredientsRequired = meal.noIngredientsRequired ?? false;
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
    const noIngredientsRequired = this.editingNoIngredientsRequired || undefined;
    await this.mealService.saveMeal({ id, name, tagIds: [...this.editingTagIds], ingredients: [...this.editingIngredients], recipeUrl, noIngredientsRequired });
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

  setNoIngredientsRequired(): void {
    this.editingNoIngredientsRequired = true;
    this.closeIngredientsPopup();
  }

  onIngredientAdd(event: { name: string; tagIds: string[] }): void {
    this.editingNoIngredientsRequired = false;
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
