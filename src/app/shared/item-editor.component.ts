import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Tag } from '../tags/tag.model';

export interface EditorItem {
  id: string;
  name: string;
  tagIds?: string[];
  resolvedTags?: { id: string; name: string; color: string }[];
}

@Component({
  selector: 'app-item-editor',
  standalone: false,
  templateUrl: './item-editor.component.html',
  styleUrls: ['./item-editor.component.scss']
})
export class ItemEditorComponent {
  @Input() items: EditorItem[] = [];
  @Input() tags: Tag[] = [];
  @Input() showTags: boolean = false;
  @Input() allowReorder: boolean = false;
  @Input() placeholder: string = 'Item name…';
  @Input() addLabel: string = '';

  @Output() itemAdd = new EventEmitter<{ name: string; tagIds: string[] }>();
  @Output() itemRemove = new EventEmitter<string>();
  @Output() itemsReorder = new EventEmitter<EditorItem[]>();

  newItemName: string = '';
  newItemTagIds: string[] = [];

  toggleTag(id: string): void {
    const idx = this.newItemTagIds.indexOf(id);
    if (idx >= 0) {
      this.newItemTagIds = this.newItemTagIds.filter(t => t !== id);
    } else {
      this.newItemTagIds = [...this.newItemTagIds, id];
    }
  }

  isTagSelected(id: string): boolean {
    return this.newItemTagIds.includes(id);
  }

  onAdd(): void {
    const name = this.newItemName.trim();
    if (!name) return;
    this.itemAdd.emit({ name, tagIds: this.showTags ? [...this.newItemTagIds] : [] });
    this.newItemName = '';
    this.newItemTagIds = [];
  }

  onRemove(id: string): void {
    this.itemRemove.emit(id);
  }

  onReorder(ev: Event): void {
    const detail = (ev as CustomEvent).detail;
    const reordered: EditorItem[] = detail.complete([...this.items]);
    this.itemsReorder.emit(reordered);
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') this.onAdd();
  }
}
