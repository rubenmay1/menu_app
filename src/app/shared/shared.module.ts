import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TagPillComponent } from './tag-pill.component';
import { ItemEditorComponent } from './item-editor.component';
import { WeekNavComponent } from './week-nav.component';
import { AppHeaderComponent } from './app-header.component';

@NgModule({
  declarations: [TagPillComponent, ItemEditorComponent, WeekNavComponent, AppHeaderComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [TagPillComponent, ItemEditorComponent, WeekNavComponent, AppHeaderComponent]
})
export class SharedModule {}
