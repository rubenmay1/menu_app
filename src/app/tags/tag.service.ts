import { Injectable } from '@angular/core';
import { Tag } from './tag.model';
import { DbService } from '../shared/db.service';

@Injectable({ providedIn: 'root' })
export class TagService {
  constructor(private readonly db: DbService) {}

  getTags(): Promise<Tag[]> { return this.db.getTags(); }
  getTagById(id: string): Promise<Tag | null> { return this.db.getTagById(id); }
  saveTag(tag: Tag): Promise<void> { return this.db.saveTag(tag); }
  deleteTag(id: string): Promise<void> { return this.db.deleteTag(id); }

  createId(): string {
    return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
