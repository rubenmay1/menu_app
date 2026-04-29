import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ShoppingPageRoutingModule } from './shopping-routing.module';
import { SharedModule } from '../shared/shared.module';

import { ShoppingPage } from './shopping.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ShoppingPageRoutingModule,
    SharedModule
  ],
  declarations: [ShoppingPage]
})
export class ShoppingPageModule {}
