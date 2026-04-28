export interface Ingredient {
  id: string;
  name: string;
}

export interface Meal {
  id: string;
  name: string;
  tagId: string | null;
  ingredients: Ingredient[];
}
