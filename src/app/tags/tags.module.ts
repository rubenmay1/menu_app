import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TagsPageRoutingModule } from './tags-routing.module';
import { SharedModule } from '../shared/shared.module';
import { TagsPage } from './tags.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TagsPageRoutingModule, SharedModule],
  declarations: [TagsPage]
})
export class TagsPageModule {}
