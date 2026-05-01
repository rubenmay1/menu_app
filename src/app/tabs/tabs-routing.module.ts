import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'plan',
        loadChildren: () =>
          import('../plan/plan.module').then(m => m.PlanPageModule)
      },
      {
        path: 'meals',
        loadChildren: () =>
          import('../meals/meals.module').then(m => m.MealsPageModule)
      },
      {
        path: 'shopping',
        loadChildren: () =>
          import('../shopping/shopping.module').then(m => m.ShoppingPageModule)
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../settings/settings.module').then(m => m.SettingsPageModule)
      },
      {
        path: 'tags',
        loadChildren: () =>
          import('../tags/tags.module').then(m => m.TagsPageModule)
      },
      {
        path: 'shared',
        loadChildren: () =>
          import('../shared-plans/shared-plans.module').then(m => m.SharedPlansPageModule)
      },
      {
        path: '',
        redirectTo: 'plan',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
