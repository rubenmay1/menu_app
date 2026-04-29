import { Component } from '@angular/core';
import { TagService } from './tag.service';
import { Tag } from './tag.model';
import { PRESET_COLORS } from '../plan/plan.models';

@Component({
  selector: 'app-tags',
  standalone: false,
  templateUrl: './tags.page.html',
  styleUrls: ['./tags.page.scss']
})
export class TagsPage {

  tags: Tag[] = [];
  filteredTags: Tag[] = [];
  searchQuery: string = '';
  readonly presetColors: string[] = PRESET_COLORS;

  creatorVisible: boolean = false;
  newTagName: string = '';
  newTagColor: string = '#42a5f5';

  editorVisible: boolean = false;
  editingTag: Tag | null = null;
  editingName: string = '';
  editingColor: string = '';

  constructor(private readonly tagService: TagService) {}

  async ionViewWillEnter(): Promise<void> {
    this.tags = await this.tagService.getTags();
    this.applyFilter();
  }

  private applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const base = q ? this.tags.filter(t => t.name.toLowerCase().includes(q)) : [...this.tags];
    this.filteredTags = base.sort((a, b) => a.name.localeCompare(b.name));
  }

  onSearchInput(ev: Event): void {
    this.searchQuery = (ev as CustomEvent).detail.value ?? '';
    this.applyFilter();
  }

  openCreator(): void {
    this.newTagName = '';
    this.newTagColor = '#90caf9';
    this.creatorVisible = true;
  }

  closeCreator(): void {
    this.creatorVisible = false;
  }

  async saveNewTag(): Promise<void> {
    const name = this.newTagName.trim();
    if (!name) return;
    await this.tagService.saveTag({ id: this.tagService.createId(), name, color: this.newTagColor });
    this.tags = await this.tagService.getTags();
    this.applyFilter();
    this.creatorVisible = false;
  }

  openEditor(tag: Tag): void {
    this.editingTag = tag;
    this.editingName = tag.name;
    this.editingColor = tag.color;
    this.editorVisible = true;
  }

  closeEditor(): void {
    this.editorVisible = false;
    this.editingTag = null;
  }

  async saveEdit(): Promise<void> {
    const name = this.editingName.trim();
    if (!name || !this.editingTag) return;
    await this.tagService.saveTag({ id: this.editingTag.id, name, color: this.editingColor });
    this.tags = await this.tagService.getTags();
    this.applyFilter();
    this.closeEditor();
  }

  async deleteTag(): Promise<void> {
    if (!this.editingTag) return;
    await this.tagService.deleteTag(this.editingTag.id);
    this.tags = await this.tagService.getTags();
    this.applyFilter();
    this.closeEditor();
  }
}
