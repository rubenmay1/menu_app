import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedPlansPageRoutingModule } from './shared-plans-routing.module';
import { SharedModule } from '../shared/shared.module';
import { SharedPlansPage } from './shared-plans.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedPlansPageRoutingModule, SharedModule],
  declarations: [SharedPlansPage]
})
export class SharedPlansPageModule {}
