import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AlertController } from '@ionic/angular';
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
  @Input() allowEdit: boolean = false;
  @Input() placeholder: string = 'Item name…';
  @Input() addLabel: string = '';

  @Output() itemAdd = new EventEmitter<{ name: string; tagIds: string[] }>();
  @Output() itemUpdate = new EventEmitter<{ id: string; name: string; tagIds: string[] }>();
  @Output() itemRemove = new EventEmitter<string>();
  @Output() itemsReorder = new EventEmitter<EditorItem[]>();

  newItemName: string = '';
  newItemTagIds: string[] = [];
  editingItemId: string | null = null;

  constructor(private readonly alertCtrl: AlertController) {}

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

  onEditClick(item: EditorItem): void {
    this.editingItemId = item.id;
    this.newItemName = item.name;
    this.newItemTagIds = [...(item.tagIds ?? [])];
  }

  onUpdate(): void {
    const name = this.newItemName.trim();
    if (!name || !this.editingItemId) return;
    this.itemUpdate.emit({ id: this.editingItemId, name, tagIds: this.showTags ? [...this.newItemTagIds] : [] });
    this.cancelEdit();
  }

  async onDeleteEditing(): Promise<void> {
    const id = this.editingItemId;
    if (!id) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete meal type?',
      message: 'This will permanently remove this meal type and all meal history for it.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.cancelEdit();
            this.itemRemove.emit(id);
          },
        },
      ],
    });
    await alert.present();
  }

  cancelEdit(): void {
    this.editingItemId = null;
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
    if (ev.key === 'Enter') {
      if (this.editingItemId) { this.onUpdate(); } else { this.onAdd(); }
    }
  }
}
