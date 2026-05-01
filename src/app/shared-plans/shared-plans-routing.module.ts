import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SharedPlansPage } from './shared-plans.page';

const routes: Routes = [{ path: '', component: SharedPlansPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SharedPlansPageRoutingModule {}
