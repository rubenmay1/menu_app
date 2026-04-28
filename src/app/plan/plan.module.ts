import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PlanPageRoutingModule } from './plan-routing.module';
import { SharedModule } from '../shared/shared.module';

import { PlanPage } from './plan.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PlanPageRoutingModule,
    SharedModule
  ],
  declarations: [PlanPage]
})
export class PlanPageModule {}
