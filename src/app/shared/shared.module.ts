import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TagPillComponent } from './tag-pill.component';
import { ItemEditorComponent } from './item-editor.component';

@NgModule({
  declarations: [TagPillComponent, ItemEditorComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [TagPillComponent, ItemEditorComponent]
})
export class SharedModule {}
