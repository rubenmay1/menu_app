export interface SubMenu {
  id: string;
  name: string;
  tagIds: string[];
}

export interface WeekMealEntry {
  itemId: string;
  mealName?: string;
}

// Combined view: SubMenu merged with its WeekMealEntry for a given week
export interface MenuItem {
  id: string;
  name: string;
  tagIds: string[];
  mealName?: string;
}

export interface ResolvedMenuItem {
  id: string;
  name: string;
  tagIds: string[];
  mealName?: string;
  resolvedTags: { id: string; name: string; color: string }[];
}

export interface DayEntry {
  dayIndex: number;
  dayName: string;
  date: Date;
  displayDate: string;
  items: ResolvedMenuItem[];
}

export interface WeekState {
  year: number;
  isoWeek: number;
  days: DayEntry[];
}

export interface ExtraEntry {
  id: string;
  mealName: string;
}

export const PRESET_COLORS: string[] = [
  '#ef5350', '#ec407a', '#ab47bc', '#7e57c2',
  '#42a5f5', '#26c6da', '#26a69a', '#66bb6a',
  '#d4e157', '#ffca28', '#ffa726', '#ff7043',
  '#8d6e63', '#78909c', '#5c6bc0', '#29b6f6'
];
