export interface Ingredient {
  id: string;
  name: string;
}

export interface Meal {
  id: string;
  name: string;
  tagIds: string[];
  ingredients: Ingredient[];
  recipeUrl?: string;
}
