import { Injectable } from '@angular/core';
import { Tag } from './tag.model';

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly STORAGE_KEY = 'tags';

  getTags(): Tag[] {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  getTagById(id: string): Tag | null {
    return this.getTags().find(t => t.id === id) ?? null;
  }

  saveTag(tag: Tag): void {
    const tags = this.getTags().filter(t => t.id !== tag.id);
    tags.push(tag);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tags));
  }

  deleteTag(id: string): void {
    const tags = this.getTags().filter(t => t.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tags));
  }

  createId(): string {
    return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
