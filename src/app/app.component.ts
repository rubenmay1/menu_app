import { Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertController, Platform } from '@ionic/angular';
import { Tag } from './tags/tag.model';
import { Meal } from './meals/meal.model';
import { SharedPlanData } from './plan/plan.models';
import * as LZString from 'lz-string';
import { DbService } from './shared/db.service';
import { DropboxService } from './shared/dropbox.service';
import { ViewPlanService } from './shared/view-plan.service';
import { SharedPlansService } from './shared-plans/shared-plans.service';

interface TutorialStep {
  readonly selector: string;
  readonly text: string;
  readonly radius: number;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { selector: 'ion-tab-button[tab="plan"]',     text: 'Plan and select your meals for each day',      radius: 40 },
  { selector: '.day-name',                       text: 'Long press to customise your meal types',      radius: 44 },
  { selector: 'ion-tab-button[tab="shopping"]', text: 'View and check off ingredients for your plan', radius: 40 },
  { selector: 'ion-tab-button[tab="meals"]',    text: 'Create and edit different custom meals',        radius: 40 },
  { selector: 'ion-tab-button[tab="tags"]',     text: 'Create and edit tags used to filter meals',    radius: 40 },
];

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  private readonly initialPath: string = (window as Window & { __initialPath?: string }).__initialPath ?? window.location.pathname;
  private readonly initialHref: string = (window as Window & { __initialHref?: string }).__initialHref ?? window.location.href;

  splashVisible = true;
  splashHiding = false;
  connectPromptVisible = false;
  syncPromptVisible = false;
  syncPromptMessage = '';
  mealsAndTagsImportPromptVisible = false;
  mealsAndTagsImportPromptMessage = '';
  mealsAndTagsImportLoading = false;
  mealsAndTagsImportSuccessVisible = false;
  mealsAndTagsImportSuccessLines: string[] = [];
  private pendingMealsAndTagsImportData: { tags: Tag[]; meals: Meal[] } | null = null;
  mealImportPromptVisible = false;
  mealImportPromptMessage = '';
  mealImportLoading = false;
  mealImportSuccessVisible = false;
  mealImportSuccessMessage = '';
  private pendingMealImportData: Meal | null = null;

  tutorialVisible = false;
  tutorialText = '';
  spotlight = { cx: 0, cy: 0, r: 0 };
  tutorialTextTop: string | null = null;
  tutorialTextBottom: string | null = null;

  private tutorialStep = 0;
  private tutorialResolve: (() => void) | null = null;

  constructor(
    private readonly db: DbService,
    private dropbox: DropboxService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
    private platform: Platform,
    private router: Router,
    private viewPlan: ViewPlanService,
    private sharedPlans: SharedPlansService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.db.initialize();

    if (!Capacitor.isNativePlatform()) {
      if (this.initialPath === '/dropbox-callback') {
        try {
          await this.dropbox.handleCallback(this.initialHref);
        } catch (e: unknown) {
          await this.showError(e);
        }
      } else if (this.initialPath === '/import') {
        this.handleMealsAndTagsImportUrl(this.initialHref);
      } else if (this.initialPath === '/import-meal') {
        this.handleMealImportUrl(this.initialHref);
      } else if (this.initialPath === '/view-plan') {
        this.handleViewPlanUrl(this.initialHref);
      }
    }

    setTimeout(() => {
      this.splashHiding = true;
      setTimeout(async () => {
        this.splashVisible = false;
        await new Promise<void>(r => setTimeout(r, 200));

        if (!localStorage.getItem('tutorial-completed')) {
          await this.runTutorial();
        }

        if (this.dropbox.isConnected()) {
          this.showSyncPrompt();
        } else if (this.dropbox.shouldPromptConnect()) {
          this.connectPromptVisible = true;
        }
      }, 400);
    }, 1600);

    this.platform.backButton.subscribeWithPriority(20, (processNextHandler) => {
      if (this.syncPromptVisible) { this.onSyncSkip(); }
      else if (this.mealImportSuccessVisible) { this.onMealImportSuccessDismiss(); }
      else if (this.mealImportPromptVisible) { this.onMealImportCancel(); }
      else if (this.mealsAndTagsImportSuccessVisible) { this.onMealsAndTagsImportSuccessDismiss(); }
      else if (this.mealsAndTagsImportPromptVisible) { this.onMealsAndTagsImportCancel(); }
      else if (this.connectPromptVisible) { this.onConnectLater(); }
      else { processNextHandler(); }
    });

    App.addListener('appUrlOpen', (data) => {
      this.ngZone.run(async () => { await this.dispatchUrl(data.url); });
    });

    // Cold-start: getLaunchUrl() captures URLs that arrived before the listener registered
    const launch = await App.getLaunchUrl();
    if (launch?.url) {
      await this.dispatchUrl(launch.url);
    }
  }

  // ---- Tutorial ----

  advanceTutorial(): void {
    const next = this.tutorialStep + 1;
    if (next >= TUTORIAL_STEPS.length) {
      this.endTutorial();
    } else {
      this.tutorialStep = next;
      this.applyTutorialStep(next);
    }
  }

  private runTutorial(): Promise<void> {
    return new Promise(resolve => {
      this.tutorialResolve = resolve;
      this.tutorialStep = 0;
      this.applyTutorialStep(0);
      this.tutorialVisible = true;
    });
  }

  private applyTutorialStep(index: number): void {
    const step = TUTORIAL_STEPS[index];
    const el = document.querySelector(step.selector);
    if (!el) {
      this.advanceTutorial();
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    this.spotlight = { cx, cy, r: step.radius };
    this.tutorialText = step.text;

    const gap = 28;
    if (cy < window.innerHeight * 0.55) {
      this.tutorialTextTop = `${cy + step.radius + gap}px`;
      this.tutorialTextBottom = null;
    } else {
      this.tutorialTextTop = null;
      this.tutorialTextBottom = `${window.innerHeight - cy + step.radius + gap}px`;
    }
  }

  private endTutorial(): void {
    this.tutorialVisible = false;
    localStorage.setItem('tutorial-completed', '1');
    this.tutorialResolve?.();
    this.tutorialResolve = null;
  }

  // ---- Dropbox ----

  onConnectNow(): void {
    this.connectPromptVisible = false;
    this.runBackgroundConnect();
  }

  onConnectLater(): void {
    this.connectPromptVisible = false;
  }

  onConnectDismiss(): void {
    this.connectPromptVisible = false;
    this.dropbox.dismissConnectPrompt();
  }

  private showSyncPrompt(): void {
    const last = this.dropbox.getLastSyncTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const overdue = !last || (Date.now() - last.getTime()) >= sevenDaysMs;
    if (!overdue) return;
    this.syncPromptMessage = last
      ? `Last backed up: ${last.toLocaleString()}`
      : 'You have not backed up yet.';
    this.syncPromptVisible = true;
  }

  onSyncBackUp(): void {
    this.syncPromptVisible = false;
    this.runBackgroundSync();
  }

  onSyncSkip(): void {
    this.syncPromptVisible = false;
  }

  // ---- URL dispatch ----

  private async dispatchUrl(url: string): Promise<void> {
    if (url.startsWith('menu-app://dropbox-callback')) {
      try {
        await this.dropbox.handleCallback(url);
      } catch (e: unknown) {
        await this.showError(e);
      }
    } else if (url.startsWith('menu-app://import-meal')) {
      this.handleMealImportUrl(url);
    } else if (url.startsWith('menu-app://import')) {
      this.handleMealsAndTagsImportUrl(url);
    } else if (url.startsWith('menu-app://view-plan')) {
      this.handleViewPlanUrl(url);
    }
  }

  private urlParam(url: string, name: string): string | null {
    const q = url.indexOf('?');
    if (q < 0) return null;
    for (const pair of url.slice(q + 1).split('&')) {
      const eq = pair.indexOf('=');
      if (eq >= 0 && pair.slice(0, eq) === name) {
        return decodeURIComponent(pair.slice(eq + 1));
      }
    }
    return null;
  }

  // ---- MealsAndTags Import ----

  private handleMealsAndTagsImportUrl(url: string): void {
    try {
      const encoded = this.urlParam(url, 'data');
      if (!encoded) return;
      const json = LZString.decompressFromEncodedURIComponent(encoded);
      if (!json) {
        this.showMealsAndTagsImportError();
        return;
      }
      const data = JSON.parse(json) as { tags: Tag[]; meals: Meal[] };
      if (!Array.isArray(data.tags) || !Array.isArray(data.meals)) {
        this.showMealsAndTagsImportError();
        return;
      }
      const tagCount = data.tags.length;
      const mealCount = data.meals.length;
      this.pendingMealsAndTagsImportData = data;
      this.mealsAndTagsImportPromptMessage = `Import ${tagCount} tag${tagCount !== 1 ? 's' : ''} and ${mealCount} meal${mealCount !== 1 ? 's' : ''}? Existing items with the same name will be overwritten.`;
      this.mealsAndTagsImportPromptVisible = true;
    } catch {
      this.showMealsAndTagsImportError();
    }
  }

  private showMealsAndTagsImportError(): void {
    this.alertCtrl.create({
      header: 'Import Failed',
      message: 'The import link appears to be corrupted or truncated. Try sharing it again directly - some apps shorten or cut off long links.',
      buttons: ['OK'],
    }).then(a => a.present());
  }

  async onMealsAndTagsImportConfirm(): Promise<void> {
    if (!this.pendingMealsAndTagsImportData) return;
    this.mealsAndTagsImportLoading = true;
    let result!: ReturnType<DbService['importTagsAndMeals']>;
    await Promise.all([
      new Promise<void>(r => setTimeout(r, 1000)),
      Promise.resolve().then(() => { result = this.db.importTagsAndMeals(this.pendingMealsAndTagsImportData!); }),
    ]);
    this.mealsAndTagsImportLoading = false;
    this.mealsAndTagsImportPromptVisible = false;
    this.pendingMealsAndTagsImportData = null;
    const { tagsAdded, tagsOverwritten, mealsAdded, mealsOverwritten } = result;
    const lines: string[] = [];
    if (tagsAdded || tagsOverwritten) {
      lines.push(`Tags: ${tagsAdded} added, ${tagsOverwritten} overwritten`);
    }
    if (mealsAdded || mealsOverwritten) {
      lines.push(`Meals: ${mealsAdded} added, ${mealsOverwritten} overwritten`);
    }
    this.mealsAndTagsImportSuccessLines = lines.length ? lines : ['Nothing to import.'];
    this.mealsAndTagsImportSuccessVisible = true;
  }

  onMealsAndTagsImportCancel(): void {
    this.mealsAndTagsImportPromptVisible = false;
    this.pendingMealsAndTagsImportData = null;
  }

  onMealsAndTagsImportSuccessDismiss(): void {
    this.mealsAndTagsImportSuccessVisible = false;
  }

  // ---- Meal Import ----

  private handleMealImportUrl(url: string): void {
    try {
      const encoded = this.urlParam(url, 'data');
      if (!encoded) return;
      const json = LZString.decompressFromEncodedURIComponent(encoded);
      if (!json) return;
      const meal = JSON.parse(json) as Meal;
      if (!meal.name) return;
      this.pendingMealImportData = meal;
      this.mealImportPromptMessage = `Import "${meal.name}"?`;
      this.mealImportPromptVisible = true;
    } catch { /* malformed link - ignore */ }
  }

  async onMealImportConfirm(): Promise<void> {
    if (!this.pendingMealImportData) return;
    const meal = this.pendingMealImportData;
    this.mealImportLoading = true;
    const mealToImport: Meal = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: meal.name,
      tagIds: [],
      ingredients: meal.ingredients ?? [],
      recipeUrl: meal.recipeUrl,
      noIngredientsRequired: meal.noIngredientsRequired,
    };
    await new Promise<void>(r => setTimeout(r, 1000));
    this.db.importTagsAndMeals({ tags: [], meals: [mealToImport] });
    this.mealImportLoading = false;
    this.mealImportPromptVisible = false;
    this.pendingMealImportData = null;
    this.mealImportSuccessMessage = `Imported ${meal.name}`;
    this.mealImportSuccessVisible = true;
  }

  onMealImportCancel(): void {
    this.mealImportPromptVisible = false;
    this.pendingMealImportData = null;
  }

  onMealImportSuccessDismiss(): void {
    this.mealImportSuccessVisible = false;
  }

  // ---- View plan (read mode) ----

  private handleViewPlanUrl(url: string): void {
    try {
      const encoded = this.urlParam(url, 'data');
      if (!encoded) return;
      const json = LZString.decompressFromEncodedURIComponent(encoded);
      if (!json) return;
      const data = JSON.parse(json) as SharedPlanData;
      if (!Array.isArray(data.days)) return;
      this.sharedPlans.add(data);
      this.viewPlan.enter(data, 'link');
      void this.router.navigate(['/tabs/plan']);
    } catch {
      // malformed URL - ignore
    }
  }

  private runBackgroundConnect(): void {
    this.dropbox.connect().catch(async (e: unknown) => {
      await this.showError(e);
    });
  }

  private runBackgroundSync(): void {
    this.dropbox.sync().catch(async (e: unknown) => {
      await this.showError(e);
    });
  }

  private async showError(e: unknown): Promise<void> {
    const msg = e instanceof Error ? e.message : 'An unexpected error occurred.';
    const alert = await this.alertCtrl.create({
      header: 'Dropbox Error',
      message: msg,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
